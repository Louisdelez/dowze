import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Skill } from '@dowze/schemas';
import { disciplineOf } from '../results/ranks';
import { SkillGraphService } from '../skill-graph/skill-graph.service';
import { ProgressionService } from '../progression/progression.service';
import { CopiloteService } from '../copilote/copilote.service';

const DEFAULT_THRESHOLD = 0.95;

type GrownSkill = { id: string; slug: string; title: string; depth: number };
type GrowResult =
  | { grew: false; reason: 'no-frontier'; added: 0 }
  | {
      grew: true;
      added: number;
      frontier: { id: string; slug: string; title: string; depth: number };
      skills: GrownSkill[];
    };

/**
 * **École générative — génération vivante de nœuds.** Quand un élève maîtrise une compétence qui
 * se trouve au BORD du graphe (aucune compétence ne l'a pour prérequis), l'Atlas s'étend : on
 * génère la ou les compétences suivantes (Copilote), on fixe leur profondeur/prérequis, puis on
 * les ingère via `SkillGraphService.ingest` — qui **valide la loi de clôture avant d'écrire**.
 *
 * C'est ce qui rend « étudier à l'infini, de la maternelle au front de recherche » réellement vrai :
 * rien n'est figé, le graphe pousse là où un élève atteint son extrémité.
 */
@Injectable()
export class SkillGenerationService {
  constructor(
    private readonly graph: SkillGraphService,
    private readonly progression: ProgressionService,
    private readonly copilote: CopiloteService,
  ) {}

  /**
   * Fait pousser l'Atlas au bord atteint par l'élève. Idempotent au sens « rien à faire » :
   * si l'élève n'a maîtrisé aucune feuille-frontière, ne génère rien (`grew:false`).
   */
  async growForLearner(profileId: string): Promise<GrowResult> {
    const [skills, mastery, chosen] = await Promise.all([
      this.graph.loadGraph(),
      this.progression.getMastery(profileId),
      this.progression.chosenDisciplines(profileId),
    ]);
    const map = new Map(skills.map((s) => [s.id, s]));
    const masteredIds = new Set(
      mastery
        .filter((m) => m.pMastery >= (map.get(m.skillId)?.masteryThreshold ?? DEFAULT_THRESHOLD))
        .map((m) => m.skillId),
    );

    // Feuilles du graphe = compétences qu'aucune autre n'a pour prérequis.
    const hasChild = new Set<string>();
    for (const s of skills) for (const p of s.prerequisites) hasChild.add(p);

    // Frontières atteintes : feuilles maîtrisées. On préfère la discipline choisie, puis la plus profonde.
    const frontier = skills
      .filter((s) => masteredIds.has(s.id) && !hasChild.has(s.id))
      .sort((a, b) => {
        const pa = chosen.has(disciplineOf(a.slug)) ? 0 : 1;
        const pb = chosen.has(disciplineOf(b.slug)) ? 0 : 1;
        return pa - pb || b.depth - a.depth || a.slug.localeCompare(b.slug);
      })[0];

    if (!frontier) return { grew: false, reason: 'no-frontier', added: 0 };

    const discipline = disciplineOf(frontier.slug);
    // Consensus multi-passes dans les zones sensibles (front de recherche, rang ≥ 8) où l'invention coûte cher.
    const passes = (frontier.rank ?? 0) >= 8 ? 2 : 1;
    const drafts = await this.copilote.generateNextSkills(
      profileId,
      {
        slug: frontier.slug,
        title: frontier.title,
        description: frontier.description,
        depth: frontier.depth,
        kind: frontier.kind,
        discipline,
        rank: frontier.rank,
      },
      2,
      passes,
    );
    if (drafts.length === 0) return { grew: false, reason: 'no-frontier', added: 0 };

    // Préfixe de discipline (math-, info-, …) → la voie de spécialisation reste cohérente.
    const prefix = frontier.slug.includes('-') ? `${frontier.slug.split('-')[0]}-` : '';
    const existingSlugs = new Set(skills.map((s) => s.slug));
    const built: Skill[] = drafts.map((d, i) => {
      const slug = this.uniqueSlug(prefix, d.slug, existingSlugs, i);
      existingSlugs.add(slug);
      return {
        id: randomUUID(),
        slug,
        title: d.title.trim().slice(0, 120),
        description: d.description.trim(),
        kind: d.kind as Skill['kind'],
        depth: frontier.depth + 1,
        prerequisites: [frontier.id],
        isRoot: false,
        rank: d.rank,
        epistemicStatus: d.epistemicStatus,
        halfLifeYears: d.halfLifeYears,
        masteryThreshold: d.masteryThreshold,
        sources: d.sources,
      };
    });

    const { added } = await this.graph.ingest(built);
    return {
      grew: true,
      added,
      frontier: {
        id: frontier.id,
        slug: frontier.slug,
        title: frontier.title,
        depth: frontier.depth,
      },
      skills: built.map((s) => ({ id: s.id, slug: s.slug, title: s.title, depth: s.depth })),
    };
  }

