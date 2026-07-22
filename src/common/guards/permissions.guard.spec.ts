import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

const makeContext = (userPermissions: string[]) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { permissions: userPermissions } }),
    }),
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new PermissionsGuard(reflector);
  });

  it('passes through public routes', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true).mockReturnValueOnce([]);
    expect(guard.canActivate(makeContext([]))).toBe(true);
  });

  it('allows when no permissions required', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    expect(guard.canActivate(makeContext(['appointments:read']))).toBe(true);
  });

  it('allows when user has ALL required permissions', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['appointments:read', 'appointments:write']);
    expect(
      guard.canActivate(makeContext(['appointments:read', 'appointments:write', 'users:read'])),
    ).toBe(true);
  });

  it('denies when user is missing one permission', () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['appointments:read', 'appointments:write']);
    expect(() => guard.canActivate(makeContext(['appointments:read']))).toThrow(ForbiddenException);
  });

  it('denies when user has no permissions', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['analytics:read']);
    expect(() => guard.canActivate(makeContext([]))).toThrow(ForbiddenException);
  });
});
