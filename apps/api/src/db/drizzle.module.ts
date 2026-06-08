import { Global, Module } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import * as schema from './schema';

/** Jeton d'injection de la base Drizzle. */
export const DB = Symbol('DB');
export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ENV],
      // postgres-js se connecte de façon paresseuse (pas de connexion au boot).
      useFactory: (env: Env): Database => {
        const client = postgres(env.DATABASE_URL, { prepare: false });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DrizzleModule {}
