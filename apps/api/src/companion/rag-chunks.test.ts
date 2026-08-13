import { describe, expect, it } from 'vitest';
import { chunkKnowledgeDocument, fallbackAgentConfig } from './companion.service';

describe('chunkKnowledgeDocument', () => {
  it('conserve tout le document dans des fragments chevauchés et citables', () => {
    const source = Array.from(
      { length: 30 },
      (_, index) => `Paragraphe ${index + 1}. La règle ${index + 1} doit rester récupérable.`,
    ).join('\n\n');
    const chunks = chunkKnowledgeDocument(source, 320, 60);
    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.content).toBe(source.slice(chunk.startOffset, chunk.endOffset));
      expect(chunk.content.length).toBeLessThanOrEqual(320);
    }
    expect(chunks[0]?.startOffset).toBe(0);
    expect(chunks.at(-1)?.endOffset).toBe(source.length);
  });

  it('ignore un document vide', () => {
    expect(chunkKnowledgeDocument('  \n ')).toEqual([]);
  });
});

describe('fallbackAgentConfig', () => {
  it('permet de créer une abeille exploitable sans réponse du LLM', () => {
    const config = fallbackAgentConfig('Recherche et vérification documentaire RAG');
    expect(config.name).toBe('Vérification Expert');
    expect(config.specialization).toBe('Recherche et vérification documentaire RAG');
    expect(config.capabilities).toContain('Vérification avec citations');
    expect(config.systemPrompt).toContain('cites exactement les documents');
  });
});
