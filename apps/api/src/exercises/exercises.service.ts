import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  clozeGenSchema,
  flashcardGenSchema,
  genBatchSchema,
  qcmGenSchema,
  shortGenSchema,
  type ExerciseItem,
  type GenerateExercisesRequest,
} from '@dowze/schemas';
import { DB, type Database } from '../db/drizzle.module';
import { exerciseItems, skills } from '../db/schema';
import { CopiloteService } from '../copilote/copilote.service';
import { EXERCISE_SYSTEM, exercisePrompt } from './exercise-prompts';

type GenType = GenerateExercisesRequest['type'];

const GEN_SCHEMAS = {
  flashcard: flashcardGenSchema,
  qcm: qcmGenSchema,
  short: shortGenSchema,
  cloze: clozeGenSchema,
} as const;

@Injectable()
export class ExercisesService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly copilote: CopiloteService,
  ) {}

  /** Génère `count` items d'un type donné, ancrés sur une compétence, et les stocke. */
  async generate(
    input: GenerateExercisesRequest,
  ): Promise<{ items: ExerciseItem[]; creditsSpent: number }> {
    const skill = (await this.db.select().from(skills).where(eq(skills.id, input.skillId)))[0];
    if (!skill) throw new NotFoundException('compétence introuvable');

    const genSchema = GEN_SCHEMAS[input.type];
    const batch = genBatchSchema(genSchema as z.ZodTypeAny);

    const { object, creditsSpent } = await this.copilote.generateStructured<{ items: unknown[] }>(
      input.profileId,
      {
        schema: batch as z.ZodType<{ items: unknown[] }>,
        schemaName: 'ExerciseBatch',
        system: EXERCISE_SYSTEM,
        prompt: exercisePrompt(
          { title: skill.title, description: skill.description ?? '' },
          input.type,
          input.count,
        ),
        temperature: 0.5,
        ref: `exercises-${input.type}`,
      },
    );

    const sourceRef = `skill:${skill.slug}`;
    const items: ExerciseItem[] = object.items.map((raw) =>
      this.wrap(input.type, raw, input.skillId, sourceRef),
    );

    if (items.length > 0) {
      await this.db.insert(exerciseItems).values(
        items.map((it) => ({
          skillId: input.skillId,
          type: it.type,
          payload: it,
          sourceRef,
        })),
      );
    }

    return { items, creditsSpent };
  }

  /** Enveloppe une sortie IA en item complet (attache type + méta). */
  private wrap(type: GenType, raw: unknown, skillId: string, sourceRef: string): ExerciseItem {
    const meta = { competenceId: skillId, bloomLevel: 'comprendre' as const, sourceRef };
    const g = raw as Record<string, unknown>;
    switch (type) {
      case 'flashcard':
        return { type, recto: String(g.recto), verso: String(g.verso), ...meta };
      case 'qcm':
        return {
          type,
          stem: String(g.stem),
          options: g.options as string[],
          correctIndex: Number(g.correctIndex),
          distractorRationales: g.distractorRationales as string[],
          feedback: String(g.feedback),
          ...meta,
        };
      case 'short':
        return {
          type,
          prompt: String(g.prompt),
          acceptedAnswers: g.acceptedAnswers as string[],
          feedback: String(g.feedback),
          ...meta,
        };
      case 'cloze':
        return {
          type,
          textWithGaps: String(g.textWithGaps),
          gaps: g.gaps as { acceptedAnswers: string[] }[],
          feedback: String(g.feedback),
          ...meta,
        };
    }
  }
}
