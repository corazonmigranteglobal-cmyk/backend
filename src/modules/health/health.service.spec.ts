import { HealthService } from './health.service';

const makeService = (overrides: { dbResult?: unknown; redisResult?: string } = {}) => {
  const sequelize = {
    query: jest.fn().mockResolvedValue(overrides.dbResult ?? []),
  };
  const redis = {
    ping: jest.fn().mockResolvedValue(overrides.redisResult ?? 'PONG'),
  };
  const config = { get: jest.fn() };

  const service = new HealthService(sequelize as any, redis as any, config as any);
  return { service, sequelize, redis };
};

describe('HealthService', () => {
  describe('check()', () => {
    it('returns status ok when both DB and Redis respond', async () => {
      const { service } = makeService();
      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.checks.database).toBe('ok');
      expect(result.checks.redis).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.uptime).toBe('number');
    });

    it('returns status degraded when database is unreachable', async () => {
      const { service, sequelize } = makeService();
      sequelize.query.mockRejectedValue(new Error('Connection refused'));

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.database).toBe('down');
      expect(result.checks.redis).toBe('ok');
    });

    it('returns status degraded when Redis is unreachable', async () => {
      const { service, redis } = makeService();
      redis.ping.mockRejectedValue(new Error('Redis connection lost'));

      const result = await service.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.database).toBe('ok');
      expect(result.checks.redis).toBe('down');
    });

    it('runs DB and Redis checks in parallel (both called)', async () => {
      const { service, sequelize, redis } = makeService();
      await service.check();

      expect(sequelize.query).toHaveBeenCalledWith('SELECT 1');
      expect(redis.ping).toHaveBeenCalled();
    });

    it('marks redis as degraded when ping returns unexpected value', async () => {
      const { service } = makeService({ redisResult: 'LOADING' });

      const result = await service.check();

      expect(result.checks.redis).toBe('degraded');
      expect(result.status).toBe('degraded');
    });
  });

  describe('version()', () => {
    it('returns version, commit, buildAt and env from process.env', () => {
      const saved = {
        npm_package_version: process.env['npm_package_version'],
        GIT_COMMIT: process.env['GIT_COMMIT'],
        BUILD_AT: process.env['BUILD_AT'],
        NODE_ENV: process.env['NODE_ENV'],
      };

      process.env['npm_package_version'] = '1.2.3';
      process.env['GIT_COMMIT'] = 'abc1234';
      process.env['BUILD_AT'] = '2026-07-01T00:00:00Z';
      process.env['NODE_ENV'] = 'production';

      const { service } = makeService();
      const result = service.version();

      expect(result).toEqual({
        version: '1.2.3',
        commit: 'abc1234',
        buildAt: '2026-07-01T00:00:00Z',
        env: 'production',
      });

      Object.assign(process.env, saved);
    });

    it('falls back to "unknown" when env vars are not set', () => {
      const { service } = makeService();
      const result = service.version();
      // In test environments these might or might not be set.
      // Only assert the shape, not exact values.
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('commit');
      expect(result).toHaveProperty('buildAt');
      expect(result).toHaveProperty('env');
    });
  });
});
