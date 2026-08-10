export const HIVE_CHANNELS = ['direct', 'messages', 'email', 'push', 'voice', 'system'] as const;
export type HiveChannel = (typeof HIVE_CHANNELS)[number];

export interface RoleContract {
  responsibilities?: string[];
  capabilities?: string[];
  limitations?: string[];
  delegatesTo?: string[];
  escalationPath?: string[];
  allowedTools?: string[];
}

export interface RoutableCompanion {
  id: string;
  roleKey?: string | null;
  contract?: RoleContract | null;
}

export interface ChannelContext {
  content: string;
  companionName: string;
  tone?: string | null;
  emotion?: string | null;
  relationship?: string | null;
  familiarity?: number | null;
  affinity?: number | null;
}

export interface HiveRuntime {
  id: string;
  model: string;
  harness: string;
  modalities: string[];
  capabilities: string[];
  quality: number;
  cost: number;
  latency: number;
  privacy: 'local' | 'private_cloud' | 'public_cloud';
  entitlement: 'included' | 'subscription' | 'metered';
  available: boolean;
}

export interface RuntimeRequest {
  capability: string;
  modality?: string;
  allowedPrivacy?: HiveRuntime['privacy'][];
  availableEntitlements?: HiveRuntime['entitlement'][];
  weights?: Partial<Record<'quality' | 'cost' | 'latency', number>>;
}

export interface HiveExecutionBudget {
  maxDepth: number;
  maxFanout: number;
  maxTasks: number;
  usedTasks: number;
}

export interface HiveCommunicationFrame {
  intent: 'inform' | 'ask' | 'confirm' | 'warn' | 'handoff' | 'acknowledge';
  facts: string[];
  emotion: string;
  confidence: number;
  prosody: { rate: number; pitch: number; pauses: 'short' | 'natural' | 'deliberate' };
  animation: 'nod' | 'think' | 'warn' | 'wave' | 'neutral';
}

export interface HiveComputeResource {
  id: string;
  kind: 'cpu' | 'gpu' | 'npu' | 'remote_api';
  locality: 'local' | 'private_cloud' | 'public_cloud';
  modalities: string[];
  memoryMb: number;
  acceleratorMemoryMb: number;
  maxConcurrency: number;
  activeAllocations: number;
  costPerHour: number;
  health: 'healthy' | 'degraded' | 'offline' | 'unknown';
  enabled: boolean;
}

/** Sélection sparse du matériel : capacité d'abord, puis charge et coût, jamais un nœud indisponible. */
export function selectComputeResource(
  request: {
    modality: string;
    minimumMemoryMb?: number;
    minimumAcceleratorMemoryMb?: number;
    allowedLocality?: HiveComputeResource['locality'][];
  },
  resources: HiveComputeResource[],
): HiveComputeResource | null {
  return (
    resources
      .filter(
        (resource) =>
          resource.enabled &&
          resource.health === 'healthy' &&
          resource.activeAllocations < resource.maxConcurrency &&
          resource.modalities.includes(request.modality) &&
          resource.memoryMb >= (request.minimumMemoryMb ?? 0) &&
          resource.acceleratorMemoryMb >= (request.minimumAcceleratorMemoryMb ?? 0) &&
          (!request.allowedLocality?.length || request.allowedLocality.includes(resource.locality)),
      )
      .map((resource, order) => ({
        resource,
        order,
        load: resource.activeAllocations / resource.maxConcurrency,
      }))
      .sort(
        (a, b) =>
          a.load - b.load ||
          a.resource.costPerHour - b.resource.costPerHour ||
          b.resource.acceleratorMemoryMb - a.resource.acceleratorMemoryMb ||
          a.order - b.order,
      )[0]?.resource ?? null
  );
}

