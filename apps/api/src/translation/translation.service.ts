import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { TranslationResult } from '@dowze/schemas';
import { CacheService } from '../cache/cache.service';
import { CopiloteService } from '../copilote/copilote.service';

/** Version de la clé de cache (change si on modifie la logique/le prompt de traduction). */
const CACHE_VERSION = 'v1';
const CACHE_TTL_SEC = 60 * 60 * 24 * 30; // 30 jours

@Injectable()
export class TranslationService {
  constructor(
    private readonly cache: CacheService,
    private readonly copilote: CopiloteService,
  ) {}

  /**
   * Traduit un message. Cache COMMUNAUTAIRE (Redis) par (langue cible × texte source) :
   * le premier paie, tous les autres réutilisent gratuitement (doc 26 §4.2).
   */
  async translate(profileId: string, text: string, targetLang: string): Promise<TranslationResult> {
    const source = text.trim();
    if (source.length === 0) {
      return { text: '', cached: true, promptTokens: 0, completionTokens: 0, costUsd: 0 };
    }
    const hash = createHash('sha256').update(source).digest('hex');
    const key = `tr:${CACHE_VERSION}:${targetLang}:${hash}`;

    const hit = await this.cache.getJson<{ text: string }>(key);
    if (hit) {
      return { text: hit.text, cached: true, promptTokens: 0, completionTokens: 0, costUsd: 0 };
    }

    const r = await this.copilote.translate(profileId, source, targetLang);
    // Cache global par paire de langues (effet réseau) — bénéficie à toute la communauté.
    await this.cache.setJson(key, { text: r.text }, CACHE_TTL_SEC);
    return {
      text: r.text,
      cached: false,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      costUsd: r.costUsd,
    };
  }
}