  /**
   * La prochaine compétence à travailler — et si l'élève a atteint le bord du graphe (aucune
   * frontière apprenable), on **fait pousser l'Atlas** puis on recalcule. Rend le parcours sans fin.
   */
  async nextOrGrow(profileId: string): Promise<{
    skill: { id: string; slug: string; title: string; depth: number } | null;
    grew: boolean;
  }> {
    let next = await this.progression.nextPrescribed(profileId);
    if (next) return { skill: next, grew: false };

    const grow = await this.growForLearner(profileId);
    if (!grow.grew) return { skill: null, grew: false };

    next = await this.progression.nextPrescribed(profileId);
    return { skill: next, grew: true };
  }

  /**
   * **« Je veux apprendre X »** — génère la compétence-cible d'un objectif libre PLUS la chaîne de
   * prérequis qui la relie aux acquis de l'élève (voisinage amont), puis l'ingère (clôture validée).
   * Fabrique le chemin manquant vers un but que le graphe ne couvre pas encore.
   */
  async growTowardGoal(
    profileId: string,
    goal: string,
  ): Promise<
    | { grew: false; reason: 'empty-goal' | 'nothing-generated'; added: 0 }
    | { grew: true; added: number; goalSkill: GrownSkill; chain: GrownSkill[] }
  > {
    const clean = goal.trim();
    if (clean.length < 3) return { grew: false, reason: 'empty-goal', added: 0 };

    const [skills, mastery] = await Promise.all([
      this.graph.loadGraph(),
      this.progression.getMastery(profileId),
    ]);
    const map = new Map(skills.map((s) => [s.id, s]));
    const masteredIds = new Set(
      mastery
        .filter((m) => m.pMastery >= (map.get(m.skillId)?.masteryThreshold ?? DEFAULT_THRESHOLD))
        .map((m) => m.skillId),
    );

    // Ancrage : les compétences acquises les plus profondes (ou, à défaut, les racines du graphe).
    const mastered = skills.filter((s) => masteredIds.has(s.id)).sort((a, b) => b.depth - a.depth);
    const anchorPool = mastered.length > 0 ? mastered : skills.filter((s) => s.isRoot);
    const anchor = anchorPool[0];
    if (!anchor) return { grew: false, reason: 'nothing-generated', added: 0 };

    const drafts = await this.copilote.generateTowardGoal(
      profileId,
      clean,
      anchorPool
        .slice(0, 8)
        .map((a) => ({ title: a.title, description: a.description, depth: a.depth })),
    );
    if (drafts.length === 0) return { grew: false, reason: 'nothing-generated', added: 0 };

    const existingSlugs = new Set(skills.map((s) => s.slug));
    const built: Skill[] = drafts.map((d, i) => {
      const slug = this.uniqueSlug('', d.slug, existingSlugs, i);
      existingSlugs.add(slug);
      return {
        id: randomUUID(),
        slug,
        title: d.title.trim().slice(0, 120),
        description: d.description.trim(),
        kind: d.kind as Skill['kind'],
        depth: anchor.depth + 1 + i,
        prerequisites: [], // fixé juste après (chaîne)
        isRoot: false,
        rank: d.rank,
        epistemicStatus: d.epistemicStatus,
        halfLifeYears: d.halfLifeYears,
        masteryThreshold: d.masteryThreshold,
        sources: d.sources,
      };
    });
    // Chaîne : le 1er s'appuie sur l'ancrage existant, chacun sur le précédent.
    built.forEach((s, i) => {
      s.prerequisites = [i === 0 ? anchor.id : built[i - 1]!.id];
    });

    const { added } = await this.graph.ingest(built);
    const chain = built.map((s) => ({ id: s.id, slug: s.slug, title: s.title, depth: s.depth }));
    return { grew: true, added, goalSkill: chain[chain.length - 1]!, chain };
  }

  /** GraphRAG vectoriel : embarque (backfill) les nœuds du graphe pour la récupération sémantique. */
  embedGraph(profileId: string, limit = 1000): Promise<{ embedded: number; remaining: number }> {
    return this.copilote.embedGraphNodes(profileId, limit);
  }

  /** Assainit un slug généré en kebab-case, le préfixe par la discipline et garantit l'unicité. */
  private uniqueSlug(prefix: string, raw: string, taken: Set<string>, salt: number): string {
    let base = raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (prefix && !base.startsWith(prefix)) base = prefix + base;
    if (!base) base = `${prefix}skill-${salt + 1}`;
    let slug = base;
    let n = 2;
    while (taken.has(slug)) slug = `${base}-${n++}`;
    return slug;
  }
}
