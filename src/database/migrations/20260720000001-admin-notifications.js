'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id            UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        type          VARCHAR(100)  NOT NULL,
        entity_type   VARCHAR(100)  NULL,
        entity_id     UUID          NULL,
        payload       JSONB         NOT NULL DEFAULT '{}',
        is_read       BOOLEAN       NOT NULL DEFAULT false,
        read_at       TIMESTAMPTZ   NULL,
        recipient_role VARCHAR(50)  NOT NULL DEFAULT 'ADMIN',
        created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_admin_notifications_is_read
        ON admin_notifications (is_read, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_admin_notifications_type
        ON admin_notifications (type, created_at DESC);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TABLE IF EXISTS admin_notifications;
    `);
  },
};
