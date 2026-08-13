import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/drizzle.module';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { decryptSecret, encryptSecret } from '../copilote/crypto.util';
import { CopiloteService } from '../copilote/copilote.service';
import {
  accounts,
  profiles,
  companionAgents,
  companionMessages,
  companionSpaces,
  hiveEvents,
  hiveHandoffs,
  hiveDeliveries,
  hiveMemoryPolicies,
  hiveMemories,
  hiveVaultItems,
  hiveAccessRequests,
  hiveEpisodes,
  hiveMemoryRelations,
  hiveAttentionItems,
  hiveCompanionRelationships,
  hiveAssets,
  hiveRuns,
  hiveTasks,
  hiveCapabilities,
  hiveCapabilityBindings,
  hiveRuntimes,
  hiveUtterances,
  hiveCompanionStates,
  hiveComputeResources,
} from '../db/schema';
import {
  canCreateHiveTask,
  communicationFrame,
  renderForChannel,
  type HiveChannel,
  type HiveCommunicationFrame,
} from './hive-domain';

export interface HiveEventInput {
  kind: string;
  content: string;
  channel?: HiveChannel;
  actorAgentId?: string;
  subjectAgentId?: string;
  space?: string;
  visibility?: 'private' | 'space' | 'shared';
  importance?: number;
  metadata?: Record<string, unknown>;
  sourceEventIds?: string[];
}

