import { Injectable } from '@nestjs/common';
import { buildBridgeRequest } from '@dowze/core';
import type { BridgeOperation, BridgeRequest } from '@dowze/schemas';
import { promptFor, responseSchemaFor, exampleFor } from './prompts';

export interface GenerationOptions {
  requestId: string;
  seed: string;
  nowIso: string;
  instruction?: string;
}

/** Fabrique le `.json` ALLER (intra → IA) pour une opération donnée. */
@Injectable()
export class GenerationService {
  buildRequest(op: BridgeOperation, opts: GenerationOptions): BridgeRequest {
    return buildBridgeRequest({
      requestId: opts.requestId,
      operation: op,
      prompt: promptFor(op, { seed: opts.seed, instruction: opts.instruction }),
      responseSchema: responseSchemaFor(op),
      example: exampleFor(op),
      seed: opts.seed,
      nowIso: opts.nowIso,
    });
  }
}
