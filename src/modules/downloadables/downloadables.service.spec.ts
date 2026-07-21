import { DownloadablesService } from './downloadables.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

function makeService(premium: boolean) {
  const resourceModel = {
    findByPk: jest.fn(),
    findOne: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    increment: jest.fn(),
  };
  const eventModel = { create: jest.fn().mockResolvedValue(undefined), findAndCountAll: jest.fn(), count: jest.fn() };
  const subscriberModel = {
    findOne: jest.fn().mockResolvedValue(
      premium ? { status: 'ACTIVE', subscriptionTier: 'PREMIUM', premiumUntil: null } : null,
    ),
  };
  const hotmart = { isConfigured: () => false };
  const service = new DownloadablesService(
    resourceModel as any,
    eventModel as any,
    subscriberModel as any,
    hotmart as any,
  );
  return { service, resourceModel, eventModel, subscriberModel };
}

const publicUser: AuthenticatedUser = { sub: 'u1', email: 'a@b.c', roles: ['PACIENTE'], permissions: [], status: 'ACTIVE' };
const adminUser: AuthenticatedUser = { sub: 'admin', email: 'a@b.c', roles: ['ADMIN'], permissions: [], status: 'ACTIVE' };

function resource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    version: 1,
    fileUrl: 'https://cdn/file.pdf',
    ...overrides,
  } as any;
}

describe('DownloadablesService — control de acceso', () => {
  it('PUBLIC: descarga directa para cualquiera', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(resource({ visibility: 'PUBLIC' }), publicUser);
    expect(d.allowed).toBe(true);
    expect(d.action).toBe('DIRECT_DOWNLOAD');
  });

  it('PREMIUM: usuario no premium NO puede, se pide upgrade', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), publicUser);
    expect(d.allowed).toBe(false);
    expect(d.action).toBe('UPGRADE_REQUIRED');
  });

  it('PREMIUM: usuario premium SÍ puede', async () => {
    const { service } = makeService(true);
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), publicUser);
    expect(d.allowed).toBe(true);
    expect(d.action).toBe('PREMIUM_DOWNLOAD');
  });

  it('PREMIUM: sin sesión pide login', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), undefined);
    expect(d.allowed).toBe(false);
    expect(d.action).toBe('LOGIN_REQUIRED');
  });

  it('PRIVATE: denegado en backend (no solo oculto)', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(resource({ visibility: 'PRIVATE' }), publicUser);
    expect(d.allowed).toBe(false);
    expect(d.action).toBe('NOT_AVAILABLE');
  });

  it('PURCHASE_REQUIRED con Hotmart configurado: ofrece checkout', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(
      resource({ visibility: 'PURCHASE_REQUIRED', hotmartProductId: 'p1', hotmartCheckoutUrl: 'https://pay/x' }),
      publicUser,
    );
    expect(d.allowed).toBe(false);
    expect(d.action).toBe('HOTMART_CHECKOUT');
    expect(d.checkoutUrl).toBe('https://pay/x');
  });

  it('Admin puede descargar aunque no esté publicado', async () => {
    const { service } = makeService(false);
    const d = await service.evaluateAccess(resource({ status: 'DRAFT', visibility: 'PRIVATE' }), adminUser);
    expect(d.allowed).toBe(true);
    expect(d.action).toBe('DIRECT_DOWNLOAD');
  });

  it('resolveDownload deniega y audita cuando no hay acceso', async () => {
    const { service, eventModel } = makeService(false);
    await expect(
      service.resolveDownload(resource({ visibility: 'PREMIUM' }), publicUser, {}),
    ).rejects.toMatchObject({ response: { code: 'DOWNLOAD_NOT_AUTHORIZED' } });
    // Debe registrar REQUESTED + DENIED
    expect(eventModel.create).toHaveBeenCalledTimes(2);
  });

  it('resolveDownload autoriza y devuelve la URL en recurso público', async () => {
    const { service, resourceModel } = makeService(false);
    resourceModel.increment.mockResolvedValue(undefined);
    const out = await service.resolveDownload(resource({ visibility: 'PUBLIC' }), publicUser, {});
    expect(out.url).toBe('https://cdn/file.pdf');
    expect(out.action).toBe('DIRECT_DOWNLOAD');
  });
});
