import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valide un corps de requête avec Zod, ou lève une 400 structurée.
 * Renvoie le type de SORTIE (`z.infer`) → les `.default()` sont appliqués.
 */
export function parseOr400<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException(result.error.issues);
  return result.data;
}
