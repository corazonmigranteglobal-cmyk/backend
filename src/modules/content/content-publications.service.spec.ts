import { ContentPublicationsService } from './content-publications.service';

const makeTx = () => ({ commit: jest.fn(), rollback: jest.fn() });

const makeService = () => {
  const tx = makeTx();
  const publicationModel = {
    findOne: jest.fn(),
    findByPk: jest.fn(),
    findAndCountAll: jest.fn(),
    create: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(tx)),
    },
  };
  const relations = {
    assertReferences: jest.fn().mockResolvedValue(undefined),
    replaceTags: jest.fn().mockResolvedValue(undefined),
    syncEmbedPages: jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new ContentPublicationsService(
    publicationModel as any,
    relations as any,
    audit as any,
  );

  return { service, publicationModel, relations, audit, tx };
};

describe('ContentPublicationsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getPublicBySlug()', () => {
    it('throws NotFoundException when slug does not exist', async () => {
      const { service, publicationModel } = makeService();
      publicationModel.findOne.mockResolvedValue(null);

      await expect(service.getPublicBySlug('nonexistent-slug')).rejects.toThrow();
    });

    it('returns a publication when slug exists and status is PUBLISHED', async () => {
      const { service, publicationModel } = makeService();
      const mockPublication = {
        id: 'pub-1',
        slug: 'test-slug',
        title: 'Test Article',
        status: 'PUBLISHED',
        accessType: 'PUBLIC',
        body: 'Content here',
        summary: 'Summary',
        publicationType: 'NEWS',
        author: { displayName: 'Ana Garcia' },
        category: { name: 'Salud Mental' },
        tags: [],
        seoMetadata: {},
        publishedAt: new Date().toISOString(),
        toJSON: () => ({}),
      };
      publicationModel.findOne.mockResolvedValue(mockPublication);

      const result = await service.getPublicBySlug('test-slug');
      expect(result).toBeDefined();
    });
  });

  describe('create()', () => {
    it('asserts references and creates a publication in DRAFT status', async () => {
      const { service, publicationModel, relations, audit } = makeService();
      const created = {
        id: 'pub-new',
        status: 'DRAFT',
        slug: 'nuevo-articulo',
        reload: jest.fn().mockResolvedValue({}),
        toJSON: () => ({ id: 'pub-new', status: 'DRAFT' }),
      };
      publicationModel.create.mockResolvedValue(created);
      // getAdmin path — findByPk returns same object
      publicationModel.findByPk.mockResolvedValue(created);

      await service.create('admin-1', {
        title: 'Nuevo articulo',
        summary: 'Resumen',
        body: 'Contenido',
        authorId: 'author-1',
        categoryId: 'cat-1',
        publicationType: 'NEWS',
        accessType: 'PUBLIC',
      } as any);

      expect(relations.assertReferences).toHaveBeenCalledWith('author-1', 'cat-1', undefined);
      expect(publicationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DRAFT' }),
        expect.anything(),
      );
      expect(audit.log).toHaveBeenCalled();
    });
  });

  describe('publish()', () => {
    it('throws NotFoundException when publication does not exist', async () => {
      const { service, publicationModel } = makeService();
      publicationModel.findByPk.mockResolvedValue(null);

      await expect(service.publish('admin-1', 'nonexistent-id')).rejects.toMatchObject({
        response: { code: 'CONTENT_PUBLICATION_NOT_FOUND' },
      });
    });

    it('sets status to PUBLISHED and records publishedAt', async () => {
      const { service, publicationModel, audit } = makeService();
      const pub = {
        id: 'pub-1',
        status: 'DRAFT',
        slug: 'articulo-test',
        title: 'Test Article',
        summary: 'Test summary',
        body: 'Test body content',
        accessType: 'PUBLIC',
        publicationType: 'NEWS',
        toJSON: () => ({ id: 'pub-1', status: 'DRAFT' }),
        update: jest.fn().mockResolvedValue({}),
        sequelize: {
          transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')),
        },
      };
      // find() uses findByPk
      publicationModel.findByPk
        .mockResolvedValueOnce(pub) // first call: find()
        .mockResolvedValueOnce(pub); // second call: getAdmin() after update

      await service.publish('admin-1', 'pub-1');

      expect(pub.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PUBLISHED', publishedAt: expect.any(Date) }),
        { transaction: 'tx' },
      );
      expect(audit.log).toHaveBeenCalled();
    });
  });
});
