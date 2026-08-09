import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne } from 'drizzle-orm';
import type { PeerReviewInput, PeerValidationView, ValidationSubject } from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import {
  accounts,
  learnerBadges,
  profiles,
  validationReviews,
  validationSubjects,
} from '../db/schema';
import { XpService } from '../xp/xp.service';

// Seuils de validation (recherche 2026 : ≥ 4 pairs idéal ; 3 accepté au lancement, moyenne robuste).
const REQUIRED_REVIEWS = 3;
const REQUIRED_AVG_STARS = 3;
// Éligibilité évaluateur (anti multi-comptes / auto-validation ; volontairement discrets, ajustables).
const EVAL_MIN_LEVEL = 3;
const EVAL_MIN_AGE_DAYS = 3;
const REVIEW_XP = 30; // récompense de réciprocité (alimente le pool d'évaluateurs).
const VALIDATED_XP = 200;

@Injectable()
export class ValidationService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly xp: XpService,
  ) {}

  /** Agrège un sujet + ses évaluations + l'auteur en un objet de vue. */
  private async toSubject(
    row: typeof validationSubjects.$inferSelect,
    viewerId: string,
  ): Promise<ValidationSubject> {
    const reviews = await this.db
      .select()
      .from(validationReviews)
      .where(eq(validationReviews.subjectId, row.id));
    const reviewCount = reviews.length;
    const avgStars = reviewCount > 0 ? reviews.reduce((a, r) => a + r.stars, 0) / reviewCount : 0;
    const author = (await this.db.select().from(profiles).where(eq(profiles.id, row.profileId)))[0];
    const authorLevel = await this.xp.level(row.profileId);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      evidenceUrl: row.evidenceUrl,
      format: row.format as 'visio' | 'video',
      status: row.status as 'open' | 'validated',
      reviewCount,
      avgStars: Math.round(avgStars * 10) / 10,
      mine: row.profileId === viewerId,
      reviewedByMe: reviews.some((r) => r.reviewerId === viewerId),
      authorName: author?.displayName ?? '',
      authorLevel,
      createdAtIso: row.createdAt.toISOString(),
    };
  }

  /** L'utilisateur est-il un prof AGRÉÉ (validation en une fois) ? */
  private async isTeacher(profileId: string): Promise<boolean> {
    const prof = (await this.db.select().from(profiles).where(eq(profiles.id, profileId)))[0];
    if (!prof) return false;
    const acc = (await this.db.select().from(accounts).where(eq(accounts.id, prof.accountId)))[0];
    return acc?.isTeacher ?? false;
  }

  /** Marque un sujet validé + badge + XP (facteur : nb pairs, ou « prof agréé »). */
  private async markValidated(
    subject: typeof validationSubjects.$inferSelect,
    label: string,
  ): Promise<void> {
    await this.db
      .update(validationSubjects)
      .set({ status: 'validated', validatedAt: new Date() })
      .where(eq(validationSubjects.id, subject.id));
    await this.xp.award(subject.profileId, VALIDATED_XP);
    await this.db.insert(learnerBadges).values({
      profileId: subject.profileId,
      name: subject.title,
      discipline: 'Validation',
      criteria: label,
    });
  }

  async view(profileId: string): Promise<PeerValidationView> {
    const level = await this.xp.level(profileId);
    const age = await this.xp.accountAgeDays(profileId);
    const canReview = level >= EVAL_MIN_LEVEL && age >= EVAL_MIN_AGE_DAYS;

    const mineRows = await this.db
      .select()
      .from(validationSubjects)
      .where(eq(validationSubjects.profileId, profileId))
      .orderBy(desc(validationSubjects.createdAt));
    const mySubjects = await Promise.all(mineRows.map((r) => this.toSubject(r, profileId)));

    let toReview: ValidationSubject[] = [];
    if (canReview) {
      const others = await this.db
        .select()
        .from(validationSubjects)
        .where(and(eq(validationSubjects.status, 'open'), ne(validationSubjects.profileId, profileId)))
        .orderBy(desc(validationSubjects.createdAt))
        .limit(30);
      const mapped = await Promise.all(others.map((r) => this.toSubject(r, profileId)));
      toReview = mapped.filter((s) => !s.reviewedByMe);
    }

    const badges = (
      await this.db
        .select()
        .from(learnerBadges)
        .where(and(eq(learnerBadges.profileId, profileId), eq(learnerBadges.discipline, 'Validation')))
        .orderBy(desc(learnerBadges.createdAt))
    ).map((b) => ({ id: b.id, name: b.name, criteria: b.criteria, dateIso: b.createdAt.toISOString() }));

    const teacher = await this.isTeacher(profileId);
    return {
      mySubjects,
      toReview,
      canReview,
      isTeacher: teacher,
      reviewGateMessage: canReview
        ? null
        : 'Pour évaluer d’autres élèves, il te faut un peu d’ancienneté et un niveau suffisant — le temps d’éviter les faux comptes. Continue, ça viendra vite.',
      badges,
      requiredReviews: REQUIRED_REVIEWS,
      requiredAvgStars: REQUIRED_AVG_STARS,
    };
  }

  /** Crée un sujet à valider (titre + description ; pas de menu de compétences). */
  async createSubject(
    profileId: string,
    input: { title: string; description: string; evidenceUrl: string | null; format: 'visio' | 'video' },
  ): Promise<PeerValidationView> {
    await this.db.insert(validationSubjects).values({
      profileId,
      title: input.title,
      description: input.description,
      evidenceUrl: input.evidenceUrl,
      format: input.format,
    });
    return this.view(profileId);
  }

  /** Un pair éligible évalue un sujet (validé + étoiles + commentaire). */
  async review(profileId: string, subjectId: string, input: PeerReviewInput): Promise<PeerValidationView> {
    const level = await this.xp.level(profileId);
    const age = await this.xp.accountAgeDays(profileId);
    if (level < EVAL_MIN_LEVEL || age < EVAL_MIN_AGE_DAYS)
      throw new ForbiddenException('pas encore éligible pour évaluer');

    const subject = (
      await this.db.select().from(validationSubjects).where(eq(validationSubjects.id, subjectId))
    )[0];
    if (!subject) throw new BadRequestException('sujet introuvable');
    if (subject.profileId === profileId) throw new ForbiddenException('on ne s’auto-évalue pas');

    const already = (
      await this.db
        .select()
        .from(validationReviews)
        .where(and(eq(validationReviews.subjectId, subjectId), eq(validationReviews.reviewerId, profileId)))
    )[0];
    if (already) throw new BadRequestException('déjà évalué');

    await this.db.insert(validationReviews).values({
      subjectId,
      reviewerId: profileId,
      validated: input.validated,
      stars: input.stars,
      comment: input.comment,
    });
    await this.xp.award(profileId, REVIEW_XP);

    if (subject.status !== 'validated') {
      const teacher = await this.isTeacher(profileId);
      if (teacher && input.validated) {
        // Un prof agréé valide en UNE fois.
        await this.markValidated(subject, `Validé par un prof agréé · ${input.stars}/5 étoiles`);
      } else {
        // Sinon : ≥ 3 évaluations, moyenne d'étoiles ≥ 3.
        const reviews = await this.db
          .select()
          .from(validationReviews)
          .where(eq(validationReviews.subjectId, subjectId));
        const avg = reviews.reduce((a, r) => a + r.stars, 0) / reviews.length;
        if (reviews.length >= REQUIRED_REVIEWS && avg >= REQUIRED_AVG_STARS) {
          await this.markValidated(subject, `Validé par ${reviews.length} pairs · ${Math.round(avg * 10) / 10}/5 étoiles`);
        }
      }
    }
    return this.view(profileId);
  }

  /** Page communautaire : tous les sujets ouverts (des autres), avec recherche + tri. */
  async community(profileId: string, q: string, sort: 'recent' | 'level'): Promise<ValidationSubject[]> {
    const rows = await this.db
      .select()
      .from(validationSubjects)
      .where(and(eq(validationSubjects.status, 'open'), ne(validationSubjects.profileId, profileId)))
      .orderBy(desc(validationSubjects.createdAt))
      .limit(200);
    let subjects = await Promise.all(rows.map((r) => this.toSubject(r, profileId)));
    subjects = subjects.filter((s) => !s.reviewedByMe);
    const query = q.trim().toLowerCase();
    if (query) {
      subjects = subjects.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.description.toLowerCase().includes(query) ||
          s.authorName.toLowerCase().includes(query),
      );
    }
    if (sort === 'level') subjects.sort((a, b) => b.authorLevel - a.authorLevel);
    return subjects.slice(0, 60);
  }

  /** Un sujet précis (lien de partage). */
  async getSubject(profileId: string, subjectId: string): Promise<ValidationSubject | null> {
    const row = (await this.db.select().from(validationSubjects).where(eq(validationSubjects.id, subjectId)))[0];
    return row ? this.toSubject(row, profileId) : null;
  }

  // Le statut « prof agréé » (accounts.is_teacher) est accordé MANUELLEMENT, au cas par cas — jamais
  // via une demande dans l'application. Pas de méthode applyTeacher (décision produit).
}
