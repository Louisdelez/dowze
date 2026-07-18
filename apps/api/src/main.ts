import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { logger } from './observability/logger';
import { initObservability, captureException } from './observability/telemetry';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  await initObservability(); // traces + erreurs (no-op si non configuré)

  // Filet de sécurité : rien ne meurt en silence.
  process.on('unhandledRejection', (reason) =>
    captureException(reason, { kind: 'unhandledRejection' }),
  );
  process.on('uncaughtException', (err) => captureException(err, { kind: 'uncaughtException' }));

  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors();
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'Dowze API à l’écoute');
}

void bootstrap();