/** Structure le sens avant toute adaptation de canal : le style ne peut jamais réécrire les faits. */
export function communicationFrame(
  content: string,
  context: Pick<ChannelContext, 'tone' | 'emotion'> & {
    intent?: HiveCommunicationFrame['intent'];
    confidence?: number;
  } = {},
): HiveCommunicationFrame {
  const emotion = context.emotion?.trim() || 'neutral';
  const tone = context.tone?.toLowerCase() ?? '';
  const intent = context.intent ?? (content.trim().endsWith('?') ? 'ask' : 'inform');
  return {
    intent,
    facts: [stripMarkdown(content)],
    emotion,
    confidence: Math.max(0, Math.min(1, context.confidence ?? 0.7)),
    prosody: {
      rate: /calme|posé/.test(tone) ? 0.9 : /énergi|vif/.test(tone) ? 1.08 : 1,
      pitch: /joyeu|enthous/.test(`${tone} ${emotion}`) ? 1.08 : 1,
      pauses: intent === 'warn' ? 'deliberate' : 'natural',
    },
    animation:
      intent === 'warn'
        ? 'warn'
        : intent === 'acknowledge' || intent === 'confirm'
          ? 'nod'
          : emotion === 'thinking'
            ? 'think'
            : 'neutral',
  };
}

export type HiveBudgetDecision =
  { allowed: true } | { allowed: false; reason: 'max_depth' | 'max_fanout' | 'max_tasks' };

/** Garde déterministe contre les essaims récursifs incontrôlés. */
export function canCreateHiveTask(
  budget: HiveExecutionBudget,
  input: { depth: number; siblingCount: number },
): HiveBudgetDecision {
  if (input.depth > budget.maxDepth) return { allowed: false, reason: 'max_depth' };
  if (input.siblingCount >= budget.maxFanout) return { allowed: false, reason: 'max_fanout' };
  if (budget.usedTasks >= budget.maxTasks) return { allowed: false, reason: 'max_tasks' };
  return { allowed: true };
}

/** Loi économique de la Ruche : une délégation doit créer plus de valeur qu'elle ne coordonne. */
export function shouldDelegate(input: {
  expectedGain: number;
  communicationCost: number;
  computeCost: number;
  coordinationCost: number;
}): boolean {
  return input.expectedGain > input.communicationCost + input.computeCost + input.coordinationCost;
}

const normalizedWords = (value: string): string[] =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9]{3,}/g) ?? [];

const overlap = (request: string, values: string[] | undefined): number => {
  if (!values?.length) return 0;
  const requested = new Set(normalizedWords(request));
  return normalizedWords(values.join(' ')).reduce(
    (score, word) => score + Number(requested.has(word)),
    0,
  );
};

