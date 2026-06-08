import pino from 'pino';

/**
 * Logger structuré (pino). Redacte les champs sensibles (jetons, mots de passe).
 * cf. docs/10-APP-WEB/14-backend.md §8.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: ['req.headers.authorization', 'authorization', 'token', '*.password', 'password'],
});
