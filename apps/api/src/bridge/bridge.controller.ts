import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { bridgeOperationSchema } from '@dowze/schemas';
import { GenerationService } from './generation.service';
import { ImportService } from './import.service';

const createRequestBody = z.object({
  operation: bridgeOperationSchema,
  requestId: z.string().uuid(),
  seed: z.string().min(1),
  instruction: z.string().optional(),
});

const importBody = z.object({
  raw: z.string(),
  expectedRequestId: z.string().uuid(),
  expectedOperation: bridgeOperationSchema,
});

function parseOr400<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues);
  return r.data;
}

@Controller('bridge')
export class BridgeController {
  constructor(
    private readonly generation: GenerationService,
    private readonly importer: ImportService,
  ) {}

  /** Produit le `.json` aller à coller dans l'IA. */
  @Post('requests')
  createRequest(@Body() body: unknown) {
    const input = parseOr400(createRequestBody, body);
    return this.generation.buildRequest(input.operation, {
      requestId: input.requestId,
      seed: input.seed,
      instruction: input.instruction,
      nowIso: new Date().toISOString(),
    });
  }

  /** Valide le `.json` retour produit par l'IA. */
  @Post('responses')
  importResponse(@Body() body: unknown) {
    const input = parseOr400(importBody, body);
    return this.importer.validate(input.raw, {
      expectedRequestId: input.expectedRequestId,
      expectedOperation: input.expectedOperation,
    });
  }
}
