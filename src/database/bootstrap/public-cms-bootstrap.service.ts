import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';

type PublicPageRow = {
  id: string;
};

type PublicElementRow = {
  id: string;
};

/**
 * Seed mínimo y seguro para que la vista pública legacy `/public-views/1`
 * tenga una página `inicio` publicada incluso en bases productivas nuevas.
 */
@Injectable()
export class PublicCmsBootstrapService {
  private readonly logger = new Logger(PublicCmsBootstrapService.name);

  constructor(private readonly sequelize: Sequelize) {}

  async ensureDefaults(): Promise<void> {
    const pageId = await this.ensureInicioPage();
    await this.ensureHeroElement(pageId);
    await this.ensureAboutElement(pageId);
  }

  private async ensureInicioPage(): Promise<string> {
    const existing = await this.sequelize.query<PublicPageRow>(
      `
        SELECT id::text AS id
        FROM cms_pages
        WHERE slug = :slug
          AND deleted_at IS NULL
        LIMIT 1;
      `,
      {
        replacements: { slug: 'inicio' },
        type: QueryTypes.SELECT,
      },
    );

    if (existing[0]?.id) {
      await this.sequelize.query(
        `
          UPDATE cms_pages
          SET
            status = 'PUBLISHED',
            title = COALESCE(NULLIF(title, ''), 'Inicio'),
            published_at = COALESCE(published_at, NOW()),
            seo_metadata = CASE
              WHEN seo_metadata IS NULL OR seo_metadata = '{}'::jsonb
                THEN CAST(:seoMetadata AS jsonb)
              ELSE seo_metadata
            END,
            updated_at = NOW()
          WHERE id = CAST(:id AS uuid);
        `,
        {
          replacements: {
            id: existing[0].id,
            seoMetadata: JSON.stringify({ description: 'Corazón Migrante' }),
          },
        },
      );
      return existing[0].id;
    }

    const id = randomUUID();
    await this.sequelize.query(
      `
        INSERT INTO cms_pages (
          id,
          slug,
          title,
          status,
          seo_metadata,
          published_at,
          created_at,
          updated_at
        )
        VALUES (
          CAST(:id AS uuid),
          'inicio',
          'Inicio',
          'PUBLISHED',
          CAST(:seoMetadata AS jsonb),
          NOW(),
          NOW(),
          NOW()
        );
      `,
      {
        replacements: {
          id,
          seoMetadata: JSON.stringify({ description: 'Corazón Migrante' }),
        },
      },
    );

    this.logger.log('Página pública inicial creada: slug=inicio.');
    return id;
  }

  private async ensureHeroElement(pageId: string): Promise<void> {
    await this.upsertElement(pageId, {
      code: 'hero',
      type: 'HERO',
      sortOrder: 0,
      content: {
        eyebrow: 'Corazón Migrante',
        title: 'Acompañamiento humano para personas migrantes',
        subtitle:
          'Un espacio digital para orientar, informar y conectar servicios de apoyo con quienes más lo necesitan.',
        primaryActionLabel: 'Conocer servicios',
        primaryActionHref: '#servicios',
      },
    });
  }

  private async ensureAboutElement(pageId: string): Promise<void> {
    await this.upsertElement(pageId, {
      code: 'about',
      type: 'SECTION',
      sortOrder: 10,
      content: {
        title: 'Información clara, apoyo real y acceso simple',
        body:
          'La plataforma centraliza contenido público, recursos, campañas y canales de contacto para mejorar la experiencia de atención.',
      },
    });
  }

  private async upsertElement(
    pageId: string,
    input: {
      code: string;
      type: string;
      sortOrder: number;
      content: Record<string, unknown>;
    },
  ): Promise<void> {
    const existing = await this.sequelize.query<PublicElementRow>(
      `
        SELECT id::text AS id
        FROM cms_elements
        WHERE page_id = CAST(:pageId AS uuid)
          AND code = :code
          AND deleted_at IS NULL
        LIMIT 1;
      `,
      {
        replacements: { pageId, code: input.code },
        type: QueryTypes.SELECT,
      },
    );

    if (existing[0]?.id) {
      await this.sequelize.query(
        `
          UPDATE cms_elements
          SET
            type = :type,
            status = 'ACTIVE',
            sort_order = :sortOrder,
            content = CASE
              WHEN content IS NULL OR content = '{}'::jsonb
                THEN CAST(:content AS jsonb)
              ELSE content
            END,
            updated_at = NOW()
          WHERE id = CAST(:id AS uuid);
        `,
        {
          replacements: {
            id: existing[0].id,
            type: input.type,
            sortOrder: input.sortOrder,
            content: JSON.stringify(input.content),
          },
        },
      );
      return;
    }

    await this.sequelize.query(
      `
        INSERT INTO cms_elements (
          id,
          page_id,
          code,
          type,
          content,
          sort_order,
          status,
          created_at,
          updated_at
        )
        VALUES (
          CAST(:id AS uuid),
          CAST(:pageId AS uuid),
          :code,
          :type,
          CAST(:content AS jsonb),
          :sortOrder,
          'ACTIVE',
          NOW(),
          NOW()
        );
      `,
      {
        replacements: {
          id: randomUUID(),
          pageId,
          code: input.code,
          type: input.type,
          content: JSON.stringify(input.content),
          sortOrder: input.sortOrder,
        },
      },
    );
  }
}
