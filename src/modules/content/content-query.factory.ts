import { Op, WhereOptions } from 'sequelize';
import { ContentPublication } from '@/database/models';
import { getEffectiveSearch, getEffectiveStatusFilter } from '@/common/pagination/pagination.dto';
import { ContentPublicationQueryDto, PublicContentQueryDto } from './dto/content-query.dto';

const ADMIN_PUBLICATION_STATUS_ALIASES: Record<string, string> = {
  DRAFT: 'DRAFT',
  BORRADOR: 'DRAFT',
  IN_REVIEW: 'IN_REVIEW',
  EN_REVISION: 'IN_REVIEW',
  SCHEDULED: 'SCHEDULED',
  PROGRAMADO: 'SCHEDULED',
  PROGRAMADA: 'SCHEDULED',
  PUBLISHED: 'PUBLISHED',
  PUBLICADO: 'PUBLISHED',
  PUBLICADA: 'PUBLISHED',
  ACTIVE: 'PUBLISHED',
  ACTIVO: 'PUBLISHED',
  ACTIVA: 'PUBLISHED',
  ARCHIVED: 'ARCHIVED',
  ARCHIVADO: 'ARCHIVED',
  ARCHIVADA: 'ARCHIVED',
  INACTIVE: 'ARCHIVED',
  INACTIVO: 'ARCHIVED',
  INACTIVA: 'ARCHIVED',
};

function normalizeToken(value?: string) {
  if (!value) return undefined;
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
}

function normalizeStatus(value?: string) {
  const token = normalizeToken(value);
  if (!token || ['ALL', 'TODOS', 'TODAS', '*'].includes(token)) return undefined;
  return ADMIN_PUBLICATION_STATUS_ALIASES[token] ?? token;
}

export function buildAdminPublicationWhere(
  query: ContentPublicationQueryDto,
): WhereOptions<ContentPublication> {
  const where: WhereOptions<ContentPublication> = {};
  const status = normalizeStatus(getEffectiveStatusFilter(query));
  const search = getEffectiveSearch(query);

  if (status) where.status = status;
  if (query.publicationType) where.publicationType = query.publicationType;
  if (query.accessType) where.accessType = query.accessType;
  if (query.authorId) where.authorId = query.authorId;
  if (search) where.title = { [Op.iLike]: `%${search}%` } as any;
  return where;
}

export function buildPublicPublicationWhere(
  query: PublicContentQueryDto,
  publicationType?: string,
) {
  const where: WhereOptions<ContentPublication> = {
    status: 'PUBLISHED',
    accessType: { [Op.in]: ['PUBLIC', 'PREMIUM'] } as any,
  };
  const search = getEffectiveSearch(query);
  if (publicationType) where.publicationType = publicationType;
  if (search) where.title = { [Op.iLike]: `%${search}%` } as any;
  return where;
}
