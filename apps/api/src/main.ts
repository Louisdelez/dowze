import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { logger } from './observability/logger';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(env.API_PORT);
  logger.info({ port: env.API_PORT }, 'Dowze API à l’écoute');
}

void bootstrap();
