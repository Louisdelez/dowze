/**
 * Client d'embeddings (mémoire sémantique). Appelle l'API du fournisseur choisi
 * pour transformer des textes en vecteurs, puis on compare par similarité cosinus.
 * L'app reste la source de vérité ; l'embedding ne sert qu'au regroupement/rappel.
 */
export interface EmbeddingConfig {
  provider: string;
  modelId: string;
  apiKey: string;
}

const ENDPOINTS: Record<string, string> = {
  jina: 'https://api.jina.ai/v1/embeddings',
  openai: 'https://api.openai.com/v1/embeddings',
  mistral: 'https://api.mistral.ai/v1/embeddings',
};

interface EmbeddingResponse {
  data: { index: number; embedding: number[] }[];
}

/** Renvoie un vecteur par texte (dans le même ordre). */
export async function embedTexts(config: EmbeddingConfig, texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const url = ENDPOINTS[config.provider];
  if (!url) throw new Error(`Fournisseur d'embedding non câblé : ${config.provider}`);

  const body: Record<string, unknown> = { model: config.modelId, input: texts };
  if (config.provider === 'jina') body.task = 'text-matching';

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Embedding ${config.provider} ${res.status} : ${await res.text()}`);
  }
  const json = (await res.json()) as EmbeddingResponse;
  const out: number[][] = new Array(texts.length).fill(null);
  for (const d of json.data) out[d.index] = d.embedding;
  return out;
}

/** Similarité cosinus entre deux vecteurs (0 → 1 pour des textes proches). */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
