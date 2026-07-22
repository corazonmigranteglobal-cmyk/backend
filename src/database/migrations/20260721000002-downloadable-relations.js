'use strict';

/**
 * Módulo de descargables — tablas relacionales.
 *  - downloadable_resource_versions : revisiones/versiones (la publicada es inmutable).
 *  - downloadable_entitlements      : derechos de acceso por usuario (premium/compra/admin).
 *  - downloadable_publication_links : relación publicación ↔ descargable.
 *  - downloadable_external_events   : eventos externos (Hotmart) para idempotencia.
 *
 * Migración idempotente.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS downloadable_resource_versions (
        id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        resource_id    UUID          NOT NULL REFERENCES downloadable_resources (id) ON DELETE CASCADE,
        version_number INTEGER       NOT NULL,
        status         VARCHAR(30)   NOT NULL DEFAULT 'DRAFT',
        title          VARCHAR(200)  NULL,
        metadata       JSONB         NOT NULL DEFAULT '{}',
        file_url       TEXT          NULL,
        file_object_key VARCHAR(400) NULL,
        change_reason  VARCHAR(400)  NULL,
        review_comment VARCHAR(600)  NULL,
        is_published   BOOLEAN       NOT NULL DEFAULT false,
        author_id      UUID          NULL,
        reviewed_by    UUID          NULL,
        reviewed_at    TIMESTAMPTZ   NULL,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_downloadable_version UNIQUE (resource_id, version_number),
        CONSTRAINT chk_downloadable_version_status
          CHECK (status IN ('DRAFT','IN_REVIEW','CHANGES_REQUESTED','APPROVED','PUBLISHED','ARCHIVED','REJECTED'))
      );
      CREATE INDEX IF NOT EXISTS idx_downloadable_versions_resource
        ON downloadable_resource_versions (resource_id, version_number DESC);

      CREATE TABLE IF NOT EXISTS downloadable_entitlements (
        id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        resource_id    UUID          NOT NULL REFERENCES downloadable_resources (id) ON DELETE CASCADE,
        user_id        UUID          NULL,
        subject_email  VARCHAR(180)  NULL,
        source         VARCHAR(40)   NOT NULL DEFAULT 'ADMIN_GRANT',
        status         VARCHAR(30)   NOT NULL DEFAULT 'ACTIVE',
        external_reference VARCHAR(180) NULL,
        external_transaction VARCHAR(180) NULL,
        granted_by     UUID          NULL,
        granted_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        revoked_at     TIMESTAMPTZ   NULL,
        expires_at     TIMESTAMPTZ   NULL,
        CONSTRAINT chk_downloadable_entitlement_source
          CHECK (source IN ('ADMIN_GRANT','PREMIUM','PURCHASE','ROLE','TEAM','PROMOTION','TEMPORARY')),
        CONSTRAINT chk_downloadable_entitlement_status
          CHECK (status IN ('ACTIVE','REVOKED','EXPIRED'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_entitlement_resource_user_ref
        ON downloadable_entitlements (resource_id, user_id, external_reference)
        WHERE user_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_entitlement_user
        ON downloadable_entitlements (user_id, status);

      CREATE TABLE IF NOT EXISTS downloadable_publication_links (
        id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        publication_id UUID          NOT NULL,
        resource_id    UUID          NOT NULL REFERENCES downloadable_resources (id) ON DELETE CASCADE,
        label          VARCHAR(120)  NULL,
        is_primary     BOOLEAN       NOT NULL DEFAULT false,
        sort_order     INTEGER       NOT NULL DEFAULT 0,
        created_by     UUID          NULL,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_publication_downloadable UNIQUE (publication_id, resource_id)
      );
      CREATE INDEX IF NOT EXISTS idx_publink_publication
        ON downloadable_publication_links (publication_id, sort_order);

      CREATE TABLE IF NOT EXISTS downloadable_external_events (
        id             UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        provider       VARCHAR(40)   NOT NULL DEFAULT 'HOTMART',
        event_id       VARCHAR(180)  NOT NULL,
        product_id     VARCHAR(120)  NULL,
        status         VARCHAR(40)   NULL,
        external_reference VARCHAR(180) NULL,
        payload        JSONB         NOT NULL DEFAULT '{}',
        processed      BOOLEAN       NOT NULL DEFAULT false,
        result         VARCHAR(40)   NULL,
        created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_external_event UNIQUE (provider, event_id)
      );
      CREATE INDEX IF NOT EXISTS idx_external_events_product
        ON downloadable_external_events (product_id, created_at DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS downloadable_external_events;
      DROP TABLE IF EXISTS downloadable_publication_links;
      DROP TABLE IF EXISTS downloadable_entitlements;
      DROP TABLE IF EXISTS downloadable_resource_versions;
    `);
  },
};
