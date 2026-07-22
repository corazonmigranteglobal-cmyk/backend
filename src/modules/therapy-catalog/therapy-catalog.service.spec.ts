import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { TherapyApproach, TherapyProduct } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { TherapyCatalogService } from './therapy-catalog.service';

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
  id: 'prod-1',
  name: 'Sesion Individual',
  status: 'ACTIVE',
  toJSON: function () {
    return { ...this };
  },
  update: jest.fn().mockResolvedValue(undefined),
  sequelize: {
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
  },
  ...overrides,
});

const makeApproach = (overrides: Record<string, unknown> = {}) => ({
  id: 'app-1',
  name: 'CBT',
  status: 'ACTIVE',
  toJSON: function () {
    return { ...this };
  },
  update: jest.fn().mockResolvedValue(undefined),
  sequelize: {
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
  },
  ...overrides,
});

describe('TherapyCatalogService', () => {
  let service: TherapyCatalogService;

  const approachModel = {
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const productModel = {
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        TherapyCatalogService,
        { provide: getModelToken(TherapyApproach), useValue: approachModel },
        { provide: getModelToken(TherapyProduct), useValue: productModel },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TherapyCatalogService);
  });

  describe('getProductOrFail()', () => {
    it('returns product when found', async () => {
      const product = makeProduct();
      productModel.findByPk.mockResolvedValue(product);
      const result = await service.getProductOrFail('prod-1');
      expect(result.id).toBe('prod-1');
    });

    it('throws NotFoundException when product does not exist', async () => {
      productModel.findByPk.mockResolvedValue(null);
      await expect(service.getProductOrFail('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listApproaches()', () => {
    it('returns paginated approaches', async () => {
      approachModel.findAndCountAll.mockResolvedValue({
        rows: [makeApproach()],
        count: 1,
      });
      const result = await service.listApproaches({ page: 1, limit: 10 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.pagination).toBeDefined();
    });

    it('filters by ACTIVE status when publicOnly=true', async () => {
      approachModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
      await service.listPublicApproaches({ page: 1, limit: 10 } as any);
      const whereArg = approachModel.findAndCountAll.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ACTIVE');
    });

    it('does not filter by status when publicOnly=false', async () => {
      approachModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
      await service.listApproaches({ page: 1, limit: 10 } as any, false);
      const whereArg = approachModel.findAndCountAll.mock.calls[0][0].where;
      expect(whereArg.status).toBeUndefined();
    });
  });

  describe('listProducts()', () => {
    it('returns paginated products', async () => {
      productModel.findAndCountAll.mockResolvedValue({
        rows: [makeProduct()],
        count: 1,
      });
      const result = await service.listProducts({ page: 1, limit: 10 } as any);
      expect(result.items).toHaveLength(1);
    });

    it('filters by ACTIVE status when publicOnly=true', async () => {
      productModel.findAndCountAll.mockResolvedValue({ rows: [], count: 0 });
      await service.listProducts({ page: 1, limit: 10 } as any, true);
      const whereArg = productModel.findAndCountAll.mock.calls[0][0].where;
      expect(whereArg.status).toBe('ACTIVE');
    });
  });

  describe('createApproach()', () => {
    it('creates approach with auto-generated slug and logs audit', async () => {
      const approach = makeApproach();
      approachModel.create.mockResolvedValue(approach);
      approachModel.sequelize.transaction.mockImplementation(
        (cb: (t: unknown) => Promise<unknown>) => cb({}),
      );

      await service.createApproach('admin-1', { name: 'Mindfulness', sortOrder: 1 } as any);

      expect(approachModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'mindfulness', name: 'Mindfulness' }),
        expect.anything(),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'therapy.create_approach' }),
        expect.anything(),
      );
    });
  });
});
