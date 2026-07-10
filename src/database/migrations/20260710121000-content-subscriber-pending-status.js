'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE existing_constraint record;
      BEGIN
        IF to_regclass('content_subscribers') IS NULL THEN
          RETURN;
        END IF;

        FOR existing_constraint IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'content_subscribers'::regclass
            AND contype = 'c'
            AND pg_get_constraintdef(oid) ILIKE '%status IN%'
        LOOP
          EXECUTE format('ALTER TABLE content_subscribers DROP CONSTRAINT IF EXISTS %I', existing_constraint.conname);
        END LOOP;

        ALTER TABLE content_subscribers
          ADD CONSTRAINT content_subscribers_status_check
          CHECK (status IN ('ACTIVE', 'PENDING', 'UNSUBSCRIBED', 'SUSPENDED'));
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF to_regclass('content_subscribers') IS NULL THEN
          RETURN;
        END IF;

        UPDATE content_subscribers SET status = 'ACTIVE' WHERE status = 'PENDING';

        ALTER TABLE content_subscribers DROP CONSTRAINT IF EXISTS content_subscribers_status_check;
        ALTER TABLE content_subscribers
          ADD CONSTRAINT content_subscribers_status_check
          CHECK (status IN ('ACTIVE', 'UNSUBSCRIBED', 'SUSPENDED'));
      END $$;
    `);
  },
};
