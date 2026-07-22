import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

const makeContext = (userRoles: string[]) =>
  ({
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { roles: userRoles } }),
    }),
  }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as unknown as jest.Mocked<Reflector>;
    guard = new RolesGuard(reflector);
  });

  it('passes through public routes', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true).mockReturnValueOnce([]);
    expect(guard.canActivate(makeContext([]))).toBe(true);
  });

  it('allows when no roles required', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(undefined);
    expect(guard.canActivate(makeContext(['PATIENT']))).toBe(true);
  });

  it('allows when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['ADMIN']);
    expect(guard.canActivate(makeContext(['ADMIN', 'PATIENT']))).toBe(true);
  });

  it('denies when user lacks required role', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['ADMIN']);
    expect(() => guard.canActivate(makeContext(['PATIENT']))).toThrow(ForbiddenException);
  });

  it('denies when user has no roles at all', () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(['THERAPIST']);
    expect(() => guard.canActivate(makeContext([]))).toThrow(ForbiddenException);
  });
});
