import { cleanEnvironmentValue } from './environment.util';

export type RedisConnectionConfiguration = {
  url?: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: number;
  tls: boolean;
};

/**
 * Resolves Redis connection settings. REDIS_URL has deliberate precedence so a
 * stale REDIS_HOST value cannot override a deployment-provided connection URL.
 */
export function resolveRedisConnection(): RedisConnectionConfiguration {
  const redisUrl = cleanEnvironmentValue(process.env.REDIS_URL);
  if (!redisUrl) {
    return {
      host: cleanEnvironmentValue(process.env.REDIS_HOST) ?? 'localhost',
      port: Number(cleanEnvironmentValue(process.env.REDIS_PORT) ?? 6379),
      username: cleanEnvironmentValue(process.env.REDIS_USERNAME),
      password: cleanEnvironmentValue(process.env.REDIS_PASSWORD),
      database: Number(cleanEnvironmentValue(process.env.REDIS_DB) ?? 0),
      tls: String(process.env.REDIS_TLS ?? 'false').toLowerCase() === 'true',
    };
  }

  const parsedUrl = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(parsedUrl.protocol)) {
    throw new Error('REDIS_URL must use the redis: or rediss: protocol.');
  }

  const databasePath = parsedUrl.pathname.replace(/^\//, '').trim();
  const database = databasePath ? Number(databasePath) : 0;
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_URL contains an invalid database number.');
  }

  return {
    url: redisUrl,
    host: parsedUrl.hostname,
    port: parsedUrl.port ? Number(parsedUrl.port) : 6379,
    username: parsedUrl.username ? decodeURIComponent(parsedUrl.username) : undefined,
    password: parsedUrl.password ? decodeURIComponent(parsedUrl.password) : undefined,
    database,
    tls: parsedUrl.protocol === 'rediss:',
  };
}
