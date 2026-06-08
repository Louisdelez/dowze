/**
 * Options de connexion Redis pour BullMQ, dérivées de l'URL.
 * On passe un OBJET (pas une instance ioredis) pour éviter les conflits de
 * types entre l'ioredis du projet et celui embarqué par BullMQ.
 */
export interface RedisConnection {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
  password?: string;
  username?: string;
}

export function redisConnectionFromUrl(url: string): RedisConnection {
  const u = new URL(url);
  const conn: RedisConnection = {
    host: u.hostname,
    port: Number(u.port || 6379),
    maxRetriesPerRequest: null,
  };
  if (u.password) conn.password = u.password;
  if (u.username) conn.username = u.username;
  return conn;
}
