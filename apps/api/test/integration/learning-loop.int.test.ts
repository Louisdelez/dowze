/**
 * Test d'intégration bout-en-bout de la boucle d'apprentissage, sur un vrai
 * Postgres éphémère (Testcontainers). Vérifie la chaîne complète :
 *   migrations → seed → diagnostic (placement par clôture) → frontière →
 *   observation BKT → validation par paliers → maîtrise → avancée de la frontière.
 *
 * ⚠️ Nécessite Docker et le paquet `@testcontainers/postgresql` :
 *     npm i -D @testcontainers/postgresql -w @dowze/api
 *     npm run test:int -w @dowze/api
 * Non exécuté dans le pipeline unitaire (hors de `src/`), pour garder la CI
 * verte sans Docker.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../../src/db/schema';
import { accounts, profiles } from '../../src/db/schema';
import { SkillGraphService } from '../../src/skill-graph/skill-graph.service';
import { ProgressionService } from '../../src/progression/progression.service';
import { DiagnosticService } from '../../src/diagnostic/diagnostic.service';
import { ValidationService } from '../../src/validation/validation.service';

// UUID du seed (socle + fils de démonstration).
const DENOMBRER = '00000000-0000-4000-8000-000000000005';
const COMPARER = '00000000-0000-4000-8000-000000000006';
const ADDITIONNER = '00000000-0000-4000-8000-000000000102';
const SOUSTRAIRE = '00000000-0000-4000-8000-000000000103';

const REPO = resolve(process.cwd(), '../..');
const MIGRATIONS = resolve(REPO, 'supabase/migrations');
const SEED = resolve(REPO, 'supabase/seed.sql');

describe('boucle d’apprentissage — intégration Postgres', () => {
  let container: { getConnectionUri(): string; stop(): Promise<unknown> };
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let profileId: string;

  let graph: SkillGraphService;
  let progression: ProgressionService;
  let diagnostic: DiagnosticService;
  let validation: ValidationService;

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = postgres(container.getConnectionUri(), { prepare: false, max: 1 });
    db = drizzle(client, { schema });

    // Migrations (ordre lexical) puis seed.
    for (const file of readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await client.unsafe(readFileSync(resolve(MIGRATIONS, file), 'utf8'));
    }
    await client.unsafe(readFileSync(SEED, 'utf8'));

    // Un compte + profil (l'élève).
    const [acc] = await db
      .insert(accounts)
      .values({ email: 'eleve@test.dowze', role: 'eleve', isMinor: false })
      .returning({ id: accounts.id });
    const [prof] = await db
      .insert(profiles)
      .values({ accountId: acc.id, displayName: 'Test', locale: 'fr', timezone: 'Europe/Zurich' })
      .returning({ id: profiles.id });
    profileId = prof.id;

    graph = new SkillGraphService(db);
    progression = new ProgressionService(db, graph);
    diagnostic = new DiagnosticService(db, graph);
    validation = new ValidationService(db, progression);
  }, 120_000);

  afterAll(async () => {
    await client?.end({ timeout: 5 });
    await container?.stop();
  });

  it('place l’élève par clôture et prescrit la bonne première compétence', async () => {
    // Démontre deux racines (dénombrer, comparer) → additionner devient apprenable.
    await diagnostic.run(profileId, [DENOMBRER, COMPARER], new Date().toISOString());
    const next = await progression.nextPrescribed(profileId);
    // additionner et soustraire sont candidates (profondeur 1) ; slug « additionner » d'abord.
    expect(next?.id).toBe(ADDITIONNER);
  });

  it('une observation réussie fait monter la maîtrise (BKT)', async () => {
    const before = (await progression.getMastery(profileId)).find((m) => m.skillId === ADDITIONNER);
    const after = await progression.observe(profileId, ADDITIONNER, true, new Date().toISOString());
    expect(after.pMastery).toBeGreaterThan(before?.pMastery ?? 0);
  });

  it('valider un palier fait avancer la frontière (validation → maîtrise)', async () => {
    const rubric = await validation.getRubric(ADDITIONNER);
    expect(rubric).not.toBeNull();
    const verdicts = rubric!.criteria.map((c) => ({ criterionId: c.id, met: true }));
    const res = await validation.selfValidate(profileId, ADDITIONNER, verdicts);
    expect(res.passed).toBe(true);

    // additionner est désormais maîtrisée → la frontière passe à « soustraire ».
    const next = await progression.nextPrescribed(profileId);
    expect(next?.id).toBe(SOUSTRAIRE);
  });
});
