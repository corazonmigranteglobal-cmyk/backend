import { DownloadablesService } from './downloadables.service';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';

function makeService(opts: { premium?: boolean; entitled?: boolean } = {}) {
  const store: any = { resources: new Map(), versions: [], entitlements: [], links: [], external: new Map() };

  const resourceModel = {
    findByPk: jest.fn(async (id: string) => store.resources.get(id) ?? null),
    findOne: jest.fn(),
    findAll: jest.fn(async () => [...store.resources.values()]),
    findAndCountAll: jest.fn(async () => ({ rows: [...store.resources.values()], count: store.resources.size })),
    create: jest.fn(),
    count: jest.fn(async () => 0),
    increment: jest.fn(),
  };
  const eventModel = { create: jest.fn().mockResolvedValue(undefined), findAndCountAll: jest.fn(), count: jest.fn().mockResolvedValue(0), update: jest.fn() };
  const versionModel = {
    create: jest.fn(async (v: any) => ({ ...v, id: 'v-' + (store.versions.length + 1), update: jest.fn(async function (this: any, u: any) { Object.assign(this, u); }) })),
    findOne: jest.fn(),
    findAll: jest.fn(async () => store.versions),
  };
  const entitlementModel = {
    findOne: jest.fn(async () => (opts.entitled ? { status: 'ACTIVE', update: jest.fn() } : null)),
    findAll: jest.fn(async () => []),
    create: jest.fn(async (e: any) => ({ ...e, id: 'e1' })),
    update: jest.fn().mockResolvedValue([1]),
  };
  const linkModel = { findOrCreate: jest.fn(async () => [{ id: 'l1' }, true]), destroy: jest.fn().mockResolvedValue(1), findAll: jest.fn(async () => []), update: jest.fn() };
  const externalEventModel = {
    findOrCreate: jest.fn(),
  };
  const subscriberModel = {
    findOne: jest.fn().mockResolvedValue(opts.premium ? { status: 'ACTIVE', subscriptionTier: 'PREMIUM', premiumUntil: null } : null),
  };
  const hotmart = {
    isConfigured: () => true,
    verifyNotification: jest.fn((): { valid: boolean; reason?: string } => ({ valid: true })),
    grantsAccess: (p: any) => p.status === 'APPROVED',
    revokesAccess: (p: any) => ['REFUNDED', 'CHARGEBACK', 'CANCELLED'].includes(p.status),
  };
  const notifications = { emit: jest.fn().mockResolvedValue(undefined) };

  const service = new DownloadablesService(
    resourceModel as any, eventModel as any, versionModel as any, entitlementModel as any,
    linkModel as any, externalEventModel as any, subscriberModel as any, hotmart as any, notifications as any,
  );
  return { service, resourceModel, eventModel, versionModel, entitlementModel, linkModel, externalEventModel, subscriberModel, hotmart, notifications, store };
}

const publicUser: AuthenticatedUser = { sub: 'u1', email: 'a@b.c', roles: ['PACIENTE'], permissions: [], status: 'ACTIVE' };
const adminUser: AuthenticatedUser = { sub: 'admin', email: 'a@b.c', roles: ['ADMIN'], permissions: [], status: 'ACTIVE' };

function resource(overrides: Record<string, unknown> = {}) {
  return { id: 'r1', status: 'PUBLISHED', visibility: 'PUBLIC', version: 1, fileUrl: 'https://cdn/file.pdf', ...overrides } as any;
}

describe('DownloadablesService — control de acceso', () => {
  it('PUBLIC: descarga directa', async () => {
    const { service } = makeService();
    const d = await service.evaluateAccess(resource({ visibility: 'PUBLIC' }), publicUser);
    expect(d).toMatchObject({ allowed: true, action: 'DIRECT_DOWNLOAD' });
  });
  it('PREMIUM sin membresia: upgrade', async () => {
    const { service } = makeService({ premium: false });
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), publicUser);
    expect(d).toMatchObject({ allowed: false, action: 'UPGRADE_REQUIRED' });
  });
  it('PREMIUM con membresia: permitido', async () => {
    const { service } = makeService({ premium: true });
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), publicUser);
    expect(d).toMatchObject({ allowed: true, action: 'PREMIUM_DOWNLOAD' });
  });
  it('PREMIUM con entitlement explicito: permitido aunque no sea premium', async () => {
    const { service } = makeService({ premium: false, entitled: true });
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), publicUser);
    expect(d.allowed).toBe(true);
  });
  it('PREMIUM sin sesion: login', async () => {
    const { service } = makeService();
    const d = await service.evaluateAccess(resource({ visibility: 'PREMIUM' }), undefined);
    expect(d.action).toBe('LOGIN_REQUIRED');
  });
  it('PRIVATE sin entitlement: no disponible', async () => {
    const { service } = makeService({ entitled: false });
    const d = await service.evaluateAccess(resource({ visibility: 'PRIVATE' }), publicUser);
    expect(d).toMatchObject({ allowed: false, action: 'NOT_AVAILABLE' });
  });
  it('PRIVATE con entitlement: permitido', async () => {
    const { service } = makeService({ entitled: true });
    const d = await service.evaluateAccess(resource({ visibility: 'PRIVATE' }), publicUser);
    expect(d.allowed).toBe(true);
  });
  it('PURCHASE_REQUIRED sin compra + hotmart: checkout', async () => {
    const { service } = makeService();
    const d = await service.evaluateAccess(resource({ visibility: 'PURCHASE_REQUIRED', hotmartProductId: 'p1', hotmartCheckoutUrl: 'https://pay/x' }), publicUser);
    expect(d).toMatchObject({ allowed: false, action: 'HOTMART_CHECKOUT', checkoutUrl: 'https://pay/x' });
  });
  it('PURCHASE_REQUIRED con entitlement: acceso al producto', async () => {
    const { service } = makeService({ entitled: true });
    const d = await service.evaluateAccess(resource({ visibility: 'PURCHASE_REQUIRED', hotmartProductId: 'p1', hotmartCheckoutUrl: 'https://pay/x' }), publicUser);
    expect(d).toMatchObject({ allowed: true, action: 'HOTMART_PRODUCT_ACCESS' });
  });
  it('Admin descarga aunque no publicado', async () => {
    const { service } = makeService();
    const d = await service.evaluateAccess(resource({ status: 'DRAFT', visibility: 'PRIVATE' }), adminUser);
    expect(d).toMatchObject({ allowed: true, action: 'DIRECT_DOWNLOAD' });
  });
});