const stripMarkdown = (value: string): string =>
  value
    .replace(/```[\s\S]*?```/g, 'un extrait de code')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const compactHumanText = (value: string): string =>
  stripMarkdown(value)
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const atMostSentences = (value: string, count: number, maxLength: number): string => {
  const sentences = value.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [value];
  const selected = sentences
    .slice(0, count)
    .map((sentence) => sentence.trim())
    .join(' ')
    .trim();
  if (selected.length <= maxLength) return selected;
  return `${selected.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

const makeSpeakable = (value: string): string =>
  compactHumanText(value)
    .replace(/https?:\/\/\S+/gi, 'le lien associé')
    .replace(/\b([A-Za-z]:)?[/\\][\w./\\-]+/g, 'le fichier concerné')
    .replace(/[{}[\]<>|]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

const applyExpressivePunctuation = (value: string, context: ChannelContext): string => {
  const expressive = `${context.tone ?? ''} ${context.emotion ?? ''}`.toLowerCase();
  if (!/(joyeu|heureu|enthous|énergi|chaleureu)/.test(expressive)) return value;
  return value.replace(/\.$/, ' !');
};

/** Choisit un couple modèle+harness réellement disponible, sans confondre le modèle avec son outil. */
export function selectHiveRuntime(
  request: RuntimeRequest,
  runtimes: HiveRuntime[],
): HiveRuntime | null {
  const capabilityWords = new Set(normalizedWords(request.capability));
  const qualityWeight = request.weights?.quality ?? 0.55;
  const costWeight = request.weights?.cost ?? 0.25;
  const latencyWeight = request.weights?.latency ?? 0.2;
  return (
    runtimes
      .filter(
        (runtime) =>
          runtime.available &&
          (!request.modality || runtime.modalities.includes(request.modality)) &&
          (!request.allowedPrivacy?.length || request.allowedPrivacy.includes(runtime.privacy)) &&
          (!request.availableEntitlements?.length ||
            request.availableEntitlements.includes(runtime.entitlement)) &&
          normalizedWords(runtime.capabilities.join(' ')).some((word) => capabilityWords.has(word)),
      )
      .map((runtime, order) => ({
        runtime,
        order,
        score:
          runtime.quality * qualityWeight +
          (1 - runtime.cost) * costWeight +
          (1 - runtime.latency) * latencyWeight,
      }))
      .sort((a, b) => b.score - a.score || a.order - b.order)[0]?.runtime ?? null
  );
}

/** Fidélité de rôle avant génération : un compagnon hors périmètre doit router, pas improviser. */
export function canHandleRequest(
  request: string,
  contract: RoleContract | null | undefined,
): boolean {
  if (!contract?.capabilities?.length && !contract?.responsibilities?.length) return false;
  if (overlap(request, contract.limitations) > 0) return false;
  return (
    overlap(request, [...(contract.capabilities ?? []), ...(contract.responsibilities ?? [])]) > 0
  );
}

/** Route vers le candidat valide le mieux adapté ; l'ordre d'entrée tranche les égalités organisationnelles. */
export function selectCompanionForRequest(
  request: string,
  companions: RoutableCompanion[],
): RoutableCompanion | null {
  return (
    companions
      .map((companion, order) => ({
        companion,
        order,
        blocked: overlap(request, companion.contract?.limitations) > 0,
        score: overlap(request, [
          ...(companion.contract?.capabilities ?? []),
          ...(companion.contract?.responsibilities ?? []),
          companion.roleKey ?? '',
        ]),
      }))
      .filter((candidate) => !candidate.blocked && candidate.score > 0)
      .sort((a, b) => b.score - a.score || a.order - b.order)[0]?.companion ?? null
  );
}

/** Plus court chemin explicite dans les contrats de délégation ; repli direct si aucun maillon n'est déclaré. */
export function findOrganizationalRoute(
  sourceId: string,
  targetId: string,
  companions: RoutableCompanion[],
): string[] {
  if (sourceId === targetId) return [sourceId];
  const nodes = new Map(companions.map((companion) => [companion.id, companion]));
  if (!nodes.has(sourceId) || !nodes.has(targetId)) return [sourceId, targetId];
  const roleIndex = new Map<string, string[]>();
  for (const companion of companions) {
    for (const key of [companion.id, companion.roleKey ?? '']) {
      for (const normalized of normalizedWords(key)) {
        roleIndex.set(normalized, [...(roleIndex.get(normalized) ?? []), companion.id]);
      }
    }
  }
  const queue: string[][] = [[sourceId]];
  const visited = new Set([sourceId]);
  while (queue.length) {
    const path = queue.shift()!;
    const currentId = path[path.length - 1]!;
    const current = nodes.get(currentId)!;
    const refs = [
      ...(current.contract?.delegatesTo ?? []),
      ...(current.contract?.escalationPath ?? []),
    ];
    const neighbours = new Set<string>();
    for (const ref of refs) {
      if (nodes.has(ref)) neighbours.add(ref);
      for (const word of normalizedWords(ref))
        for (const id of roleIndex.get(word) ?? []) neighbours.add(id);
    }
    for (const neighbour of neighbours) {
      if (visited.has(neighbour)) continue;
      const next = [...path, neighbour];
      if (neighbour === targetId) return next;
      visited.add(neighbour);
      queue.push(next);
    }
  }
  return [sourceId, targetId];
}

/** Un même contenu métier est rendu selon le canal humain, sans modifier les faits. */
export function renderForChannel(channel: HiveChannel, context: ChannelContext): string {
  const content = stripMarkdown(context.content);
  if (channel === 'email') {
    const greeting = (context.familiarity ?? 0) >= 0.7 ? 'Salut,' : 'Bonjour,';
    const warm = /chaleureu|amical|joyeu/i.test(context.tone ?? '');
    const closing = warm
      ? 'Chaleureusement,'
      : (context.affinity ?? 0) >= 0.75
        ? 'À bientôt,'
        : 'Bien à vous,';
    return `${greeting}\n\n${content}\n\n${closing}\n${context.companionName}`;
  }
  if (channel === 'push') return atMostSentences(compactHumanText(content), 1, 140);
  if (channel === 'direct')
    return applyExpressivePunctuation(atMostSentences(compactHumanText(content), 2, 240), context);
  if (channel === 'messages') {
    const message = compactHumanText(content);
    return applyExpressivePunctuation(
      message.length <= 800 ? message : `${message.slice(0, 799).trimEnd()}…`,
      context,
    );
  }
  if (channel === 'voice') return atMostSentences(makeSpeakable(content), 4, 600);
  return stripMarkdown(content);
}
