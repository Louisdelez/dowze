import { logger } from './logger';

/**
 * Observabilité OPTIONNELLE et sans dépendance obligatoire.
 *
 * - **Traces** : OpenTelemetry si `OTEL_EXPORTER_OTLP_ENDPOINT` est défini ET que
 *   `@opentelemetry/sdk-node` est installé.
 * - **Erreurs** : Sentry si `SENTRY_DSN` est défini ET que `@sentry/node` est installé.
 *
 * Sinon : **no-op** (on garde pino). Les paquets sont chargés dynamiquement pour
 * ne rien ajouter au bundle ni au périmètre d'audit tant qu'on ne les active pas.
 * En prod : `npm i @sentry/node @opentelemetry/sdk-node -w @dowze/api` puis définir
 * les variables d'environnement.
 */

interface OtelSdk {
  NodeSDK: new (config: Record<string, unknown>) => { start(): void };
}
interface SentryMod {
  init(config: Record<string, unknown>): void;
  captureException(err: unknown): void;
}

let sentry: SentryMod | null = null;

/** Charge un module optionnel par son nom, ou `null` s'il est absent. */
async function optional<T>(name: string): Promise<T | null> {
  try {
    return (await import(name)) as unknown as T;
  } catch {
    return null;
  }
}

export async function initObservability(): Promise<void> {
  await initTracing();
  await initSentry();
}

async function initTracing(): Promise<void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return;
  const otel = await optional<OtelSdk>('@opentelemetry/sdk-node');
  if (!otel) {
    logger.warn('OTEL_EXPORTER_OTLP_ENDPOINT défini mais @opentelemetry/sdk-node absent');
    return;
  }
  new otel.NodeSDK({}).start();
  logger.info({ endpoint }, 'OpenTelemetry activé');
}

async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const mod = await optional<SentryMod>('@sentry/node');
  if (!mod) {
    logger.warn('SENTRY_DSN défini mais @sentry/node absent');
    return;
  }
  mod.init({ dsn, tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0) });
  sentry = mod;
  logger.info('Sentry activé');
}

/** Rapporte une exception : toujours journalisée, envoyée à Sentry si actif. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  logger.error({ err, ...context }, 'exception');
  sentry?.captureException(err);
}
