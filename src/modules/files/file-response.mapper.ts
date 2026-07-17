import { ConfigService } from '@nestjs/config';
import { FileAsset } from '@/database/models';

export function buildBackendDownloadUrl(config: ConfigService, fileId: string) {
  const baseUrl = (config.get<string>('files.publicBaseUrl') ?? '').replace(/\/+$/, '');
  const apiPrefix = (config.get<string>('app.apiPrefix') ?? 'api/v1').replace(
    /^\/+|\/+$/g,
    '',
  );
  return `${baseUrl}/${apiPrefix}/files/${fileId}/download`;
}

export function resolvePublicFileUrl(config: ConfigService, record: FileAsset) {
  const metadata = (record.metadata ?? {}) as Record<string, unknown>;
  const metadataUrl = metadata.publicUrl ?? metadata.downloadUrl ?? metadata.url;
  return typeof metadataUrl === 'string' && metadataUrl.trim()
    ? metadataUrl
    : buildBackendDownloadUrl(config, record.id);
}

/** Maps the persistence model to the stable compatibility response used by the API. */
export function toFileResponse(
  config: ConfigService,
  record: FileAsset,
  publicUrl = resolvePublicFileUrl(config, record),
) {
  const plainRecord = record.toJSON() as unknown as Record<string, unknown>;
  return {
    ...plainRecord,
    fileId: record.id,
    url: publicUrl,
    publicUrl,
    downloadUrl: publicUrl,
  };
}
