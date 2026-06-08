import { Injectable } from '@nestjs/common';
import { validateBridgeResponseText, type BridgeValidationResult } from '@dowze/core';
import type { BridgeOperation } from '@dowze/schemas';

export interface ImportOptions {
  expectedRequestId: string;
  expectedOperation: BridgeOperation;
  maxBytes?: number;
}

/**
 * Valide le `.json` RETOUR (IA → intra) via le pipeline strict de @dowze/core.
 * L'application en base (upsert des compétences validées) est faite par les
 * services de domaine une fois le résultat `ok`.
 */
@Injectable()
export class ImportService {
  validate(rawText: string, opts: ImportOptions): BridgeValidationResult {
    return validateBridgeResponseText(rawText, opts);
  }
}