describe('DownloadablesService — descarga segura', () => {
  it('deniega y audita (REQUESTED + DENIED)', async () => {
    const { service, eventModel } = makeService();
    await expect(service.resolveDownload(resource({ visibility: 'PREMIUM' }), publicUser, {})).rejects.toMatchObject({ response: { code: 'DOWNLOAD_NOT_AUTHORIZED' } });
    expect(eventModel.create).toHaveBeenCalledTimes(2);
  });
  it('autoriza y devuelve URL', async () => {
    const { service, resourceModel } = makeService();
    resourceModel.increment.mockResolvedValue(undefined);
    const out = await service.resolveDownload(resource({ visibility: 'PUBLIC' }), publicUser, {});
    expect(out).toMatchObject({ url: 'https://cdn/file.pdf', action: 'DIRECT_DOWNLOAD' });
  });
});

describe('DownloadablesService — versionado', () => {
  it('publica solo una version aprobada (inmutable)', async () => {
    const { service, versionModel, resourceModel, store } = makeService();
    const version: any = { id: 'v1', resourceId: 'r1', versionNumber: 2, status: 'DRAFT', update: jest.fn(async function (this: any, u: any) { Object.assign(this, u); }) };
    versionModel.findOne.mockResolvedValue(version);
    store.resources.set('r1', resource({ update: jest.fn() }));
    // no aprobada -> error
    await expect(service.publishVersion('r1', 'v1')).rejects.toThrow(/aprobada/);
    version.status = 'APPROVED';
    const res = await service.publishVersion('r1', 'v1');
    expect(version.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'PUBLISHED', isPublished: true }));
    expect(res).toBeDefined();
  });
  it('rechaza transicion invalida', async () => {
    const { service, versionModel } = makeService();
    versionModel.findOne.mockResolvedValue({ id: 'v1', resourceId: 'r1', status: 'DRAFT', update: jest.fn() });
    // DRAFT -> APPROVED no permitido
    await expect(service.approveVersion('r1', 'v1')).rejects.toThrow(/no permitida/);
  });
});

describe('DownloadablesService — Hotmart idempotente', () => {
  it('procesa una vez y concede acceso (APPROVED)', async () => {
    const { service, externalEventModel, entitlementModel, resourceModel } = makeService();
    const event: any = { processed: false, result: null, update: jest.fn(async function (this: any, u: any) { Object.assign(this, u); }) };
    externalEventModel.findOrCreate.mockResolvedValue([event, true]);
    resourceModel.findAll.mockResolvedValue([resource({ id: 'r1' })]);
    const out = await service.processHotmartNotification({ eventId: 'evt1', productId: 'p1', status: 'APPROVED', buyerUserId: 'u9', rawSignature: 'x' } as any);
    expect(out).toMatchObject({ idempotent: false, result: 'ACCESS_GRANTED' });
    expect(entitlementModel.create).toHaveBeenCalled();
  });
  it('segundo evento con mismo id: idempotente (no reprocesa)', async () => {
    const { service, externalEventModel } = makeService();
    externalEventModel.findOrCreate.mockResolvedValue([{ processed: true, result: 'ACCESS_GRANTED' }, false]);
    const out = await service.processHotmartNotification({ eventId: 'evt1', productId: 'p1', status: 'APPROVED', rawSignature: 'x' } as any);
    expect(out).toMatchObject({ idempotent: true });
  });
  it('firma invalida: rechazada', async () => {
    const { service, hotmart } = makeService();
    hotmart.verifyNotification.mockReturnValue({ valid: false, reason: 'firma invalida' });
    await expect(service.processHotmartNotification({ eventId: 'evt2', productId: 'p1', status: 'APPROVED' } as any)).rejects.toMatchObject({ response: { code: 'HOTMART_INVALID_SIGNATURE' } });
  });
});

describe('DownloadablesService — publicaciones', () => {
  it('adjunta descargable a publicacion', async () => {
    const { service, resourceModel, store } = makeService();
    store.resources.set('r1', resource());
    resourceModel.findByPk.mockResolvedValue(resource());
    const link = await service.attachToPublication('pub1', 'r1', { label: 'Guia' });
    expect(link).toBeDefined();
  });
});
