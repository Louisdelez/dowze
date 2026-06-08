import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(env.API_PORT);
  console.log(`Dowze API à l'écoute sur le port ${env.API_PORT}`);
}

void bootstrap();