@Injectable()
export class HiveContinuityService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(ENV) private readonly env: Env,
    private readonly copilote: CopiloteService,
  ) {}

  async createRunForProfile(
    profileId: string,
    input: {
      objective: string;
      rootEventId?: string;
      initiatorAgentId?: string;
      maxDepth?: number;
      maxFanout?: number;
      maxTasks?: number;
      maxRuntimeSeconds?: number;
      maxCredits?: number;
      deadlineAt?: Date;
      metadata?: Record<string, unknown>;
    },
  ) {
    return (
      await this.db
        .insert(hiveRuns)
        .values({
          profileId,
          objective: input.objective.slice(0, 12_000),
          rootEventId: input.rootEventId,
          initiatorAgentId: input.initiatorAgentId,
          status: 'running',
          maxDepth: Math.max(1, Math.min(12, input.maxDepth ?? 4)),
          maxFanout: Math.max(1, Math.min(20, input.maxFanout ?? 3)),
          maxTasks: Math.max(1, Math.min(500, input.maxTasks ?? 24)),
          maxRuntimeSeconds: Math.max(10, Math.min(86_400, input.maxRuntimeSeconds ?? 900)),
          maxCredits: Math.max(0, Math.min(10_000_000, input.maxCredits ?? 100)),
          deadlineAt:
            input.deadlineAt ?? new Date(Date.now() + (input.maxRuntimeSeconds ?? 900) * 1000),
          metadata: input.metadata ?? {},
          startedAt: new Date(),
        })
        .returning()
    )[0]!;
  }

  async createRunTaskForProfile(
    profileId: string,
    input: {
      runId: string;
      parentTaskId?: string;
      handoffId?: string;
      assignedAgentId?: string;
      depth?: number;
      sequence?: number;
      objective: string;
      context?: Record<string, unknown>;
      sourceEventIds?: string[];
    },
  ) {
    const run = (
      await this.db
        .select()
        .from(hiveRuns)
        .where(and(eq(hiveRuns.id, input.runId), eq(hiveRuns.profileId, profileId)))
    )[0];
    if (!run) throw new NotFoundException('Exécution Ruche introuvable.');
    const depth = input.depth ?? 0;
    if (run.status !== 'running')
      throw new BadRequestException("Cette exécution n'est plus active.");
    if (run.deadlineAt && run.deadlineAt <= new Date())
      throw new BadRequestException("L'échéance de cette exécution est dépassée.");
    if (run.usedCredits >= run.maxCredits)
      throw new BadRequestException('Budget de crédits épuisé.');
    const siblings = await this.db
      .select({ id: hiveTasks.id })
      .from(hiveTasks)
      .where(
        input.parentTaskId
          ? and(eq(hiveTasks.runId, run.id), eq(hiveTasks.parentTaskId, input.parentTaskId))
          : and(eq(hiveTasks.runId, run.id), sql`${hiveTasks.parentTaskId} is null`),
      );
    const decision = canCreateHiveTask(
      {
        maxDepth: run.maxDepth,
        maxFanout: run.maxFanout,
        maxTasks: run.maxTasks,
        usedTasks: run.usedTasks,
      },
      { depth, siblingCount: siblings.length },
    );
    if (!decision.allowed) {
      const reason = {
        max_depth: 'Profondeur maximale atteinte.',
        max_fanout: 'Fan-out maximal atteint.',
        max_tasks: 'Budget de tâches épuisé.',
      }[decision.reason];
      throw new BadRequestException(reason);
    }
    const task = (
      await this.db
        .insert(hiveTasks)
        .values({
          profileId,
          runId: run.id,
          parentTaskId: input.parentTaskId,
          handoffId: input.handoffId,
          assignedAgentId: input.assignedAgentId,
          depth,
          sequence: input.sequence ?? siblings.length,
          objective: input.objective.slice(0, 12_000),
          context: input.context ?? {},
          sourceEventIds: input.sourceEventIds ?? [],
        })
        .returning()
    )[0]!;
    await this.db
      .update(hiveRuns)
      .set({ usedTasks: sql`${hiveRuns.usedTasks} + 1`, updatedAt: new Date() })
      .where(eq(hiveRuns.id, run.id));
    return task;
  }

  async transitionRunTaskForProfile(
    profileId: string,
    id: string,
    status: 'accepted' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled',
    output?: string,
    error?: string,
  ) {
    const now = new Date();
    const row = (
      await this.db
        .update(hiveTasks)
        .set({
          status,
          output: output?.slice(0, 20_000),
          error: error?.slice(0, 4000),
          startedAt: ['accepted', 'running'].includes(status) ? now : undefined,
          completedAt: ['completed', 'failed', 'cancelled'].includes(status) ? now : undefined,
          updatedAt: now,
        })
        .where(and(eq(hiveTasks.id, id), eq(hiveTasks.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Tâche Ruche introuvable.');
    if (row.assignedAgentId) {
      const active = ['accepted', 'running', 'waiting_approval'].includes(status);
      await this.db
        .insert(hiveCompanionStates)
        .values({
          profileId,
          agentId: row.assignedAgentId,
          availability: active ? 'busy' : 'available',
          activity: active ? row.objective.slice(0, 240) : 'idle',
          currentTaskId: active ? row.id : null,
          visualMood: status === 'failed' ? 'concerned' : active ? 'focused' : 'happy',
          location: active ? 'desk' : null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: hiveCompanionStates.agentId,
          set: {
            availability: active ? 'busy' : 'available',
            activity: active ? row.objective.slice(0, 240) : 'idle',
            currentTaskId: active ? row.id : null,
            visualMood: status === 'failed' ? 'concerned' : active ? 'focused' : 'happy',
            location: active ? 'desk' : null,
            updatedAt: now,
          },
        })
        .catch(() => undefined);
    }
    return row;
  }

  async completeRunForProfile(
    profileId: string,
    id: string,
    status: 'completed' | 'failed' | 'cancelled' | 'waiting_approval',
    metadata: Record<string, unknown> = {},
  ) {
    const now = new Date();
    const current = (
      await this.db
        .select()
        .from(hiveRuns)
        .where(and(eq(hiveRuns.id, id), eq(hiveRuns.profileId, profileId)))
    )[0];
    if (!current) throw new NotFoundException('Exécution Ruche introuvable.');
    if (current.status === 'failed' && status === 'completed') return current;
    const row = (
      await this.db
        .update(hiveRuns)
        .set({
          status,
          metadata,
          completedAt: status === 'waiting_approval' ? undefined : now,
          updatedAt: now,
        })
        .where(and(eq(hiveRuns.id, id), eq(hiveRuns.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Exécution Ruche introuvable.');
    return row;
  }

  async chargeRunForProfile(profileId: string, id: string, credits: number) {
    if (!Number.isFinite(credits) || credits <= 0) return;
    const run = (
      await this.db
        .select()
        .from(hiveRuns)
        .where(and(eq(hiveRuns.id, id), eq(hiveRuns.profileId, profileId)))
    )[0];
    if (!run) throw new NotFoundException('Exécution Ruche introuvable.');
    const charged = Math.ceil(credits);
    const exceeded = run.usedCredits + charged > run.maxCredits;
    await this.db
      .update(hiveRuns)
      .set({
        usedCredits: sql`${hiveRuns.usedCredits} + ${charged}`,
        status: exceeded ? 'failed' : run.status,
        completedAt: exceeded ? new Date() : run.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(hiveRuns.id, id));
    if (exceeded) {
      await this.createAttentionForProfile(profileId, {
        kind: 'blocker',
        priority: 'high',
        title: 'Budget Ruche épuisé',
        details: `L’exécution a consommé ${run.usedCredits + charged} crédits sur ${run.maxCredits}.`,
        options: [{ id: 'acknowledge', label: 'J’ai vu' }],
        context: { runId: id, usedCredits: run.usedCredits + charged, maxCredits: run.maxCredits },
      });
      throw new BadRequestException('Budget de crédits du run dépassé.');
    }
  }

  async listRuns(authId: string, limit = 50) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveRuns)
      .where(eq(hiveRuns.profileId, profileId))
      .orderBy(desc(hiveRuns.createdAt))
      .limit(Math.max(1, Math.min(200, limit)));
  }

  async getRun(authId: string, id: string) {
    const profileId = await this.profileIdForAuth(authId);
    const run = (
      await this.db
        .select()
        .from(hiveRuns)
        .where(and(eq(hiveRuns.id, id), eq(hiveRuns.profileId, profileId)))
    )[0];
    if (!run) throw new NotFoundException('Exécution Ruche introuvable.');
    const tasks = await this.db
      .select()
      .from(hiveTasks)
      .where(and(eq(hiveTasks.runId, id), eq(hiveTasks.profileId, profileId)))
      .orderBy(asc(hiveTasks.depth), asc(hiveTasks.sequence), asc(hiveTasks.createdAt));
    return { ...run, tasks };
  }

  async listCapabilities(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    await this.syncCapabilitiesForProfile(profileId);
    const [capabilities, bindings] = await Promise.all([
      this.db
        .select()
        .from(hiveCapabilities)
        .where(eq(hiveCapabilities.profileId, profileId))
        .orderBy(asc(hiveCapabilities.label)),
      this.db
        .select()
        .from(hiveCapabilityBindings)
        .where(
          and(
            eq(hiveCapabilityBindings.profileId, profileId),
            eq(hiveCapabilityBindings.enabled, true),
          ),
        ),
    ]);
    return capabilities.map((capability) => ({
      ...capability,
      bindings: bindings.filter((binding) => binding.capabilityId === capability.id),
    }));
  }

  async listCompanionStates(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveCompanionStates)
      .where(eq(hiveCompanionStates.profileId, profileId));
  }

  async listComputeResources(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveComputeResources)
      .where(eq(hiveComputeResources.profileId, profileId))
      .orderBy(asc(hiveComputeResources.name));
  }

  async createComputeResource(
    authId: string,
    input: {
      name: string;
      kind: 'cpu' | 'gpu' | 'npu' | 'remote_api';
      locality: 'local' | 'private_cloud' | 'public_cloud';
      modalities: string[];
      memoryMb?: number;
      acceleratorMemoryMb?: number;
      maxConcurrency?: number;
      costPerHour?: number;
      assetId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    return (
      await this.db
        .insert(hiveComputeResources)
        .values({
          profileId,
          name: input.name.slice(0, 120),
          kind: input.kind,
          locality: input.locality,
          modalities: input.modalities,
          memoryMb: input.memoryMb ?? 0,
          acceleratorMemoryMb: input.acceleratorMemoryMb ?? 0,
          maxConcurrency: input.maxConcurrency ?? 1,
          costPerHour: input.costPerHour ?? 0,
          assetId: input.assetId,
          metadata: input.metadata ?? {},
        })
        .returning()
    )[0]!;
  }

  async updateComputeResource(
    authId: string,
    id: string,
    patch: {
      health?: 'healthy' | 'degraded' | 'offline' | 'unknown';
      enabled?: boolean;
      maxConcurrency?: number;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const row = (
      await this.db
        .update(hiveComputeResources)
        .set({
          health: patch.health,
          enabled: patch.enabled,
          maxConcurrency: patch.maxConcurrency,
          updatedAt: new Date(),
        })
        .where(and(eq(hiveComputeResources.id, id), eq(hiveComputeResources.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Ressource de calcul introuvable.');
    return row;
  }

  private capabilityKey(label: string): string {
    return (
      label
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 120) || 'capability'
    );
  }

  private async syncCapabilitiesForProfile(profileId: string): Promise<void> {
    const [runtimes, agents] = await Promise.all([
      this.db.select().from(hiveRuntimes).where(eq(hiveRuntimes.profileId, profileId)),
      this.db
        .select({
          id: companionAgents.id,
          roleContract: companionAgents.roleContract,
          qualityEma: companionAgents.qualityEma,
        })
        .from(companionAgents)
        .where(and(eq(companionAgents.profileId, profileId), eq(companionAgents.status, 'active'))),
    ]);
    const subjects: {
      kind: 'runtime' | 'agent';
      id: string;
      label: string;
      proficiency: number;
      modality: string;
    }[] = [];
    for (const runtime of runtimes)
      for (const label of runtime.capabilities)
        subjects.push({
          kind: 'runtime',
          id: runtime.id,
          label,
          proficiency: runtime.quality,
          modality: runtime.modalities[0] ?? 'text',
        });
    for (const agent of agents) {
      const contract = (agent.roleContract ?? {}) as { capabilities?: string[] };
      for (const label of contract.capabilities ?? [])
        subjects.push({
          kind: 'agent',
          id: agent.id,
          label,
          proficiency: agent.qualityEma ?? 0.7,
          modality: 'text',
        });
    }
    for (const subject of subjects) {
      if (!subject.label.trim()) continue;
      const key = this.capabilityKey(subject.label);
      const capability =
        (
          await this.db
            .insert(hiveCapabilities)
            .values({
              profileId,
              key,
              label: subject.label.slice(0, 200),
              modality: subject.modality,
            })
            .onConflictDoNothing()
            .returning()
        )[0] ??
        (
          await this.db
            .select()
            .from(hiveCapabilities)
            .where(and(eq(hiveCapabilities.profileId, profileId), eq(hiveCapabilities.key, key)))
        )[0];
      if (!capability) continue;
      await this.db
        .insert(hiveCapabilityBindings)
        .values({
          profileId,
          capabilityId: capability.id,
          subjectKind: subject.kind,
          subjectId: subject.id,
          proficiency: Math.max(0, Math.min(1, subject.proficiency)),
        })
        .onConflictDoNothing();
    }
  }

  async rememberTemporal(
    authId: string,
    input: {
      memoryKey: string;
      content: string;
      category: string;
      scope?: 'profile' | 'space' | 'agent';
      scopeId?: string;
      confidence?: number;
      validFrom?: Date;
      entities?: Record<string, unknown>[];
      sourceEventIds?: string[];
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    return this.upsertTemporalMemory(profileId, input);
  }

  private async upsertTemporalMemory(
    profileId: string,
    input: {
      memoryKey: string;
      content: string;
      category: string;
      scope?: 'profile' | 'space' | 'agent';
      scopeId?: string | null;
      confidence?: number;
      validFrom?: Date;
      entities?: Record<string, unknown>[];
      sourceEventIds?: string[];
      metadata?: Record<string, unknown>;
      expiresAt?: Date | null;
    },
  ) {
    const scope = input.scope ?? 'profile';
    const current = (
      await this.db
        .select()
        .from(hiveMemories)
        .where(
          and(
            eq(hiveMemories.profileId, profileId),
            eq(hiveMemories.scope, scope),
            input.scopeId
              ? eq(hiveMemories.scopeId, input.scopeId)
              : sql`${hiveMemories.scopeId} is null`,
            eq(hiveMemories.memoryKey, input.memoryKey),
            eq(hiveMemories.status, 'active'),
          ),
        )
    )[0];
    if (current?.content.trim() === input.content.trim()) return current;
    const now = input.validFrom ?? new Date();
    if (current) {
      await this.db
        .update(hiveMemories)
        .set({ status: 'superseded', validTo: now, updatedAt: now })
        .where(eq(hiveMemories.id, current.id));
    }
    return (
      await this.db
        .insert(hiveMemories)
        .values({
          profileId,
          scope,
          scopeId: input.scopeId,
          category: input.category,
          content: input.content.slice(0, 20_000),
          memoryKey: input.memoryKey.slice(0, 240),
          sourceEventIds: input.sourceEventIds ?? [],
          confidence: Math.max(0, Math.min(1, input.confidence ?? 0.8)),
          validFrom: now,
          supersedesId: current?.id,
          entities: input.entities ?? [],
          metadata: input.metadata ?? {},
          expiresAt: input.expiresAt,
        })
        .returning()
    )[0]!;
  }

  private vaultKey(): string {
    const key = this.env.HIVE_VAULT_SECRET_KEY ?? this.env.COPILOTE_SECRET_KEY;
    if (!key)
      throw new BadRequestException(
        'Le coffre est désactivé : configure HIVE_VAULT_SECRET_KEY (32 octets base64 ou hex).',
      );
    return key;
  }

  private tokenHash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private async profileIdForAuth(authId: string): Promise<string> {
    const account = (
      await this.db.select().from(accounts).where(eq(accounts.authUserId, authId))
    )[0];
    if (!account) throw new BadRequestException('Compte introuvable.');
    const profile = (
      await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, account.id))
        .orderBy(asc(profiles.createdAt))
    )[0];
    if (!profile) throw new BadRequestException('Profil introuvable.');
    return profile.id;
  }

  private async ownedAgent(profileId: string, id: string | undefined): Promise<boolean> {
    if (!id) return true;
    const row = (
      await this.db
        .select({ id: companionAgents.id })
        .from(companionAgents)
        .where(and(eq(companionAgents.id, id), eq(companionAgents.profileId, profileId)))
        .limit(1)
    )[0];
    return Boolean(row);
  }

  async recordForProfile(profileId: string, inputs: HiveEventInput[]) {
    const safe = inputs.map((input) => ({
      profileId,
      kind: input.kind.slice(0, 80),
      content: input.content.slice(0, 12_000),
      channel: input.channel ?? 'system',
      actorAgentId: input.actorAgentId,
      subjectAgentId: input.subjectAgentId,
      space: input.space?.slice(0, 80),
      visibility: input.visibility ?? 'private',
      importance: Math.max(0, Math.min(1, input.importance ?? 0.5)),
      metadata: input.metadata ?? {},
      sourceEventIds: input.sourceEventIds ?? [],
    }));
    return this.db.insert(hiveEvents).values(safe).returning();
  }

  async recordHiveEvent(authId: string, input: HiveEventInput) {
    const profileId = await this.profileIdForAuth(authId);
    if (!(await this.ownedAgent(profileId, input.actorAgentId)))
      throw new NotFoundException('Compagnon acteur introuvable.');
    if (!(await this.ownedAgent(profileId, input.subjectAgentId)))
      throw new NotFoundException('Compagnon sujet introuvable.');
    return (await this.recordForProfile(profileId, [input]))[0];
  }

  async listHiveEvents(authId: string, options: { limit?: number; kind?: string; space?: string }) {
    const profileId = await this.profileIdForAuth(authId);
    const filters = [eq(hiveEvents.profileId, profileId)];
    if (options.kind) filters.push(eq(hiveEvents.kind, options.kind));
    if (options.space) filters.push(eq(hiveEvents.space, options.space));
    return this.db
      .select()
      .from(hiveEvents)
      .where(and(...filters))
      .orderBy(desc(hiveEvents.occurredAt))
      .limit(Math.max(1, Math.min(200, options.limit ?? 50)));
  }

  async searchMemory(
    authId: string,
    options: {
      q?: string;
      from?: Date;
      to?: Date;
      actorAgentId?: string;
      space?: string;
      kind?: string;
      limit?: number;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    if (!(await this.ownedAgent(profileId, options.actorAgentId)))
      throw new NotFoundException('Compagnon acteur introuvable.');
    const query = options.q?.trim().slice(0, 500) ?? '';
    const vector = query
      ? (await this.copilote.embed(profileId, [query]).catch(() => null))?.[0]
      : undefined;
    const vectorLiteral = vector?.length === 1024 ? `[${vector.join(',')}]` : null;
    const limit = Math.max(1, Math.min(200, options.limit ?? 50));
    const rows = (await this.db.execute(sql`
      select e.*,
        case when ${query} = '' then 0
          else greatest(
            ts_rank_cd(to_tsvector('simple', e.content), websearch_to_tsquery('simple', ${query})),
            similarity(e.content, ${query}),
            case when ${vectorLiteral}::text is null or e.embedding_vec is null then 0
              else 1 - (e.embedding_vec <=> ${vectorLiteral}::vector) end
          )
        end as relevance
      from hive_events e
      where e.profile_id = ${profileId}
        and (${query} = '' or to_tsvector('simple', e.content) @@ websearch_to_tsquery('simple', ${query})
          or similarity(e.content, ${query}) > 0.12
          or (${vectorLiteral}::text is not null and e.embedding_vec is not null
            and 1 - (e.embedding_vec <=> ${vectorLiteral}::vector) > 0.55))
        and (${options.from?.toISOString() ?? null}::timestamptz is null or e.occurred_at >= ${options.from?.toISOString() ?? null}::timestamptz)
        and (${options.to?.toISOString() ?? null}::timestamptz is null or e.occurred_at <= ${options.to?.toISOString() ?? null}::timestamptz)
        and (${options.actorAgentId ?? null}::uuid is null or e.actor_agent_id = ${options.actorAgentId ?? null}::uuid)
        and (${options.space ?? null}::text is null or e.space = ${options.space ?? null})
        and (${options.kind ?? null}::text is null or e.kind = ${options.kind ?? null})
      order by case when ${query} = '' then 0 else 1 end *
        greatest(
          ts_rank_cd(to_tsvector('simple', e.content), websearch_to_tsquery('simple', ${query})),
          similarity(e.content, ${query}),
          case when ${vectorLiteral}::text is null or e.embedding_vec is null then 0
            else 1 - (e.embedding_vec <=> ${vectorLiteral}::vector) end
        ) desc,
        e.occurred_at desc
      limit ${limit}
    `)) as unknown as Record<string, unknown>[];
    return rows;
  }

  async eventProvenance(authId: string, eventId: string) {
    const profileId = await this.profileIdForAuth(authId);
    const nodes = (await this.db.execute(sql`
      with recursive ancestry as (
        select e.*, 0 as depth, array[e.id]::uuid[] as path
        from hive_events e where e.id = ${eventId} and e.profile_id = ${profileId}
        union all
        select source.*, ancestry.depth + 1, ancestry.path || source.id
        from ancestry
        cross join lateral unnest(ancestry.source_event_ids) source_id
        join hive_events source on source.id = source_id and source.profile_id = ${profileId}
        where ancestry.depth < 30 and not source.id = any(ancestry.path)
      )
      select * from ancestry order by depth asc, occurred_at asc
    `)) as unknown as Record<string, unknown>[];
    if (!nodes.length) throw new NotFoundException('Événement introuvable.');
    return {
      rootId: eventId,
      nodes,
      edges: nodes.flatMap((node) =>
        ((node.source_event_ids as string[] | undefined) ?? []).map((sourceId) => ({
          from: sourceId,
          to: node.id,
        })),
      ),
    };
  }

  async searchMemoryForProfile(
    profileId: string,
    query: string,
    limit = 8,
    requestingSpace?: string | null,
  ) {
    const q = query.trim().slice(0, 500);
    if (!q) return [];
    const policy = (
      await this.db
        .select({ crossSpaceEnabled: hiveMemoryPolicies.crossSpaceEnabled })
        .from(hiveMemoryPolicies)
        .where(eq(hiveMemoryPolicies.profileId, profileId))
    )[0];
    const crossSpaceEnabled = policy?.crossSpaceEnabled ?? false;
    const vector = (await this.copilote.embed(profileId, [q]).catch(() => null))?.[0];
    const vectorLiteral = vector?.length === 1024 ? `[${vector.join(',')}]` : null;
    return (await this.db.execute(sql`
      select kind, content, occurred_at as "occurredAt"
      from hive_events
      where profile_id = ${profileId}
        and (${crossSpaceEnabled}
          or space is null
          or (${requestingSpace ?? null}::text is not null and space = ${requestingSpace ?? null}))
        and (to_tsvector('simple', content) @@ websearch_to_tsquery('simple', ${q})
          or similarity(content, ${q}) > 0.12
          or (${vectorLiteral}::text is not null and embedding_vec is not null
            and 1 - (embedding_vec <=> ${vectorLiteral}::vector) > 0.55))
      order by greatest(
        ts_rank_cd(to_tsvector('simple', content), websearch_to_tsquery('simple', ${q})),
        similarity(content, ${q}),
        case when ${vectorLiteral}::text is null or embedding_vec is null then 0
          else 1 - (embedding_vec <=> ${vectorLiteral}::vector) end
      ) desc, occurred_at desc
      limit ${Math.max(1, Math.min(20, limit))}
    `)) as unknown as { kind: string; content: string; occurredAt: string }[];
  }

  /** Enrichissement progressif : l'absence de fournisseur embedding ne bloque jamais le journal. */
  async embedRecentEvents(authId: string, limit = 100) {
    const profileId = await this.profileIdForAuth(authId);
    return this.embedRecentEventsForProfile(profileId, limit);
  }

  private async embedRecentEventsForProfile(profileId: string, limit = 100) {
    const rows = (await this.db.execute(sql`
      select id, content from hive_events where profile_id = ${profileId} and embedding_vec is null
      order by occurred_at desc limit ${Math.max(1, Math.min(500, limit))}
    `)) as unknown as { id: string; content: string }[];
    if (!rows.length) return { embedded: 0 };
    const vectors = await this.copilote.embed(
      profileId,
      rows.map((row) => row.content.slice(0, 4000)),
    );
    if (!vectors) return { embedded: 0 };
    let embedded = 0;
    for (let index = 0; index < rows.length; index += 1) {
      const vectorValue = vectors[index];
      if (!vectorValue || vectorValue.length !== 1024) continue;
      await this.db.execute(
        sql`update hive_events set embedding_vec = ${`[${vectorValue.join(',')}]`}::vector where id = ${rows[index]!.id} and profile_id = ${profileId}`,
      );
      embedded += 1;
    }
    return { embedded };
  }

  async createHandoff(
    authId: string,
    input: {
      fromAgentId?: string;
      toAgentId?: string;
      targetSpace?: string;
      originalRequest: string;
      summarizedContext?: string;
      sourceEventIds?: string[];
      urgency?: 'low' | 'normal' | 'high' | 'critical';
      permissions?: Record<string, unknown>;
      expectedNextAction?: string;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    if (!(await this.ownedAgent(profileId, input.fromAgentId)))
      throw new NotFoundException('Compagnon source introuvable.');
    if (!(await this.ownedAgent(profileId, input.toAgentId)))
      throw new NotFoundException('Compagnon destinataire introuvable.');
    const handoff = (
      await this.db
        .insert(hiveHandoffs)
        .values({
          profileId,
          fromAgentId: input.fromAgentId,
          toAgentId: input.toAgentId,
          targetSpace: input.targetSpace?.slice(0, 80),
          originalRequest: input.originalRequest.slice(0, 4000),
          summarizedContext: input.summarizedContext?.slice(0, 4000) ?? '',
          sourceEventIds: input.sourceEventIds ?? [],
          urgency: input.urgency ?? 'normal',
          permissions: input.permissions ?? {},
          expectedNextAction: input.expectedNextAction?.slice(0, 1000),
        })
        .returning()
    )[0]!;
    await this.recordForProfile(profileId, [
      {
        kind: 'handoff.created',
        content: input.originalRequest,
        actorAgentId: input.fromAgentId,
        subjectAgentId: input.toAgentId,
        space: input.targetSpace,
        importance: input.urgency === 'critical' ? 1 : input.urgency === 'high' ? 0.85 : 0.65,
        sourceEventIds: input.sourceEventIds,
        metadata: { handoffId: handoff.id, expectedNextAction: input.expectedNextAction },
      },
    ]);
    return handoff;
  }

  async listHandoffs(authId: string, status?: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveHandoffs)
      .where(
        status
          ? and(eq(hiveHandoffs.profileId, profileId), eq(hiveHandoffs.status, status))
          : eq(hiveHandoffs.profileId, profileId),
      )
      .orderBy(desc(hiveHandoffs.createdAt))
      .limit(200);
  }

  async transitionHandoff(authId: string, id: string, status: string) {
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const row = (
      await this.db
        .update(hiveHandoffs)
        .set({
          status,
          updatedAt: now,
          acceptedAt: status === 'accepted' || status === 'in_progress' ? now : undefined,
          completedAt: status === 'completed' ? now : undefined,
        })
        .where(and(eq(hiveHandoffs.id, id), eq(hiveHandoffs.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Passage de relais introuvable.');
    await this.recordForProfile(profileId, [
      {
        kind: `handoff.${status}`,
        content: row.originalRequest,
        actorAgentId: row.toAgentId ?? undefined,
        subjectAgentId: row.fromAgentId ?? undefined,
        space: row.targetSpace ?? undefined,
        importance: 0.7,
        sourceEventIds: row.sourceEventIds,
        metadata: { handoffId: row.id },
      },
    ]);
    if (status === 'failed') {
      await this.createAttentionForProfile(profileId, {
        requesterAgentId: row.toAgentId ?? undefined,
        kind: 'blocker',
        priority: row.urgency === 'critical' ? 'critical' : 'high',
        title: 'Une délégation a échoué',
        details: row.originalRequest,
        options: [{ id: 'acknowledge', label: 'J’ai vu' }],
      });
    }
    return row;
  }

  async createAttentionForProfile(
    profileId: string,
    input: {
      sourceEventId?: string;
      requesterAgentId?: string;
      kind: 'approval' | 'decision' | 'blocker' | 'warning' | 'information';
      priority?: 'low' | 'normal' | 'high' | 'critical';
      title: string;
      details?: string;
      options?: { id: string; label: string }[];
      context?: Record<string, unknown>;
      dueAt?: Date;
    },
  ) {
    return (
      await this.db
        .insert(hiveAttentionItems)
        .values({
          profileId,
          sourceEventId: input.sourceEventId,
          requesterAgentId: input.requesterAgentId,
          kind: input.kind,
          priority: input.priority ?? 'normal',
          title: input.title.slice(0, 200),
          details: input.details?.slice(0, 8000) ?? '',
          options: input.options ?? [],
          context: input.context ?? {},
          dueAt: input.dueAt,
        })
        .returning()
    )[0]!;
  }

  async listAttention(authId: string, status = 'open') {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveAttentionItems)
      .where(
        status === 'all'
          ? eq(hiveAttentionItems.profileId, profileId)
          : and(eq(hiveAttentionItems.profileId, profileId), eq(hiveAttentionItems.status, status)),
      )
      .orderBy(desc(hiveAttentionItems.createdAt))
      .limit(200);
  }

  async resolveAttention(
    authId: string,
    id: string,
    input: { action: string; note?: string; dismiss?: boolean },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const now = new Date();
    const current = (
      await this.db
        .select()
        .from(hiveAttentionItems)
        .where(
          and(
            eq(hiveAttentionItems.id, id),
            eq(hiveAttentionItems.profileId, profileId),
            eq(hiveAttentionItems.status, 'open'),
          ),
        )
    )[0];
    if (!current) throw new NotFoundException('Élément d’attention ouvert introuvable.');
    const context = (current.context ?? {}) as Record<string, unknown>;
    if (
      typeof context.accessRequestId === 'string' &&
      (input.action === 'approve' || input.action === 'deny')
    ) {
      await this.decideVaultAccess(authId, context.accessRequestId, {
        decision: input.action,
        reason: input.note,
      });
    }
    const row = (
      await this.db
        .update(hiveAttentionItems)
        .set({
          status: input.dismiss ? 'dismissed' : 'resolved',
          resolution: { action: input.action, note: input.note },
          resolvedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(hiveAttentionItems.id, id),
            eq(hiveAttentionItems.profileId, profileId),
            eq(hiveAttentionItems.status, 'open'),
          ),
        )
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Élément d’attention ouvert introuvable.');
    await this.recordForProfile(profileId, [
      {
        kind: input.dismiss ? 'attention.dismissed' : 'attention.resolved',
        content: `${row.title} — ${input.action}`,
        actorAgentId: row.requesterAgentId ?? undefined,
        importance: 0.8,
        sourceEventIds: row.sourceEventId ? [row.sourceEventId] : [],
        metadata: { attentionId: row.id, action: input.action, note: input.note },
      },
    ]);
    return row;
  }

  async createDelivery(
    authId: string,
    input: { eventId: string; companionId?: string; channel: HiveChannel; companionName?: string },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    if (!(await this.ownedAgent(profileId, input.companionId)))
      throw new NotFoundException('Compagnon introuvable.');
    const event = (
      await this.db
        .select()
        .from(hiveEvents)
        .where(and(eq(hiveEvents.id, input.eventId), eq(hiveEvents.profileId, profileId)))
    )[0];
    if (!event) throw new NotFoundException('Événement introuvable.');
    const eventMetadata = (event.metadata ?? {}) as Record<string, unknown>;
    const companion = input.companionId
      ? (
          await this.db
            .select({ name: companionAgents.name, personality: companionAgents.personality })
            .from(companionAgents)
            .where(
              and(
                eq(companionAgents.id, input.companionId),
                eq(companionAgents.profileId, profileId),
              ),
            )
        )[0]
      : null;
    const relationship = input.companionId
      ? (
          await this.db
            .select()
            .from(hiveCompanionRelationships)
            .where(
              and(
                eq(hiveCompanionRelationships.agentId, input.companionId),
                eq(hiveCompanionRelationships.profileId, profileId),
              ),
            )
        )[0]
      : null;
    const renderedContent = renderForChannel(input.channel, {
      content: event.content,
      companionName: companion?.name ?? input.companionName ?? 'Dowze',
      tone: (companion?.personality as { tone?: string } | null)?.tone,
      emotion: typeof eventMetadata.emotion === 'string' ? eventMetadata.emotion : null,
      relationship:
        typeof eventMetadata.relationship === 'string' ? eventMetadata.relationship : null,
      familiarity: relationship?.familiarity ?? null,
      affinity: relationship?.affinity ?? null,
    });
    const delivered = ['direct', 'messages', 'voice', 'system'].includes(input.channel);
    const row = (
      await this.db
        .insert(hiveDeliveries)
        .values({
          profileId,
          eventId: event.id,
          companionId: input.companionId,
          channel: input.channel,
          renderedContent,
          status: delivered ? 'delivered' : 'queued',
          deliveredAt: delivered ? new Date() : undefined,
        })
        .returning()
    )[0];
    const intentValues: HiveCommunicationFrame['intent'][] = [
      'inform',
      'ask',
      'confirm',
      'warn',
      'handoff',
      'acknowledge',
    ];
    const requestedIntent =
      typeof eventMetadata.intent === 'string' &&
      intentValues.includes(eventMetadata.intent as HiveCommunicationFrame['intent'])
        ? (eventMetadata.intent as HiveCommunicationFrame['intent'])
        : undefined;
    const frame = communicationFrame(event.content, {
      intent: requestedIntent,
      emotion: typeof eventMetadata.emotion === 'string' ? eventMetadata.emotion : undefined,
      tone: (companion?.personality as { tone?: string } | null)?.tone,
      confidence:
        typeof eventMetadata.confidence === 'number' ? eventMetadata.confidence : event.importance,
    });
    await this.db
      .insert(hiveUtterances)
      .values({
        profileId,
        eventId: event.id,
        deliveryId: row!.id,
        companionId: input.companionId,
        channel: input.channel,
        intent: frame.intent,
        facts: frame.facts,
        emotion: frame.emotion,
        confidence: frame.confidence,
        prosody: frame.prosody,
        animation: frame.animation,
        state: delivered ? 'completed' : 'ready',
      })
      .catch(() => undefined);
    if (input.channel === 'messages' && input.companionId) {
      await this.db.insert(companionMessages).values({
        profileId,
        agentId: input.companionId!,
        sender: 'agent',
        text: renderedContent,
      });
    }
    return row;
  }

  async listDeliveries(authId: string, channel?: 'email' | 'messages') {
    const profileId = await this.profileIdForAuth(authId);
    const filters = [eq(hiveDeliveries.profileId, profileId)];
    if (channel) filters.push(eq(hiveDeliveries.channel, channel));
    return this.db
      .select({
        id: hiveDeliveries.id,
        channel: hiveDeliveries.channel,
        content: hiveDeliveries.renderedContent,
        status: hiveDeliveries.status,
        createdAt: hiveDeliveries.createdAt,
        metadata: hiveEvents.metadata,
        companionId: hiveDeliveries.companionId,
      })
      .from(hiveDeliveries)
      .innerJoin(hiveEvents, eq(hiveEvents.id, hiveDeliveries.eventId))
      .where(and(...filters))
      .orderBy(desc(hiveDeliveries.createdAt))
      .limit(100);
  }

  async touchRelationshipForProfile(profileId: string, agentId: string, positive = true) {
    const now = new Date();
    return (
      await this.db
        .insert(hiveCompanionRelationships)
        .values({
          profileId,
          agentId,
          affinity: positive ? 0.32 : 0.28,
          trust: 0.3,
          familiarity: 0.12,
          interactionCount: 1,
          lastInteractionAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: hiveCompanionRelationships.agentId,
          set: {
            affinity: sql`least(1, greatest(0, ${hiveCompanionRelationships.affinity} + ${positive ? 0.005 : -0.01}))`,
            trust: sql`least(1, ${hiveCompanionRelationships.trust} + 0.002)`,
            familiarity: sql`least(1, ${hiveCompanionRelationships.familiarity} + 0.01)`,
            interactionCount: sql`${hiveCompanionRelationships.interactionCount} + 1`,
            lastInteractionAt: now,
            updatedAt: now,
          },
        })
        .returning()
    )[0]!;
  }

  async listRelationships(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveCompanionRelationships)
      .where(eq(hiveCompanionRelationships.profileId, profileId))
      .orderBy(desc(hiveCompanionRelationships.affinity));
  }

  async createAsset(
    authId: string,
    input: {
      space: string;
      name: string;
      assetType: string;
      visualKey?: string;
      room?: string;
      position?: { c: number; r: number };
      endpoint?: string;
      purpose?: string;
      environment?: string;
      status?: string;
      vaultItemId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    if (input.space !== 'home') {
      const space = (
        await this.db
          .select({ id: companionSpaces.id })
          .from(companionSpaces)
          .where(and(eq(companionSpaces.id, input.space), eq(companionSpaces.profileId, profileId)))
      )[0];
      if (!space) throw new NotFoundException('Espace introuvable.');
    }
    if (input.vaultItemId) {
      const item = (
        await this.db
          .select({ id: hiveVaultItems.id })
          .from(hiveVaultItems)
          .where(
            and(eq(hiveVaultItems.id, input.vaultItemId), eq(hiveVaultItems.profileId, profileId)),
          )
      )[0];
      if (!item) throw new NotFoundException('Secret de coffre introuvable.');
    }
    const row = (
      await this.db
        .insert(hiveAssets)
        .values({
          ...input,
          profileId,
          name: input.name.slice(0, 120),
          visualKey:
            input.visualKey?.slice(0, 80) ??
            {
              server: 'serveur-informatique',
              database: 'armoire-dossiers',
              firewall: 'extincteur',
              vps: 'ordinateur',
              service: 'ordinateur-portable',
              device: 'double-ecran',
              other: 'caisse-outils',
            }[input.assetType] ??
            'serveur-informatique',
          endpoint: input.endpoint?.slice(0, 500),
          purpose: input.purpose?.slice(0, 1000) ?? '',
        })
        .returning()
    )[0]!;
    await this.recordForProfile(profileId, [
      {
        kind: 'asset.created',
        content: `${row.name} — ${row.purpose || row.assetType}`,
        space: row.space,
        importance: 0.7,
        metadata: { assetId: row.id, assetType: row.assetType, status: row.status },
      },
    ]);
    return row;
  }

  async listAssets(authId: string, space?: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select()
      .from(hiveAssets)
      .where(
        space
          ? and(eq(hiveAssets.profileId, profileId), eq(hiveAssets.space, space))
          : eq(hiveAssets.profileId, profileId),
      )
      .orderBy(desc(hiveAssets.updatedAt));
  }

  async updateAssetStatus(authId: string, id: string, status: string) {
    const profileId = await this.profileIdForAuth(authId);
    const row = (
      await this.db
        .update(hiveAssets)
        .set({ status, updatedAt: new Date() })
        .where(and(eq(hiveAssets.id, id), eq(hiveAssets.profileId, profileId)))
        .returning()
    )[0];
    if (!row) throw new NotFoundException('Actif introuvable.');
    await this.recordForProfile(profileId, [
      {
        kind: 'asset.status_changed',
        content: `${row.name} : ${status}`,
        space: row.space,
        importance: status === 'offline' ? 0.95 : status === 'degraded' ? 0.8 : 0.5,
        metadata: { assetId: row.id, status },
      },
    ]);
    if (status === 'offline' || status === 'degraded') {
      await this.createAttentionForProfile(profileId, {
        kind: status === 'offline' ? 'blocker' : 'warning',
        priority: status === 'offline' ? 'critical' : 'high',
        title: `${row.name} est ${status === 'offline' ? 'hors ligne' : 'dégradé'}`,
        details: row.purpose,
        options: [{ id: 'acknowledge', label: 'Examiner' }],
      });
    }
    return row;
  }

  async createVaultItem(
    authId: string,
    input: {
      label: string;
      secret: string;
      kind?: string;
      space?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const row = (
      await this.db
        .insert(hiveVaultItems)
        .values({
          profileId,
          label: input.label.slice(0, 120),
          kind: input.kind?.slice(0, 40) ?? 'secret',
          space: input.space?.slice(0, 80),
          ciphertext: encryptSecret(input.secret, this.vaultKey()),
          metadata: input.metadata ?? {},
        })
        .returning({
          id: hiveVaultItems.id,
          label: hiveVaultItems.label,
          kind: hiveVaultItems.kind,
          space: hiveVaultItems.space,
          metadata: hiveVaultItems.metadata,
          createdAt: hiveVaultItems.createdAt,
        })
    )[0]!;
    await this.recordForProfile(profileId, [
      {
        kind: 'vault.item_created',
        content: `Secret « ${row.label} » ajouté au coffre.`,
        space: row.space ?? undefined,
        importance: 0.8,
        metadata: { vaultItemId: row.id, secretKind: row.kind },
      },
    ]);
    return row;
  }

  async listVaultItems(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select({
        id: hiveVaultItems.id,
        label: hiveVaultItems.label,
        kind: hiveVaultItems.kind,
        space: hiveVaultItems.space,
        metadata: hiveVaultItems.metadata,
        createdAt: hiveVaultItems.createdAt,
        updatedAt: hiveVaultItems.updatedAt,
      })
      .from(hiveVaultItems)
      .where(eq(hiveVaultItems.profileId, profileId))
      .orderBy(desc(hiveVaultItems.createdAt));
  }

  async requestVaultAccess(
    authId: string,
    input: { vaultItemId: string; requesterAgentId?: string; purpose: string; seconds: number },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    if (!(await this.ownedAgent(profileId, input.requesterAgentId)))
      throw new NotFoundException('Compagnon demandeur introuvable.');
    const item = (
      await this.db
        .select({ id: hiveVaultItems.id, label: hiveVaultItems.label, space: hiveVaultItems.space })
        .from(hiveVaultItems)
        .where(
          and(eq(hiveVaultItems.id, input.vaultItemId), eq(hiveVaultItems.profileId, profileId)),
        )
    )[0];
    if (!item) throw new NotFoundException('Secret introuvable.');
    const claimToken = randomBytes(32).toString('base64url');
    const request = (
      await this.db
        .insert(hiveAccessRequests)
        .values({
          profileId,
          vaultItemId: item.id,
          requesterAgentId: input.requesterAgentId,
          purpose: input.purpose.slice(0, 1000),
          requestedSeconds: Math.max(60, Math.min(86_400, input.seconds)),
          tokenHash: this.tokenHash(claimToken),
        })
        .returning()
    )[0]!;
    await this.recordForProfile(profileId, [
      {
        kind: 'vault.access_requested',
        content: `Accès demandé à « ${item.label} » pour : ${request.purpose}`,
        actorAgentId: input.requesterAgentId,
        space: item.space ?? undefined,
        importance: 0.9,
        metadata: {
          accessRequestId: request.id,
          vaultItemId: item.id,
          seconds: request.requestedSeconds,
        },
      },
    ]);
    await this.createAttentionForProfile(profileId, {
      requesterAgentId: input.requesterAgentId,
      kind: 'approval',
      priority: 'high',
      title: `Autoriser l’accès à « ${item.label} » ?`,
      details: request.purpose,
      options: [
        { id: 'approve', label: 'Autoriser' },
        { id: 'deny', label: 'Refuser' },
      ],
      context: { accessRequestId: request.id },
      dueAt: new Date(Date.now() + 86_400_000),
    });
    return { ...request, tokenHash: undefined, claimToken };
  }

  async listAccessRequests(authId: string, status?: string) {
    const profileId = await this.profileIdForAuth(authId);
    return this.db
      .select({
        id: hiveAccessRequests.id,
        vaultItemId: hiveAccessRequests.vaultItemId,
        requesterAgentId: hiveAccessRequests.requesterAgentId,
        purpose: hiveAccessRequests.purpose,
        requestedSeconds: hiveAccessRequests.requestedSeconds,
        status: hiveAccessRequests.status,
        decisionReason: hiveAccessRequests.decisionReason,
        expiresAt: hiveAccessRequests.expiresAt,
        decidedAt: hiveAccessRequests.decidedAt,
        consumedAt: hiveAccessRequests.consumedAt,
        createdAt: hiveAccessRequests.createdAt,
      })
      .from(hiveAccessRequests)
      .where(
        status
          ? and(eq(hiveAccessRequests.profileId, profileId), eq(hiveAccessRequests.status, status))
          : eq(hiveAccessRequests.profileId, profileId),
      )
      .orderBy(desc(hiveAccessRequests.createdAt));
  }

  async decideVaultAccess(
    authId: string,
    id: string,
    input: { decision: 'approve' | 'deny' | 'revoke'; reason?: string; seconds?: number },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const current = (
      await this.db
        .select()
        .from(hiveAccessRequests)
        .where(and(eq(hiveAccessRequests.id, id), eq(hiveAccessRequests.profileId, profileId)))
    )[0];
    if (!current) throw new NotFoundException('Demande d’accès introuvable.');
    if (input.decision !== 'revoke' && current.status !== 'pending')
      throw new BadRequestException('Cette demande a déjà été décidée.');
    if (input.decision === 'revoke' && !['approved', 'pending'].includes(current.status))
      throw new BadRequestException('Cet accès ne peut plus être révoqué.');
    const approved = input.decision === 'approve';
    const seconds = Math.max(60, Math.min(86_400, input.seconds ?? current.requestedSeconds));
    const status = approved ? 'approved' : input.decision === 'deny' ? 'denied' : 'revoked';
    const row = (
      await this.db
        .update(hiveAccessRequests)
        .set({
          status,
          decisionReason: input.reason?.slice(0, 500),
          tokenHash: approved ? current.tokenHash : null,
          expiresAt: approved ? new Date(Date.now() + seconds * 1000) : null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(hiveAccessRequests.id, id), eq(hiveAccessRequests.profileId, profileId)))
        .returning()
    )[0]!;
    await this.recordForProfile(profileId, [
      {
        kind: `vault.access_${status}`,
        content: `Demande d’accès ${status}.`,
        actorAgentId: row.requesterAgentId ?? undefined,
        importance: 0.9,
        metadata: {
          accessRequestId: row.id,
          vaultItemId: row.vaultItemId,
          expiresAt: row.expiresAt,
        },
      },
    ]);
    const linkedAttention = await this.db
      .select({ id: hiveAttentionItems.id, context: hiveAttentionItems.context })
      .from(hiveAttentionItems)
      .where(
        and(eq(hiveAttentionItems.profileId, profileId), eq(hiveAttentionItems.status, 'open')),
      );
    const linkedIds = linkedAttention
      .filter(
        (item) => ((item.context ?? {}) as Record<string, unknown>).accessRequestId === row.id,
      )
      .map((item) => item.id);
    if (linkedIds.length > 0) {
      await this.db
        .update(hiveAttentionItems)
        .set({
          status: 'resolved',
          resolution: { action: input.decision, note: input.reason, source: 'vault' },
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(inArray(hiveAttentionItems.id, linkedIds));
    }
    return { ...row, tokenHash: undefined };
  }

  /** Remise à usage unique : le secret n'est révélé qu'après approbation et avant expiration. */
  async consumeVaultGrant(authId: string, id: string, grantToken: string) {
    const profileId = await this.profileIdForAuth(authId);
    const request = (
      await this.db
        .select()
        .from(hiveAccessRequests)
        .where(and(eq(hiveAccessRequests.id, id), eq(hiveAccessRequests.profileId, profileId)))
    )[0];
    if (!request) throw new NotFoundException('Demande d’accès introuvable.');
    const now = new Date();
    if (
      request.status !== 'approved' ||
      !request.tokenHash ||
      request.tokenHash !== this.tokenHash(grantToken) ||
      !request.expiresAt ||
      request.expiresAt <= now
    ) {
      if (request.status === 'approved' && request.expiresAt && request.expiresAt <= now)
        await this.db
          .update(hiveAccessRequests)
          .set({ status: 'expired', tokenHash: null, updatedAt: now })
          .where(eq(hiveAccessRequests.id, request.id));
      throw new BadRequestException('Jeton invalide, expiré, révoqué ou déjà utilisé.');
    }
    const item = (
      await this.db
        .select()
        .from(hiveVaultItems)
        .where(
          and(eq(hiveVaultItems.id, request.vaultItemId), eq(hiveVaultItems.profileId, profileId)),
        )
    )[0];
    if (!item) throw new NotFoundException('Secret introuvable.');
    await this.db
      .update(hiveAccessRequests)
      .set({ status: 'consumed', tokenHash: null, consumedAt: now, updatedAt: now })
      .where(eq(hiveAccessRequests.id, request.id));
    await this.recordForProfile(profileId, [
      {
        kind: 'vault.access_consumed',
        content: `Accès à « ${item.label} » utilisé puis révoqué.`,
        actorAgentId: request.requesterAgentId ?? undefined,
        space: item.space ?? undefined,
        importance: 1,
        metadata: { accessRequestId: request.id, vaultItemId: item.id },
      },
    ]);
    return {
      id: item.id,
      label: item.label,
      kind: item.kind,
      secret: decryptSecret(item.ciphertext, this.vaultKey()),
    };
  }

  async getMemoryPolicy(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    const current = (
      await this.db
        .select()
        .from(hiveMemoryPolicies)
        .where(eq(hiveMemoryPolicies.profileId, profileId))
    )[0];
    if (current) return current;
    return (await this.db.insert(hiveMemoryPolicies).values({ profileId }).returning())[0]!;
  }

  async updateMemoryPolicy(
    authId: string,
    patch: {
      crossSpaceEnabled?: boolean;
      personalDataEnabled?: boolean;
      proactiveMemoryEnabled?: boolean;
      retentionDays?: number | null;
    },
  ) {
    const profileId = await this.profileIdForAuth(authId);
    const current = await this.getMemoryPolicy(authId);
    return (
      await this.db
        .insert(hiveMemoryPolicies)
        .values({
          profileId,
          crossSpaceEnabled: patch.crossSpaceEnabled ?? current.crossSpaceEnabled,
          personalDataEnabled: patch.personalDataEnabled ?? current.personalDataEnabled,
          proactiveMemoryEnabled: patch.proactiveMemoryEnabled ?? current.proactiveMemoryEnabled,
          retentionDays:
            patch.retentionDays === undefined ? current.retentionDays : patch.retentionDays,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: hiveMemoryPolicies.profileId,
          set: {
            crossSpaceEnabled: patch.crossSpaceEnabled ?? current.crossSpaceEnabled,
            personalDataEnabled: patch.personalDataEnabled ?? current.personalDataEnabled,
            proactiveMemoryEnabled: patch.proactiveMemoryEnabled ?? current.proactiveMemoryEnabled,
            retentionDays:
              patch.retentionDays === undefined ? current.retentionDays : patch.retentionDays,
            updatedAt: new Date(),
          },
        })
        .returning()
    )[0]!;
  }

  async listLibrary(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    const [memories, memoryHistory, episodes, relations] = await Promise.all([
      this.db
        .select()
        .from(hiveMemories)
        .where(and(eq(hiveMemories.profileId, profileId), eq(hiveMemories.status, 'active')))
        .orderBy(desc(hiveMemories.updatedAt))
        .limit(100),
      this.db
        .select()
        .from(hiveMemories)
        .where(and(eq(hiveMemories.profileId, profileId), eq(hiveMemories.status, 'superseded')))
        .orderBy(desc(hiveMemories.validTo), desc(hiveMemories.updatedAt))
        .limit(100),
      this.db
        .select()
        .from(hiveEpisodes)
        .where(eq(hiveEpisodes.profileId, profileId))
        .orderBy(desc(hiveEpisodes.startedAt))
        .limit(100),
      this.db
        .select()
        .from(hiveMemoryRelations)
        .where(eq(hiveMemoryRelations.profileId, profileId))
        .orderBy(desc(hiveMemoryRelations.occurredAt))
        .limit(200),
    ]);
    return { memories, memoryHistory, episodes, relations };
  }

  /** Consolide les événements importants en mémoires stables sans perdre leur provenance. */
  async consolidate(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    const policy = await this.getMemoryPolicy(authId);
    return this.consolidateProfile(profileId, policy);
  }

  private async consolidateProfile(
    profileId: string,
    policy: typeof hiveMemoryPolicies.$inferSelect,
  ) {
    if (!policy.proactiveMemoryEnabled)
      return { created: 0, episodes: 0, relations: 0, skipped: true };
    const events = await this.db
      .select()
      .from(hiveEvents)
      .where(and(eq(hiveEvents.profileId, profileId), gt(hiveEvents.importance, 0.69)))
      .orderBy(desc(hiveEvents.occurredAt))
      .limit(100);
    const existing = await this.db
      .select({ content: hiveMemories.content })
      .from(hiveMemories)
      .where(and(eq(hiveMemories.profileId, profileId), eq(hiveMemories.status, 'active')))
      .limit(1000);
    const seen = new Set(existing.map((item) => item.content.trim().toLowerCase()));
    const candidates = events
      .filter((event) => !seen.has(event.content.trim().toLowerCase()))
      .slice(0, 50)
      .map((event) => ({
        profileId,
        scope: event.space ? 'space' : event.actorAgentId ? 'agent' : 'profile',
        scopeId: event.space ?? event.actorAgentId ?? null,
        category: event.kind.includes('learn') ? 'preference' : event.kind.split('.')[0] || 'event',
        content: event.content,
        sourceEventIds: [event.id],
        confidence: event.importance,
        metadata: { sourceKind: event.kind },
        expiresAt: policy.retentionDays
          ? new Date(Date.now() + policy.retentionDays * 86_400_000)
          : null,
      }));
    if (candidates.length) await this.db.insert(hiveMemories).values(candidates);

    const episodeGroups = new Map<string, typeof events>();
    for (const event of events) {
      const day = event.occurredAt.toISOString().slice(0, 10);
      const key = `${day}:${event.space ?? 'profil'}`;
      const group = episodeGroups.get(key) ?? [];
      group.push(event);
      episodeGroups.set(key, group);
    }
    let episodes = 0;
    for (const [key, group] of episodeGroups) {
      if (group.length < 2) continue;
      const chronological = [...group].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      );
      const fingerprint = createHash('sha256').update(`${profileId}:${key}`).digest('hex');
      const episodeValue = {
        profileId,
        fingerprint,
        space: chronological[0]!.space,
        title: `${chronological[0]!.space ?? 'Ruche'} · ${chronological[0]!.occurredAt.toLocaleDateString('fr-CH')}`,
        summary: chronological
          .slice(0, 8)
          .map((event) => `${event.kind} : ${event.content}`)
          .join('\n')
          .slice(0, 8000),
        sourceEventIds: chronological.map((event) => event.id),
        startedAt: chronological[0]!.occurredAt,
        endedAt: chronological[chronological.length - 1]!.occurredAt,
      };
      const inserted = await this.db
        .insert(hiveEpisodes)
        .values(episodeValue)
        .onConflictDoNothing()
        .returning({ id: hiveEpisodes.id });
      if (!inserted.length) {
        await this.db
          .update(hiveEpisodes)
          .set(episodeValue)
          .where(
            and(eq(hiveEpisodes.profileId, profileId), eq(hiveEpisodes.fingerprint, fingerprint)),
          );
      }
      episodes += inserted.length;
    }

    const handoffs = await this.db
      .select()
      .from(hiveHandoffs)
      .where(eq(hiveHandoffs.profileId, profileId))
      .orderBy(desc(hiveHandoffs.createdAt))
      .limit(100);
    let relations = 0;
    for (const handoff of handoffs) {
      const inserted = await this.db
        .insert(hiveMemoryRelations)
        .values({
          profileId,
          sourceHandoffId: handoff.id,
          subjectKind: handoff.fromAgentId ? 'agent' : 'human',
          subjectId: handoff.fromAgentId,
          predicate: 'delegated_to',
          objectKind: handoff.toAgentId ? 'agent' : handoff.targetSpace ? 'space' : 'unknown',
          objectId: handoff.toAgentId ?? handoff.targetSpace,
          description: handoff.originalRequest,
          sourceEventIds: handoff.sourceEventIds,
          occurredAt: handoff.createdAt,
        })
        .onConflictDoNothing()
        .returning({ id: hiveMemoryRelations.id });
      relations += inserted.length;
    }
    return { created: candidates.length, episodes, relations, skipped: false };
  }

  async nightlyConsolidateAll(): Promise<{ profiles: number; created: number; embedded: number }> {
    const allProfiles = await this.db.select({ id: profiles.id }).from(profiles);
    let processed = 0;
    let created = 0;
    let embedded = 0;
    for (const profile of allProfiles) {
      const policy = (
        await this.db
          .select()
          .from(hiveMemoryPolicies)
          .where(eq(hiveMemoryPolicies.profileId, profile.id))
      )[0] ?? {
        profileId: profile.id,
        crossSpaceEnabled: false,
        personalDataEnabled: false,
        proactiveMemoryEnabled: true,
        retentionDays: null,
        updatedAt: new Date(),
      };
      const result = await this.consolidateProfile(profile.id, policy).catch(() => null);
      if (result) {
        processed += 1;
        created += result.created;
        embedded += (
          await this.embedRecentEventsForProfile(profile.id, 100).catch(() => ({ embedded: 0 }))
        ).embedded;
      }
    }
    return { profiles: processed, created, embedded };
  }

  async exportMemory(authId: string) {
    const profileId = await this.profileIdForAuth(authId);
    const [policy, events, handoffs, deliveries, memories, episodes, relations] = await Promise.all(
      [
        this.getMemoryPolicy(authId),
        this.db.select().from(hiveEvents).where(eq(hiveEvents.profileId, profileId)),
        this.db.select().from(hiveHandoffs).where(eq(hiveHandoffs.profileId, profileId)),
        this.db.select().from(hiveDeliveries).where(eq(hiveDeliveries.profileId, profileId)),
        this.db.select().from(hiveMemories).where(eq(hiveMemories.profileId, profileId)),
        this.db.select().from(hiveEpisodes).where(eq(hiveEpisodes.profileId, profileId)),
        this.db
          .select()
          .from(hiveMemoryRelations)
          .where(eq(hiveMemoryRelations.profileId, profileId)),
      ],
    );
    return {
      exportedAt: new Date().toISOString(),
      policy,
      events,
      handoffs,
      deliveries,
      memories,
      episodes,
      relations,
    };
  }

  /** Oubli sélectif : efface le contenu personnel mais conserve un tombstone d'audit sans donnée. */
  async forget(authId: string, input: { eventIds?: string[]; before?: Date }) {
    const profileId = await this.profileIdForAuth(authId);
    const filters = [eq(hiveEvents.profileId, profileId)];
    if (input.eventIds?.length) filters.push(inArray(hiveEvents.id, input.eventIds));
    if (input.before) filters.push(lt(hiveEvents.occurredAt, input.before));
    if (filters.length === 1)
      throw new BadRequestException('Précise les événements ou une date limite à oublier.');
    const redacted = await this.db
      .update(hiveEvents)
      .set({ content: '[contenu oublié]', metadata: { forgotten: true } })
      .where(and(...filters))
      .returning({ id: hiveEvents.id });
    if (redacted.length) {
      const forgottenSources = new Set(redacted.map((item) => item.id));
      const linked = await this.db
        .select({ id: hiveMemories.id, sourceEventIds: hiveMemories.sourceEventIds })
        .from(hiveMemories)
        .where(eq(hiveMemories.profileId, profileId));
      const memoryIds = linked
        .filter((memory) => memory.sourceEventIds.some((id) => forgottenSources.has(id)))
        .map((memory) => memory.id);
      if (memoryIds.length) {
        await this.db
          .update(hiveMemories)
          .set({ status: 'forgotten', content: '[contenu oublié]', updatedAt: new Date() })
          .where(inArray(hiveMemories.id, memoryIds));
      }
    }
    return { forgotten: redacted.length };
  }
}
