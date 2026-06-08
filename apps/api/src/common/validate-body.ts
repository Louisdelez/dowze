import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** Valide un corps de requête avec Zod, ou lève une 400 structurée. */
export function parseOr400<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues);
  return result.data;
}
