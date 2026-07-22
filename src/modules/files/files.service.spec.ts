import { FilesService } from './files.service';

const makeService = () => {
  const fileModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
    sequelize: {
      transaction: jest.fn((cb: (tx: unknown) => unknown) => cb('tx')),
    },
  };
  const config = { get: jest.fn().mockReturnValue('http://localhost:3000') };
  const storage = {
    storageProvider: 'LOCAL',
    store: jest.fn(),
    deleteObject: jest.fn(),
    cleanupTemporaryFile: jest.fn().mockResolvedValue(undefined),
  };
  const security = { validateTemporaryFile: jest.fn() };
  const directUpload = {};
  const admin = {};
  const access = {};
  const audit = { log: jest.fn().mockResolvedValue(undefined) };

  const service = new FilesService(
    fileModel as any,
    config as any,
    storage as any,
    security as any,
    directUpload as any,
    admin as any,
    access as any,
    audit as any,
  );

  return { service, fileModel, config, storage, security, audit };
};

const mockUser = {
  sub: 'user-1',
  email: 'user@example.com',
  roles: ['PATIENT'],
  permissions: [],
  status: 'ACTIVE',
};

describe('FilesService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('upload()', () => {
    it('throws FILE_REQUIRED when no file is provided', async () => {
      const { service } = makeService();

      await expect(
        service.upload(
          mockUser as any,
          { module: 'USER_PROFILE', visibility: 'PUBLIC' } as any,
          undefined,
        ),
      ).rejects.toMatchObject({ response: { code: 'FILE_REQUIRED' } });
    });

    it('throws CLOUDINARY_DIRECT_UPLOAD_REQUIRED when provider is Cloudinary and file is an image', async () => {
      const { service, storage, security } = makeService();
      storage.storageProvider = 'CLOUDINARY';
      security.validateTemporaryFile.mockResolvedValue({
        mimeType: 'image/jpeg',
        extension: 'jpg',
        originalName: 'photo.jpg',
        checksum: 'abc',
      });

      await expect(
        service.upload(
          mockUser as any,
          { module: 'USER_PROFILE', visibility: 'PUBLIC' } as any,
          { size: 1024, buffer: Buffer.from(''), path: '/tmp/photo.jpg' } as any,
        ),
      ).rejects.toMatchObject({ response: { code: 'CLOUDINARY_DIRECT_UPLOAD_REQUIRED' } });
    });

    it('stores the file and creates a DB record inside a transaction', async () => {
      const { service, storage, security, fileModel } = makeService();
      security.validateTemporaryFile.mockResolvedValue({
        mimeType: 'application/pdf',
        extension: 'pdf',
        originalName: 'document.pdf',
        checksum: 'checksum-abc',
      });
      storage.store.mockResolvedValue({
        storageProvider: 'LOCAL',
        bucket: 'local',
        objectKey: 'USER_PROFILE/user-1/doc.pdf',
        metadata: {},
      });
      fileModel.create.mockResolvedValue({
        id: 'file-1',
        visibility: 'PUBLIC',
        toJSON: () => ({ id: 'file-1' }),
        update: jest.fn().mockResolvedValue({}),
      });
      fileModel.findByPk.mockResolvedValue({
        id: 'file-1',
        visibility: 'PUBLIC',
        toJSON: () => ({ id: 'file-1' }),
      });

      await service.upload(
        mockUser as any,
        {
          module: 'USER_PROFILE',
          entityType: 'USER',
          entityId: 'user-1',
          visibility: 'PUBLIC',
        } as any,
        { size: 2048, buffer: Buffer.from('pdf'), path: '/tmp/doc.pdf' } as any,
      );

      expect(security.validateTemporaryFile).toHaveBeenCalled();
      expect(storage.store).toHaveBeenCalled();
      expect(fileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ ownerUserId: 'user-1', mimeType: 'application/pdf' }),
        { transaction: 'tx' },
      );
    });
  });
});
