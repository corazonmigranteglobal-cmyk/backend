import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { CmsElement, CmsPage, ContentPublication } from '@/database/models';
import { AuditService } from '../audit/audit.service';
import { CmsService } from './cms.service';

const makePage = (overrides: Record<string, unknown> = {}) => ({
  id: 'page-1',
  slug: 'inicio',
  status: 'PUBLISHED',
  toJSON: function () {
    return { id: this.id, slug: this.slug, status: this.status };
  },
  update: jest.fn().mockResolvedValue(undefined),
  sequelize: {
    transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
  },
  ...overrides,
});

const makeElement = (overrides: Record<string, unknown> = {}) => ({
  id: 'elem-1',
  pageId: 'page-1',
  status: 'ACTIVE',
  sortOrder: 0,
  toJSON: function () {
    return { id: this.id, pageId: this.pageId, status: this.status };
  },
  ...overrides,
});

describe('CmsService', () => {
  let service: CmsService;

  const pageModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAll: jest.fn(),
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const elementModel = {
    findAll: jest.fn(),
    create: jest.fn(),
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (t: unknown) => Promise<unknown>) => cb({})),
    },
  };
  const publicationModel = { findAll: jest.fn() };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        CmsService,
        { provide: getModelToken(CmsPage), useValue: pageModel },
        { provide: getModelToken(CmsElement), useValue: elementModel },
        { provide: getModelToken(ContentPublication), useValue: publicationModel },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(CmsService);
  });

  describe('getPublicPage()', () => {
    it('returns page with active elements', async () => {
      const page = makePage();
      const elem = makeElement();
      pageModel.findOne.mockResolvedValue(page);
      elementModel.findAll.mockResolvedValue([elem]);

      const result = await service.getPublicPage('inicio');

      expect(result.id).toBe('page-1');
      expect(result.elements).toHaveLength(1);
    });

    it('throws NotFoundException when page not found or not published', async () => {
      pageModel.findOne.mockResolvedValue(null);
      await expect(service.getPublicPage('missing')).rejects.toThrow(NotFoundException);
    });

    it('queries only PUBLISHED pages', async () => {
      pageModel.findOne.mockResolvedValue(null);
      await service.getPublicPage('inicio').catch(() => {});
      expect(pageModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
      );
    });
  });

  describe('listPages()', () => {
    it('returns all pages without status filter when not provided', async () => {
      const page = makePage();
      pageModel.findAll.mockResolvedValue([page]);

      const result = await service.listPages();

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('filters by status when provided', async () => {
      pageModel.findAll.mockResolvedValue([]);
      await service.listPages('DRAFT');
      expect(pageModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'DRAFT' } }),
      );
    });

    it('normalizes status to uppercase', async () => {
      pageModel.findAll.mockResolvedValue([]);
      await service.listPages('published');
      expect(pageModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PUBLISHED' } }),
      );
    });
  });

  describe('getAdminPage()', () => {
    it('returns page with all elements for admin', async () => {
      const page = makePage();
      const elem = makeElement();
      pageModel.findByPk.mockResolvedValue(page);
      elementModel.findAll.mockResolvedValue([elem]);

      const result = await service.getAdminPage('page-1');

      expect(result.id).toBe('page-1');
    });

    it('throws NotFoundException when page not found', async () => {
      pageModel.findByPk.mockResolvedValue(null);
      await expect(service.getAdminPage('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
