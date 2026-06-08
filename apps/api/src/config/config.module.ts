import { Global, Module } from '@nestjs/common';
import { loadEnv, type Env } from './env';

/** Jeton d'injection de la configuration validée. */
export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: (): Env => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
