import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSecurityService } from './file-security.service';

const configuration = {
  files: { maxUploadMb: 8 },
  jwt: { accessSecret: 'a-secure-upload-token-secret-with-32-bytes' },
};

describe('FileSecurityService', () => {
  let service: FileSecurityService;
  let temporaryDirectory: string;

  beforeEach(async () => {
    service = new FileSecurityService(new ConfigService(configuration));
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'file-security-'));
  });

  afterEach(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true });
  });

  it('accepts a PNG only when the content signature matches the declared MIME type', async () => {
    const filePath = join(temporaryDirectory, 'upload');
    await writeFile(filePath, Buffer.from('89504e470d0a1a0a00000000', 'hex'));

    const result = await service.validateTemporaryFile({
      path: filePath,
      size: 12,
      mimetype: 'image/png',
      originalname: 'avatar.png',
    } as Express.Multer.File);

    expect(result.mimeType).toBe('image/png');
    expect(result.extension).toBe('.png');
    expect(result.checksum).toHaveLength(64);
  });

  it('rejects a file whose real signature does not match the declared MIME type', async () => {
    const filePath = join(temporaryDirectory, 'upload');
    await writeFile(filePath, Buffer.from('%PDF-1.7'));

    await expect(
      service.validateTemporaryFile({
        path: filePath,
        size: 8,
        mimetype: 'image/png',
        originalname: 'forged.png',
      } as Express.Multer.File),
    ).rejects.toMatchObject({ response: { code: 'FILE_CONTENT_TYPE_MISMATCH' } });
  });

  it('detects tampering in direct-upload authorization tokens', () => {
    const token = service.signUploadToken({
      v: 1,
      userId: 'user-id',
      publicId: 'public/image',
      objectKey: 'public/image',
      module: 'CMS',
      visibility: 'PUBLIC',
      originalName: 'image.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      exp: Math.floor(Date.now() / 1_000) + 600,
    });

    expect(() => service.verifyUploadToken(`${token}tampered`)).toThrow();
  });
});
