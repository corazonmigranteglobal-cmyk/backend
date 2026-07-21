'use strict';

/**
 * Módulo de descargables — tablas base.
 *
 * downloadable_resources        : recurso descargable administrable, versionable
 *                                 (version incrementada en cada publicación) y con
 *                                 control de visibilidad + integración Hotmart.
 * downloadable_download_events  : auditoría de cada intento/descarga (no guarda
 *                                 tokens ni URLs firmadas completas).
 *
 * Migración idempotente: se puede correr varias veces sin romper.
 *
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS downloadable_resources (
        id                 UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        public_id          VARCHAR(60)   NOT NULL,
        slug               VARCHAR(180)  NOT NULL,
        title              VARCHAR(200)  NOT NULL,
        short_description  VARCHAR(400)  NULL,
        description        TEXT          NULL,
        resource_type      VARCHAR(60)   NOT NULL DEFAULT 'FILE',
        category           VARCHAR(120)  NULL,
        tags               JSONB         NOT NULL DEFAULT '[]',
        cover_url          TEXT          NULL,
        cover_object_key   VARCHAR(400)  NULL,
        file_url           TEXT          NULL,
        file_object_key    VARCHAR(400)  NULL,
        original_name      VARCHAR(300)  NULL,
        mime_type          VARCHAR(160)  NULL,
        extension          VARCHAR(20)   NULL,
        size_bytes         BIGINT        NULL,
        checksum           VARCHAR(128)  NULL,
        storage_provider   VARCHAR(40)   NOT NULL DEFAULT 'CLOUDINARY',
        status             VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
        visibility         VARCHAR(30)   NOT NULL DEFAULT 'PUBLIC',
        requires_premium   BOOLEAN       NOT NULL DEFAULT false,
        requires_purchase  BOOLEAN       NOT NULL DEFAULT false,
        commercial_provider VARCHAR(40)  NULL,
        hotmart_product_id VARCHAR(120)  NULL,
        hotmart_offer_id   VARCHAR(120)  NULL,
        hotmart_checkout_url TEXT        NULL,
        external_reference VARCHAR(180)  NULL,
        integration_status VARCHAR(40)   NOT NULL DEFAULT 'NONE',
        integration_last_error TEXT      NULL,
        published_at       TIMESTAMPTZ   NULL,
        expires_at         TIMESTAMPTZ   NULL,
        version            INTEGER       NOT NULL DEFAULT 1,
        download_count     BIGINT        NOT NULL DEFAULT 0,
        created_by         UUID          NULL,
        updated_by         UUID          NULL,
        approved_by        UUID          NULL,
        approved_at        TIMESTAMPTZ   NULL,
        created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        deleted_at         TIMESTAMPTZ   NULL,
        CONSTRAINT uq_downloadable_public_id UNIQUE (public_id),
        CONSTRAINT uq_downloadable_slug UNIQUE (slug),
        CONSTRAINT chk_downloadable_visibility
          CHECK (visibility IN ('PUBLIC','PREMIUM','PRIVATE','PURCHASE_REQUIRED','UNLISTED')),
        CONSTRAINT chk_downloadable_status
          CHECK (status IN ('DRAFT','IN_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','ARCHIVED','REJECTED'))
      );

      CREATE INDEX IF NOT EXISTS idx_downloadable_status_visibility
        ON downloadable_resources (status, visibility, published_at DESC);
      CREATE INDEX IF NOT EXISTS idx_downloadable_slug
        ON downloadable_resources (slug);
      CREATE INDEX IF NOT EXISTS idx_downloadable_hotmart_product
        ON downloadable_resources (hotmart_product_id);
      CREATE INDEX IF NOT EXISTS idx_downloadable_category
        ON downloadable_resources (category);

      CREATE TABLE IF NOT EXISTS downloadable_download_events (
        id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        resource_id    UUID          NOT NULL REFERENCES downloadable_resources (id) ON DELETE CASCADE,
        resource_version INTEGER     NULL,
        user_id        UUID          NULL,
        result         VARCHAR(30)   NOT NULL,
        access_method  VARCHAR(40)   NULL,
        visibility     VARCHAR(30)   NULL,
        correlation_id VARCHAR(80)   NULL,
        ip_hash        VARCHAR(128)  NULL,
        user_agent     VARCHAR(400)  NULL,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_download_events_resource
        ON downloadable_download_events (resource_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_download_events_user
        ON downloadable_download_events (user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_download_events_result
        ON downloadable_download_events (result, created_at DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS downloadable_download_events;
      DROP TABLE IF EXISTS downloadable_resources;
    `);
  },
};
