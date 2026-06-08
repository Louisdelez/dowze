import { describe, it, expect } from 'vitest';
import { loadEnv } from './env';

describe('config/env', () => {
  it('charge un environnement valide avec valeurs par défaut', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://localhost:5432/dowze' } as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(3001);
    expect(env.NODE_ENV).toBe('development');
  });

  it('échoue si DATABASE_URL manque', () => {
    expect(() => loadEnv({} as NodeJS.ProcessEnv)).toThrow();
  });

  it('coerce API_PORT en nombre', () => {
    const env = loadEnv({
      DATABASE_URL: 'postgres://x',
      API_PORT: '4000',
    } as unknown as NodeJS.ProcessEnv);
    expect(env.API_PORT).toBe(4000);
  });
});
