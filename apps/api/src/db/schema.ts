import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  doublePrecision,
  real,
  timestamp,
  date,
  jsonb,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core';

/** Colonne binaire Postgres (`bytea`) — lue/écrite en Buffer Node. */
const bytea = customType<{ data: Buffer; driver: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

/**
 * Schéma Drizzle — miroir typé d'un sous-ensemble des tables Postgres
 * (cf. supabase/migrations). Source de vérité SQL = les migrations ; ici on
 * décrit ce que le backend lit/écrit.
 */

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authUserId: uuid('auth_user_id').unique(),
  email: text('email').notNull().unique(),
  role: text('role').notNull().default('eleve'),
  isMinor: boolean('is_minor').notNull().default(false),
  isTeacher: boolean('is_teacher').notNull().default(false),
  activationStatus: text('activation_status').notNull().default('active'), // active | pending_parent
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  displayName: text('display_name').notNull(),
  tag: text('tag'), // discriminateur d'ami : pseudo affiché = displayName#tag (type Discord)
  locale: text('locale').notNull(),
  timezone: text('timezone').notNull(),
  phase: text('phase').notNull().default('tronc-commun'),
  birthDate: date('birth_date'),
  photoUrl: text('photo_url'),
  // Compagnon perso (« pet ») choisi par l'utilisateur : { url, size, hidden }.
  companion: jsonb('companion'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// « Maison » du compagnon (jeu isométrique) : pièce choisie + meubles placés (grille iso).
export const petRoom = pgTable('pet_room', {
  profileId: uuid('profile_id').primaryKey(),
  room: text('room').notNull().default('chambre'),
  items: jsonb('items').notNull().default('[]'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tamagotchi du compagnon : état de soin par profil (jauges + timestamps de décroissance).
export const petCare = pgTable('pet_care', {
  profileId: uuid('profile_id').primaryKey(),
  satiety: integer('satiety').notNull().default(80),
  happiness: integer('happiness').notNull().default(80),
  energy: integer('energy').notNull().default(80),
  hygiene: integer('hygiene').notNull().default(80),
  health: integer('health').notNull().default(90),
  gold: integer('gold').notNull().default(300),
  owned: jsonb('owned').notNull().default('["plante","tapis","chaise","lampe","fleur"]'),
  bornAt: timestamp('born_at', { withTimezone: true }).notNull().defaultNow(),
  lastTick: timestamp('last_tick', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tamagotchi PAR compagnon (agents/abeilles) : jauges + décroissance temps réel, comme le pet principal mais par agent.
// Le principal (isPrimary) garde son état dans `petCare` (avec gold/stock) ; cette table couvre TOUS les autres compagnons.
export const companionCare = pgTable('companion_care', {
  agentId: uuid('agent_id').primaryKey(),
  satiety: integer('satiety').notNull().default(80),
  happiness: integer('happiness').notNull().default(80),
  energy: integer('energy').notNull().default(80),
  hygiene: integer('hygiene').notNull().default(80),
  health: integer('health').notNull().default(90),
  bornAt: timestamp('born_at', { withTimezone: true }).notNull().defaultNow(),
  lastTick: timestamp('last_tick', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Bibliothèque de pets importés (validés + servis par l'API) : plusieurs par profil, nommés.
export const companionPets = pgTable('companion_pets', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  name: text('name'),
  mime: text('mime').notNull(),
  bytes: bytea('bytes').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Compagnons-agents : plusieurs compagnons par profil (« famille » dans la Maison + open-spaces).
// Mode PNJ (répliques scriptées) d'abord ; mode agent (IA/RAG) plus tard. Le principal (is_primary) est non supprimable.
export const companionAgents = pgTable('companion_agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  name: text('name').notNull(),
  skinUrl: text('skin_url'),
  size: integer('size').notNull().default(96),
  personality: jsonb('personality'), // { tone, traits[], description, emoji? } — pilote les répliques PNJ
  role: text('role'), // libellé humain lisible (ex. « Directeur technique »)
  roleKey: text('role_key'), // clé du catalogue de rôles (ex. 'cto', 'dev-back', 'enseignant')
  roleContract: jsonb('role_contract').notNull().default('{}'), // responsabilités, capacités, limites, délégation, escalade
  space: text('space').notNull().default('home'), // 'home' (Maison + Tamagotchi) | id d'open-space
  // Salle DANS l'espace. Maison : 'chambre' (chambre perso du compagnon) | 'salon' | 'cuisine' | 'bureau' | 'jardin' | 'plage'.
  // Open-space : 'travail:N' (workspace, capacité 100 → déborde en travail:1, 2…) | 'toilettes' | 'cantine' | 'repos' | 'garage'.
  room: text('room').notNull().default('chambre'),
  pos: jsonb('pos'), // { c, r }
  isPrimary: boolean('is_primary').notNull().default(false),
  mode: text('mode').notNull().default('pnj'), // 'pnj' | 'agent' | 'relay'
  // Cycle de vie / efficacité (« jardinage de la ruche »).
  useCount: integer('use_count').notNull().default(0), // nb de mobilisations
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  qualityEma: real('quality_ema'), // qualité glissante 0..1 (EMA), null tant que non évalué
  ratingCount: integer('rating_count').notNull().default(0),
  protected: boolean('protected').notNull().default(false), // exempt de prune/merge (épinglé)
  status: text('status').notNull().default('active'), // 'active' | 'retired' (soft-delete) | 'merged'
  mergedInto: uuid('merged_into'), // si fusionnée : id de la survivante
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Espaces de travail : la Maison ('home') est implicite ; les open-spaces sont nommables.
export const companionSpaces = pgTable('companion_spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  name: text('name').notNull(),
  // Open-space = organisation : type + mission + template de rôles + propriétaire (user vs service Dowze).
  type: text('type').notNull().default('custom'), // company | saas | school | custom
  mission: text('mission'),
  template: text('template'),
  ownerKind: text('owner_kind').notNull().default('user'), // user | service
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// P3 — base de connaissances propre à un open-space = organisation (RAG scopé par `space`).
// `embedding_vec` (vector(1024)) est géré en RAW SQL (pgvector), pas déclaré ici.
export const companionSpaceKnowledge = pgTable('companion_space_knowledge', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  space: text('space').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const companionSpaceKnowledgeChunks = pgTable('companion_space_knowledge_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeId: uuid('knowledge_id').notNull(),
  profileId: uuid('profile_id').notNull(),
  space: text('space').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  startOffset: integer('start_offset').notNull(),
  endOffset: integer('end_offset').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Mémoire de conversation des compagnons-agents (le compagnon se souvient).
export const companionMessages = pgTable('companion_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  agentId: uuid('agent_id').notNull(),
  sender: text('sender').notNull(), // 'me' | 'agent'
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Mémoire universelle : journal append-only des événements significatifs, indépendant des sessions IA.
export const hiveEvents = pgTable('hive_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  actorAgentId: uuid('actor_agent_id'),
  subjectAgentId: uuid('subject_agent_id'),
  space: text('space'),
  kind: text('kind').notNull(),
  channel: text('channel').notNull().default('system'),
  visibility: text('visibility').notNull().default('private'),
  importance: real('importance').notNull().default(0.5),
  content: text('content').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Passage de relais traçable entre compagnons/services.
export const hiveHandoffs = pgTable('hive_handoffs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  fromAgentId: uuid('from_agent_id'),
  toAgentId: uuid('to_agent_id'),
  targetSpace: text('target_space'),
  originalRequest: text('original_request').notNull(),
  summarizedContext: text('summarized_context').notNull().default(''),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  urgency: text('urgency').notNull().default('normal'),
  permissions: jsonb('permissions').notNull().default('{}'),
  expectedNextAction: text('expected_next_action'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Représentation d'un événement dans un canal humain donné.
export const hiveDeliveries = pgTable('hive_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  eventId: uuid('event_id').notNull(),
  companionId: uuid('companion_id'),
  channel: text('channel').notNull(),
  renderedContent: text('rendered_content').notNull(),
  status: text('status').notNull().default('queued'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
});

export const hiveMemoryPolicies = pgTable('hive_memory_policies', {
  profileId: uuid('profile_id').primaryKey(),
  crossSpaceEnabled: boolean('cross_space_enabled').notNull().default(false),
  personalDataEnabled: boolean('personal_data_enabled').notNull().default(false),
  proactiveMemoryEnabled: boolean('proactive_memory_enabled').notNull().default(true),
  retentionDays: integer('retention_days'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveMemories = pgTable('hive_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  scope: text('scope').notNull().default('profile'),
  scopeId: text('scope_id'),
  category: text('category').notNull(),
  content: text('content').notNull(),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  confidence: real('confidence').notNull().default(0.7),
  status: text('status').notNull().default('active'),
  memoryKey: text('memory_key'),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validTo: timestamp('valid_to', { withTimezone: true }),
  supersedesId: uuid('supersedes_id'),
  entities: jsonb('entities').notNull().default([]),
  metadata: jsonb('metadata').notNull().default('{}'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveCapabilities = pgTable('hive_capabilities', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  key: text('key').notNull(),
  label: text('label').notNull(),
  description: text('description').notNull().default(''),
  modality: text('modality').notNull().default('text'),
  risk: text('risk').notNull().default('low'),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveCapabilityBindings = pgTable('hive_capability_bindings', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  capabilityId: uuid('capability_id').notNull(),
  subjectKind: text('subject_kind').notNull(),
  subjectId: text('subject_id').notNull(),
  proficiency: real('proficiency').notNull().default(0.7),
  enabled: boolean('enabled').notNull().default(true),
  constraints: jsonb('constraints').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveVaultItems = pgTable('hive_vault_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  space: text('space'),
  label: text('label').notNull(),
  kind: text('kind').notNull().default('secret'),
  ciphertext: text('ciphertext').notNull(),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveAccessRequests = pgTable('hive_access_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  vaultItemId: uuid('vault_item_id').notNull(),
  requesterAgentId: uuid('requester_agent_id'),
  purpose: text('purpose').notNull(),
  requestedSeconds: integer('requested_seconds').notNull(),
  status: text('status').notNull().default('pending'),
  decisionReason: text('decision_reason'),
  tokenHash: text('token_hash'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveRuntimes = pgTable('hive_runtimes', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  name: text('name').notNull(),
  model: text('model').notNull(),
  harness: text('harness').notNull(),
  adapter: text('adapter').notNull(),
  modalities: text('modalities').array().notNull().default(['text']),
  capabilities: text('capabilities').array().notNull().default([]),
  quality: real('quality').notNull().default(0.7),
  cost: real('cost').notNull().default(0.5),
  latency: real('latency').notNull().default(0.5),
  privacy: text('privacy').notNull().default('public_cloud'),
  entitlement: text('entitlement').notNull().default('metered'),
  enabled: boolean('enabled').notNull().default(true),
  configuration: jsonb('configuration').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveEpisodes = pgTable('hive_episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  fingerprint: text('fingerprint').notNull(),
  space: text('space'),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveMemoryRelations = pgTable('hive_memory_relations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  sourceHandoffId: uuid('source_handoff_id'),
  subjectKind: text('subject_kind').notNull(),
  subjectId: text('subject_id'),
  predicate: text('predicate').notNull(),
  objectKind: text('object_kind').notNull(),
  objectId: text('object_id'),
  description: text('description').notNull(),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveAttentionItems = pgTable('hive_attention_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  sourceEventId: uuid('source_event_id'),
  requesterAgentId: uuid('requester_agent_id'),
  kind: text('kind').notNull(),
  priority: text('priority').notNull().default('normal'),
  title: text('title').notNull(),
  details: text('details').notNull().default(''),
  options: jsonb('options').notNull().default([]),
  context: jsonb('context').notNull().default({}),
  status: text('status').notNull().default('open'),
  resolution: jsonb('resolution'),
  dueAt: timestamp('due_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveCompanionRelationships = pgTable('hive_companion_relationships', {
  agentId: uuid('agent_id').primaryKey(),
  profileId: uuid('profile_id').notNull(),
  affinity: real('affinity').notNull().default(0.3),
  trust: real('trust').notNull().default(0.3),
  familiarity: real('familiarity').notNull().default(0.1),
  interactionCount: integer('interaction_count').notNull().default(0),
  lastInteractionAt: timestamp('last_interaction_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveAssets = pgTable('hive_assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  space: text('space').notNull(),
  name: text('name').notNull(),
  assetType: text('asset_type').notNull(),
  visualKey: text('visual_key').notNull().default('serveur-informatique'),
  room: text('room'),
  position: jsonb('position'),
  endpoint: text('endpoint'),
  purpose: text('purpose').notNull().default(''),
  environment: text('environment').notNull().default('production'),
  status: text('status').notNull().default('unknown'),
  vaultItemId: uuid('vault_item_id'),
  metadata: jsonb('metadata').notNull().default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveRuns = pgTable('hive_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  rootEventId: uuid('root_event_id'),
  initiatorAgentId: uuid('initiator_agent_id'),
  objective: text('objective').notNull(),
  status: text('status').notNull().default('planning'),
  maxDepth: integer('max_depth').notNull().default(4),
  maxFanout: integer('max_fanout').notNull().default(3),
  maxTasks: integer('max_tasks').notNull().default(24),
  maxRuntimeSeconds: integer('max_runtime_seconds').notNull().default(900),
  maxCredits: integer('max_credits').notNull().default(100),
  usedCredits: integer('used_credits').notNull().default(0),
  deadlineAt: timestamp('deadline_at', { withTimezone: true }),
  usedTasks: integer('used_tasks').notNull().default(0),
  metadata: jsonb('metadata').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveTasks = pgTable('hive_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull(),
  profileId: uuid('profile_id').notNull(),
  parentTaskId: uuid('parent_task_id'),
  handoffId: uuid('handoff_id'),
  assignedAgentId: uuid('assigned_agent_id'),
  depth: integer('depth').notNull().default(0),
  sequence: integer('sequence').notNull().default(0),
  objective: text('objective').notNull(),
  context: jsonb('context').notNull().default({}),
  sourceEventIds: uuid('source_event_ids').array().notNull().default([]),
  status: text('status').notNull().default('pending'),
  output: text('output'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveUtterances = pgTable('hive_utterances', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  eventId: uuid('event_id').notNull(),
  deliveryId: uuid('delivery_id'),
  companionId: uuid('companion_id'),
  channel: text('channel').notNull(),
  intent: text('intent').notNull().default('inform'),
  facts: jsonb('facts').notNull().default([]),
  emotion: text('emotion').notNull().default('neutral'),
  confidence: real('confidence').notNull().default(0.7),
  prosody: jsonb('prosody').notNull().default({}),
  animation: text('animation'),
  state: text('state').notNull().default('ready'),
  interruptedAt: timestamp('interrupted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveCompanionStates = pgTable('hive_companion_states', {
  agentId: uuid('agent_id').primaryKey(),
  profileId: uuid('profile_id').notNull(),
  availability: text('availability').notNull().default('available'),
  activity: text('activity').notNull().default('idle'),
  relationshipState: text('relationship_state').notNull().default('neutral'),
  currentTaskId: uuid('current_task_id'),
  urgency: text('urgency').notNull().default('normal'),
  visualMood: text('visual_mood').notNull().default('neutral'),
  location: text('location'),
  metadata: jsonb('metadata').notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveComputeResources = pgTable('hive_compute_resources', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  assetId: uuid('asset_id'),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  locality: text('locality').notNull().default('local'),
  modalities: text('modalities').array().notNull().default(['text']),
  memoryMb: integer('memory_mb').notNull().default(0),
  acceleratorMemoryMb: integer('accelerator_memory_mb').notNull().default(0),
  maxConcurrency: integer('max_concurrency').notNull().default(1),
  activeAllocations: integer('active_allocations').notNull().default(0),
  costPerHour: real('cost_per_hour').notNull().default(0),
  health: text('health').notNull().default('unknown'),
  enabled: boolean('enabled').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveComputeAllocations = pgTable('hive_compute_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  resourceId: uuid('resource_id').notNull(),
  taskId: uuid('task_id').notNull(),
  status: text('status').notNull().default('reserved'),
  requirements: jsonb('requirements').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }),
  releasedAt: timestamp('released_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveSpacePackages = pgTable('hive_space_packages', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  version: text('version').notNull().default('1.0.0'),
  description: text('description').notNull().default(''),
  visibility: text('visibility').notNull().default('private'),
  manifest: jsonb('manifest').notNull(),
  checksum: text('checksum').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const hiveSpaceInstallations = pgTable('hive_space_installations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  packageId: uuid('package_id').notNull(),
  spaceId: uuid('space_id').notNull(),
  mode: text('mode').notNull(),
  installedVersion: text('installed_version').notNull(),
  configuration: jsonb('configuration').notNull().default({}),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
});

// Journal des fusions d'abeilles (traçabilité du « jardinage de la ruche »).
export const companionAgentMerges = pgTable('companion_agent_merges', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  survivorId: uuid('survivor_id').notNull(),
  absorbedId: uuid('absorbed_id').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relais Claude Code / Codex : jetons Bearer que l'utilisateur colle dans SON Claude Code (serveur MCP Dowze).
// Le relais parle à Dowze via l'abonnement de l'utilisateur (100 % CGU) : c'est ML qui se connecte à nous, pas l'inverse.
export const companionRelayTokens = pgTable('companion_relay_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  tokenHash: text('token_hash').notNull().unique(), // sha256(token) — le token en clair n'est montré qu'une fois
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
});

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  kind: text('kind').notNull(),
  depth: integer('depth').notNull(),
  isRoot: boolean('is_root').notNull().default(false),
  rank: integer('rank'),
  epistemicStatus: text('epistemic_status').notNull().default('etabli'),
  halfLifeYears: doublePrecision('half_life_years'),
  masteryThreshold: doublePrecision('mastery_threshold').notNull().default(0.95),
  sources: text('sources').array().notNull().default([]),
  curriculumOrder: integer('curriculum_order'),
  embedding: real('embedding').array(),
});

export const prerequisites = pgTable(
  'prerequisites',
  {
    skillId: uuid('skill_id').notNull(),
    prerequisiteId: uuid('prerequisite_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.prerequisiteId] }) }),
);

export const masteryStates = pgTable(
  'mastery_states',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    pMastery: doublePrecision('p_mastery').notNull().default(0.1),
    attempts: integer('attempts').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    lastUpdated: timestamp('last_updated', { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId] }) }),
);

/** Idempotence des clôtures de cours natif : UNE clôture par (profil, compétence, jour) — le double-clic
 *  ou le retry réseau ne doit plus produire une double observation BKT + double FSRS (audit 08-2026). */
export const courseClosures = pgTable(
  'course_closures',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    closureDate: date('closure_date').notNull(),
    outcome: text('outcome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId, t.closureDate] }) }),
);

export const sm2Cards = pgTable(
  'sm2_cards',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    repetitions: integer('repetitions').notNull().default(0),
    easeFactor: doublePrecision('ease_factor').notNull().default(2.5),
    intervalDays: integer('interval_days').notNull().default(0),
    dueDate: timestamp('due_date', { withTimezone: true }),
    lastReviewed: timestamp('last_reviewed', { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId] }) }),
);

export const availabilitySlots = pgTable('availability_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  dayOfWeek: smallint('day_of_week').notNull(),
  startMinute: smallint('start_minute').notNull(),
  durationMin: smallint('duration_min').notNull(),
});

export const planningEntries = pgTable('planning_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  kind: text('kind').notNull(),
  skillId: uuid('skill_id'),
  expeditionId: uuid('expedition_id'),
  durationMin: smallint('duration_min').notNull(),
  status: text('status').notNull().default('prevu'),
});

export const rubrics = pgTable('rubrics', {
  skillId: uuid('skill_id').primaryKey(),
});

export const rubricCriteria = pgTable(
  'rubric_criteria',
  {
    skillId: uuid('skill_id').notNull(),
    id: text('id').notNull(),
    label: text('label').notNull(),
    description: text('description').notNull().default(''),
    required: boolean('required').notNull().default(true),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.id] }) }),
);

export const validations = pgTable('validations', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull(),
  learnerId: uuid('learner_id').notNull(),
  tier: text('tier').notNull(),
  reviewerId: uuid('reviewer_id'),
  passed: boolean('passed').notNull(),
  evidenceUrl: text('evidence_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const validationVerdicts = pgTable(
  'validation_verdicts',
  {
    validationId: uuid('validation_id').notNull(),
    criterionId: text('criterion_id').notNull(),
    met: boolean('met').notNull(),
    comment: text('comment').notNull().default(''),
  },
  (t) => ({ pk: primaryKey({ columns: [t.validationId, t.criterionId] }) }),
);

export const peerReviewQueue = pgTable('peer_review_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull(),
  learnerId: uuid('learner_id').notNull(),
  evidenceUrl: text('evidence_url'),
  claimedBy: uuid('claimed_by'),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  locale: text('locale').notNull(),
  timezone: text('timezone').notNull(),
  type: text('type').notNull(),
  cycle: text('cycle').notNull().default('trimestre'),
  status: text('status').notNull().default('active'),
  level: integer('level').notNull().default(1), // rang/niveau (learner_rank.rank)
  primaryLang: text('primary_lang').notNull().default('fr'),
  isMultilingual: boolean('is_multilingual').notNull().default(false),
  schoolYear: integer('school_year').notNull().default(0),
  targetLang: text('target_lang'), // langue cible pour les classes de langue (type='language'), sinon null
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  'memberships',
  {
    classeId: uuid('classe_id').notNull(),
    profileId: uuid('profile_id').notNull(),
    role: text('role').notNull().default('membre'),
    schoolYear: integer('school_year').notNull().default(0),
    assignmentReason: text('assignment_reason').notNull().default(''),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.classeId, t.profileId] }) }),
);

export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull(),
  classeId: uuid('classe_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull(),
  authorId: uuid('author_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expeditions = pgTable('expeditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  grandeQuestion: text('grande_question').notNull(),
  durationWeeks: smallint('duration_weeks').notNull().default(3),
  phase: text('phase').notNull().default('etincelle'),
  status: text('status').notNull().default('proposee'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expeditionSkills = pgTable(
  'expedition_skills',
  {
    expeditionId: uuid('expedition_id').notNull(),
    skillId: uuid('skill_id').notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.expeditionId, t.skillId] }) }),
);

export const carnetEntries = pgTable('carnet_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  skillId: uuid('skill_id'),
  note: text('note').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  embedding: real('embedding').array(),
});

export const aiModel = pgTable('ai_model', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  label: text('label').notNull(),
  priceIn: doublePrecision('price_in').notNull(),
  priceOut: doublePrecision('price_out').notNull(),
  strict: boolean('strict').notNull().default(false),
  euHosted: boolean('eu_hosted').notNull().default(false),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(100),
  note: text('note').notNull().default(''),
  billingUrl: text('billing_url').notNull().default(''),
});

export const aiEmbeddingModel = pgTable('ai_embedding_model', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(),
  label: text('label').notNull(),
  pricePerM: doublePrecision('price_per_m').notNull(),
  dimensions: integer('dimensions').notNull(),
  contextMax: integer('context_max').notNull(),
  euHosted: boolean('eu_hosted').notNull().default(false),
  multilingual: boolean('multilingual').notNull().default(true),
  active: boolean('active').notNull().default(true),
  sort: integer('sort').notNull().default(100),
  note: text('note').notNull().default(''),
  billingUrl: text('billing_url').notNull().default(''),
});

export const copiloteSettings = pgTable('copilote_settings', {
  profileId: uuid('profile_id').primaryKey(),
  modelId: text('model_id').notNull().default('gpt-4o-mini'),
  billing: text('billing').notNull().default('credits'),
  byokProvider: text('byok_provider'),
  byokKeyEnc: text('byok_key_enc'),
  embeddingModelId: text('embedding_model_id'),
  embeddingProvider: text('embedding_provider'),
  embeddingKeyEnc: text('embedding_key_enc'),
  lowcostModelId: text('lowcost_model_id'), // modèle LowCost pour la traduction (null = réutilise l'IA principale)
  ollamaModel: text('ollama_model'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Requêtes d'inférence remises au connecteur Dowze Desktop du propriétaire. */
export const localAiJobs = pgTable('local_ai_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  payload: jsonb('payload').notNull(),
  status: text('status').notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const companionVoiceSettings = pgTable('companion_voice_settings', {
  accountId: uuid('account_id').primaryKey(),
  sttProvider: text('stt_provider').notNull().default('browser'),
  sttModel: text('stt_model').notNull().default('gpt-4o-mini-transcribe'),
  ttsProvider: text('tts_provider').notNull().default('browser'),
  ttsModel: text('tts_model').notNull().default('gpt-4o-mini-tts'),
  voiceId: text('voice_id').notNull().default('marin'),
  localSttModel: text('local_stt_model').notNull().default('Systran/faster-whisper-small'),
  localTtsModel: text('local_tts_model').notNull().default('speaches-ai/Kokoro-82M-v1.0-ONNX'),
  localVoiceId: text('local_voice_id').notNull().default('ff_siwis'),
  openaiKeyEnc: text('openai_key_enc'),
  elevenlabsKeyEnc: text('elevenlabs_key_enc'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const creditBalances = pgTable('credit_balances', {
  profileId: uuid('profile_id').primaryKey(),
  balance: doublePrecision('balance').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const creditLedger = pgTable('credit_ledger', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  delta: doublePrecision('delta').notNull(),
  reason: text('reason').notNull(),
  ref: text('ref'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const fsrsCards = pgTable(
  'fsrs_cards',
  {
    profileId: uuid('profile_id').notNull(),
    skillId: uuid('skill_id').notNull(),
    due: timestamp('due', { withTimezone: true }).notNull(),
    stability: doublePrecision('stability').notNull().default(0),
    difficulty: doublePrecision('difficulty').notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: smallint('state').notNull().default(0),
    lastReview: timestamp('last_review', { withTimezone: true }),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.skillId] }) }),
);

export const learnerMisconceptions = pgTable('learner_misconceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  skillId: uuid('skill_id').notNull(),
  label: text('label').notNull(),
  status: text('status').notNull().default('active'),
  occurrences: integer('occurrences').notNull().default(1),
  firstSeen: timestamp('first_seen', { withTimezone: true }).notNull().defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  embedding: real('embedding').array(),
});

export const guardians = pgTable('guardians', {
  id: uuid('id').primaryKey().defaultRandom(),
  minorAccountId: uuid('minor_account_id').notNull(), // compte "supervisé" (enfant/mineur/adulte lié)
  email: text('email').notNull(), // email du parent / contact de confiance
  consentStatus: text('consent_status').notNull().default('en-attente'),
  consentAt: timestamp('consent_at', { withTimezone: true }),
  hasDashboardAccount: boolean('has_dashboard_account').notNull().default(false),
  supervised: boolean('supervised').notNull().default(false), // mode supervisé (validation parentale de chaque message/ami)
  guardianAccountId: uuid('guardian_account_id'), // le compte du parent une fois lié (auto-liaison)
  tier: text('tier').notNull().default('mineur'), // enfant | mineur | majeur
  childConfirmedAt: timestamp('child_confirmed_at', { withTimezone: true }),
  parentConfirmedAt: timestamp('parent_confirmed_at', { withTimezone: true }),
  inviteToken: text('invite_token'),
  inviteExpiresAt: timestamp('invite_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moderationIncidents = pgTable('moderation_incidents', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: text('source').notNull(),
  severity: text('severity').notNull(),
  contentRef: text('content_ref').notNull(),
  authorId: uuid('author_id'),
  victimId: uuid('victim_id'),
  status: text('status').notNull().default('ouvert'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  incidentId: uuid('incident_id').notNull(),
  actorId: uuid('actor_id').notNull(),
  kind: text('kind').notNull(),
  reason: text('reason').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const parentalAlerts = pgTable('parental_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  minorAccountId: uuid('minor_account_id').notNull(),
  guardianEmail: text('guardian_email').notNull(),
  incidentId: uuid('incident_id'),
  severity: text('severity').notNull(),
  reason: text('reason').notNull(),
  humanValidated: boolean('human_validated').notNull().default(false),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Dossier élève : modèle d'apprenant extrait de la présentation (Open Learner Model).
export const learnerDossiers = pgTable('learner_dossiers', {
  profileId: uuid('profile_id').primaryKey(),
  rawPresentation: text('raw_presentation').notNull().default(''),
  structured: jsonb('structured').notNull(),
  validated: boolean('validated').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Test de placement adaptatif : état de la session (historique + bornes) en jsonb.
export const placementSessions = pgTable('placement_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  state: jsonb('state').notNull(),
  status: text('status').notNull().default('en-cours'),
  entrySkillId: uuid('entry_skill_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Items d'exercices générés (cache réutilisable).
export const exerciseItems = pgTable('exercise_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  skillId: uuid('skill_id').notNull(),
  type: text('type').notNull(),
  payload: jsonb('payload').notNull(),
  sourceRef: text('source_ref').notNull().default(''),
  difficulty: integer('difficulty'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tests de révision (hebdo / trimestriel) + tentatives (formatif, sans note de maîtrise).
export const tests = pgTable('tests', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  kind: text('kind').notNull().default('weekly'),
  items: jsonb('items').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const testAttempts = pgTable('test_attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  testId: uuid('test_id').notNull(),
  profileId: uuid('profile_id').notNull(),
  total: integer('total').notNull().default(0),
  correct: integer('correct').notNull().default(0),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow(),
});

// Expéditions guidées par élève + notes de phase (guidage IA + bilan).
export const learnerExpeditions = pgTable('learner_expeditions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  title: text('title').notNull(),
  grandeQuestion: text('grande_question').notNull(),
  produit: text('produit').notNull().default(''),
  phase: text('phase').notNull().default('etincelle'),
  status: text('status').notNull().default('en-cours'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const expeditionPhaseNotes = pgTable('expedition_phase_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  learnerExpeditionId: uuid('learner_expedition_id').notNull(),
  phase: text('phase').notNull(),
  guidance: jsonb('guidance'),
  bilan: text('bilan'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Progression de rang « compétitive » : le rang courant est un état (montée acceptée), + choix élève/parent.
export const learnerRank = pgTable('learner_rank', {
  profileId: uuid('profile_id').primaryKey(),
  rank: smallint('rank').notNull().default(1),
  rrPoints: doublePrecision('rr_points').notNull().default(0),
  rankStartedAt: timestamp('rank_started_at', { withTimezone: true }).notNull().defaultNow(),
  studentChoice: text('student_choice'),
  parentChoice: text('parent_choice'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// « Saut de Rang » : mois intensif pour franchir un rang plus vite (éligibilité + programme 28 j + 80 %).
export const rankJumps = pgTable('rank_jumps', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  fromRank: smallint('from_rank').notNull(),
  targetRank: smallint('target_rank').notNull(),
  status: text('status').notNull().default('in-progress'),
  eligibilityScore: smallint('eligibility_score').notNull().default(0),
  currentDay: smallint('current_day').notNull().default(1),
  plan: jsonb('plan').notNull(),
  lastDayAt: timestamp('last_day_at', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Spécialisation : directions choisies par l'élève (réversible, plusieurs possibles).
export const specializations = pgTable('specializations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  discipline: text('discipline').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// B1 : plan de spécialisation (jalons/projets généré par l'IA). B4 : badges. A4 : re-tests espacés.
export const specializationPlans = pgTable('specialization_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  discipline: text('discipline').notNull(),
  distalGoal: text('distal_goal').notNull().default(''),
  milestones: jsonb('milestones').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const learnerBadges = pgTable('learner_badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  name: text('name').notNull(),
  discipline: text('discipline').notNull().default(''),
  criteria: text('criteria').notNull().default(''),
  milestoneId: text('milestone_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const retentionCheckpoints = pgTable('retention_checkpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  rank: smallint('rank').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('due'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// A1 : pré-tests above-level. A3 : check-ins bien-être. (C1 = colonne rr_points ajoutée à learnerRank.)
export const rankJumpPretests = pgTable(
  'rank_jump_pretests',
  {
    profileId: uuid('profile_id').notNull(),
    targetRank: smallint('target_rank').notNull(),
    score: doublePrecision('score').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.targetRank] }) }),
);

export const wellbeingCheckins = pgTable('wellbeing_checkins', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  kind: text('kind').notNull(),
  score: doublePrecision('score').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Niveau & XP (engagement, monotone). Validation par les pairs (sujets + évaluations).
export const learnerXp = pgTable('learner_xp', {
  profileId: uuid('profile_id').primaryKey(),
  xp: integer('xp').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  lastLoginDate: date('last_login_date'),
  xpToday: integer('xp_today').notNull().default(0),
  activeSecondsToday: integer('active_seconds_today').notNull().default(0),
  today: date('today'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const validationSubjects = pgTable('validation_subjects', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  evidenceUrl: text('evidence_url'),
  format: text('format').notNull().default('visio'),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  validatedAt: timestamp('validated_at', { withTimezone: true }),
});

export const validationReviews = pgTable('validation_reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectId: uuid('subject_id').notNull(),
  reviewerId: uuid('reviewer_id').notNull(),
  validated: boolean('validated').notNull(),
  stars: smallint('stars').notNull(),
  comment: text('comment').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Profs agréés : demande d'accréditation (vérification humaine).
export const teacherApplications = pgTable('teacher_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull(),
  background: text('background').notNull(),
  whereTeaching: text('where_teaching').notNull().default(''),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Système ÉCHANGER — Phase A : amis + messagerie (doc 26) ============
// Amitié symétrique, une seule ligne par paire (user_low < user_high).
export const friendships = pgTable(
  'friendships',
  {
    userLow: uuid('user_low').notNull(),
    userHigh: uuid('user_high').notNull(),
    requestedBy: uuid('requested_by').notNull(),
    status: text('status').notNull().default('pending'), // pending | accepted | blocked
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userLow, t.userHigh] }) }),
);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type').notNull(), // direct | group | class_channel
  classId: uuid('class_id'),
  name: text('name'),
  createdBy: uuid('created_by'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const conversationParticipants = pgTable(
  'conversation_participants',
  {
    conversationId: uuid('conversation_id').notNull(),
    profileId: uuid('profile_id').notNull(),
    role: text('role').notNull().default('member'), // member | admin
    lastReadMessageId: uuid('last_read_message_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.conversationId, t.profileId] }) }),
);

// Nommée chat_messages pour ne pas entrer en collision avec l'ancienne table `messages`
// (design community channels/messages). Voir doc 26.
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull(),
  senderId: uuid('sender_id').notNull(),
  body: text('body').notNull().default(''),
  kind: text('kind').notNull().default('text'), // text | image | file | subject_share
  meta: jsonb('meta'),
  status: text('status').notNull().default('active'), // active | anonymized
  holdState: text('hold_state').notNull().default('clear'), // clear | held_out (mode supervisé)
  auditHash: text('audit_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Système ÉCHANGER — Phase D : protections (doc 26 §7) ============
export const blocks = pgTable(
  'blocks',
  {
    blockerId: uuid('blocker_id').notNull(),
    blockedId: uuid('blocked_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.blockerId, t.blockedId] }) }),
);

export const userReports = pgTable('user_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporterId: uuid('reporter_id').notNull(),
  reportedId: uuid('reported_id').notNull(),
  reason: text('reason').notNull(),
  conversationId: uuid('conversation_id'),
  status: text('status').notNull().default('open'), // open | reviewing | resolved
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolverId: uuid('resolver_id'),
});

export const resetRequests = pgTable('reset_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  scope: text('scope').notNull().default('messages'), // messages | account
  requestedBy: text('requested_by').notNull(), // self | parent
  requesterRef: text('requester_ref').notNull().default(''),
  status: text('status').notNull().default('pending_moderator'), // pending_parent | pending_moderator | approved | rejected
  parentApprovedAt: timestamp('parent_approved_at', { withTimezone: true }),
  moderatorId: uuid('moderator_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const supervisionItems = pgTable('supervision_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  childProfileId: uuid('child_profile_id').notNull(),
  childAccountId: uuid('child_account_id').notNull(),
  direction: text('direction').notNull(), // in | out
  kind: text('kind').notNull(), // message | friend_request
  messageId: uuid('message_id'),
  friendTargetId: uuid('friend_target_id'),
  status: text('status').notNull().default('pending'), // pending | approved | rejected
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

// ============ Cours de langue « Parler » (migration 0041) ============
export const learnerLanguages = pgTable(
  'learner_languages',
  {
    profileId: uuid('profile_id').notNull(),
    lang: text('lang').notNull(),
    status: text('status').notNull().default('active'), // active | maintenance
    level: real('level').notNull().default(0), // 0→5 ≈ A1=1..C1=5, suivi PAR LANGUE
    reasonPitch: text('reason_pitch').notNull().default(''),
    streak: integer('streak').notNull().default(0),
    lastPracticeDate: date('last_practice_date'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.profileId, t.lang] }) }),
);

export const languageActivity = pgTable('language_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  lang: text('lang').notNull(),
  activityDate: date('activity_date').notNull(),
  kind: text('kind').notNull().default('session'), // session | maintenance
  minutes: integer('minutes').notNull().default(0),
  score: real('score'),
  summary: text('summary').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Cours secondaire « Ma passion » (migration 0042) ============
export const electives = pgTable('electives', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().unique(),
  label: text('label').notNull(),
  disciplineHint: text('discipline_hint').notNull().default(''),
  mode: text('mode').notNull().default('plaisir'), // plaisir | pro
  status: text('status').notNull().default('active'), // active | change_pending
  chosenAt: timestamp('chosen_at', { withTimezone: true }).notNull().defaultNow(),
  commitUntil: timestamp('commit_until', { withTimezone: true }),
  changeTarget: text('change_target'),
  changeProposedAt: timestamp('change_proposed_at', { withTimezone: true }),
  changeConfirmAt: timestamp('change_confirm_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const electiveDiscovery = pgTable('elective_discovery', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  round: integer('round').notNull().default(1),
  disciplines: jsonb('disciplines').notNull(),
  currentIndex: integer('current_index').notNull().default(0),
  weekStartedAt: timestamp('week_started_at', { withTimezone: true }).notNull().defaultNow(),
  status: text('status').notNull().default('active'), // active | done
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const electiveJournal = pgTable('elective_journal', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  discoveryId: uuid('discovery_id'),
  discipline: text('discipline').notNull(),
  entryDate: date('entry_date').notNull(),
  did: text('did').notNull().default(''),
  liked: text('liked').notNull().default(''),
  disliked: text('disliked').notNull().default(''),
  intensity: smallint('intensity').notNull().default(3),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const electivePlans = pgTable('elective_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  label: text('label').notNull(),
  distalGoal: text('distal_goal').notNull().default(''),
  paths: jsonb('paths').notNull().default([]),
  baseRate: text('base_rate').notNull().default(''),
  milestones: jsonb('milestones').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Planning — profil de disponibilité + vacances (migration 0044) ============
export const learnerSchedule = pgTable('learner_schedule', {
  profileId: uuid('profile_id').primaryKey(),
  preset: text('preset').notNull().default('leger'),
  activeDays: integer('active_days').array().notNull().default([1, 2, 3, 4, 5]),
  dayStartMin: integer('day_start_min').notNull().default(480),
  dayEndMin: integer('day_end_min').notNull().default(1080),
  intensity: text('intensity').notNull().default('moyen'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scheduleVacations = pgTable('schedule_vacations', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  label: text('label').notNull().default('Vacances'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Système ÉCHANGER — Phase D+ : IA de modération (doc 26 §7.3) ============
export const aiModerationFlags = pgTable('ai_moderation_flags', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull(),
  authorId: uuid('author_id').notNull(),
  conversationId: uuid('conversation_id').notNull(),
  category: text('category').notNull(),
  reason: text('reason').notNull(),
  severity: text('severity').notNull().default('moyen'),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolverId: uuid('resolver_id'),
});

// ============ Plateforme de PLUGINS (P1) — registre & activation (cf. docs/12-PLUGINS) ============
export const pluginRegistry = pgTable('plugin_registry', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  subdomain: text('subdomain').notNull().unique(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('draft'), // draft|active|deprecated|disabled
  manifestVersion: text('manifest_version').notNull().default('1'),
  apiVersion: text('api_version').notNull().default('v1'),
  minCoreVersion: text('min_core_version').notNull().default('3.0.0'),
  scopesRequested: text('scopes_requested').array().notNull().default([]),
  scopesOptional: text('scopes_optional').array().notNull().default([]),
  contributes: jsonb('contributes').notNull().default({}),
  subscribes: text('subscribes').array().notNull().default([]),
  configSchema: jsonb('config_schema').notNull().default({}),
  clientSecretHash: text('client_secret_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const userPluginActivation = pgTable('user_plugin_activation', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  pluginId: uuid('plugin_id').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  grantedScopes: text('granted_scopes').array().notNull().default([]),
  config: jsonb('config').notNull().default({}),
  activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ============ Contribution au planning (P2) — activités récurrentes & entrées ponctuelles ============
export const recurringCommitments = pgTable('recurring_commitments', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  sourceApp: text('source_app').notNull(),
  sourceRef: text('source_ref').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  frequencyPerWeek: integer('frequency_per_week').notNull().default(3),
  durationMin: integer('duration_min').notNull().default(50),
  intensity: text('intensity').notNull().default('moderee'),
  hardConstraints: jsonb('hard_constraints').notNull().default({}),
  softPreferences: jsonb('soft_preferences').notNull().default({}),
  priority: integer('priority').notNull().default(50),
  missPolicy: jsonb('miss_policy').notNull().default({ catchUp: true, windowDays: 3 }),
  adherenceMetric: text('adherence_metric').notNull().default('rolling-regularity'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const calendarEntries = pgTable('calendar_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull(),
  sourceApp: text('source_app').notNull(),
  sourceRef: text('source_ref').notNull(),
  entryType: text('entry_type').notNull(),
  title: text('title').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  durationMin: integer('duration_min').notNull().default(60),
  scope: text('scope').notNull().default('calendar:write'),
  status: text('status').notNull().default('confirmed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
