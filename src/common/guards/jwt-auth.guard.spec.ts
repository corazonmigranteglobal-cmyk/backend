import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';

const makeContext = (authorization?: string): [ExecutionContext, Record<string, unknown>] => {
  const req: Record<string, unknown> = { headers: { authorization }, user: undefined };
  const ctx = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return [ctx, req];
};

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  const validPayload = {
    tokenType: 'access',
    sub: 'user-1',
    email: 'user@test.com',
    roles: ['PATIENT'],
    permissions: ['appointments:read'],
    status: 'ACTIVE',
  };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    jwtService = { verify: jest.fn() } as unknown as jest.Mocked<JwtService>;
    configService = {
      get: jest.fn().mockReturnValue('secret'),
    } as unknown as jest.Mocked<ConfigService>;
    guard = new JwtAuthGuard(reflector, jwtService, configService);
  });

  it('passes through public routes without checking token', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const [ctx, req] = makeContext(undefined);
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('resolves the user on public routes when a valid Bearer is sent', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    jwtService.verify.mockReturnValue(validPayload);
    const [ctx, req] = makeContext('Bearer validtoken');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user-1', email: 'user@test.com' });
  });

  it('still allows public routes when the Bearer sent is invalid', () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    jwtService.verify.mockImplementation(() => {
      throw new Error('expired');
    });
    const [ctx, req] = makeContext('Bearer badtoken');
    expect(guard.canActivate(ctx)).toBe(true);
    expect(req.user).toBeUndefined();
  });

  it('throws AUTH_MISSING_TOKEN when no Authorization header', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const [ctx] = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws AUTH_MISSING_TOKEN when header does not start with Bearer', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const [ctx] = makeContext('Basic xyz');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws AUTH_INVALID_TOKEN when jwt.verify throws', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockImplementation(() => {
      throw new Error('expired');
    });
    const [ctx] = makeContext('Bearer badtoken');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws AUTH_INVALID_TOKEN when tokenType is not access', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockReturnValue({ ...validPayload, tokenType: 'refresh' });
    const [ctx] = makeContext('Bearer token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws AUTH_INVALID_TOKEN when status is not ACTIVE', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockReturnValue({ ...validPayload, status: 'SUSPENDED' });
    const [ctx] = makeContext('Bearer token');
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('sets request.user and returns true for valid token', () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    jwtService.verify.mockReturnValue(validPayload);
    const [ctx, req] = makeContext('Bearer validtoken');
    const result = guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(req.user).toMatchObject({ sub: 'user-1', email: 'user@test.com' });
  });
});
