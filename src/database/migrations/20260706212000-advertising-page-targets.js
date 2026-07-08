'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE old_constraint record;
      BEGIN
        IF to_regclass('ads_campaign_content_targets') IS NULL THEN
          RETURN;
        END IF;

        ALTER TABLE ads_campaign_content_targets
          ADD COLUMN IF NOT EXISTS page_slug VARCHAR(240) NULL;

        FOR old_constraint IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'ads_campaign_content_targets'::regclass
            AND contype = 'c'
            AND (
              conname = 'ads_campaign_content_targets_target_required_chk'
              OR (
                pg_get_constraintdef(oid) ILIKE '%publication_id IS NOT NULL%'
                AND pg_get_constraintdef(oid) ILIKE '%category_id IS NOT NULL%'
                AND pg_get_constraintdef(oid) NOT ILIKE '%page_slug%'
              )
            )
        LOOP
          EXECUTE format(
            'ALTER TABLE ads_campaign_content_targets DROP CONSTRAINT IF EXISTS %I',
            old_constraint.conname
          );
        END LOOP;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'ads_campaign_content_targets_target_required_chk'
            AND conrelid = 'ads_campaign_content_targets'::regclass
        ) THEN
          ALTER TABLE ads_campaign_content_targets
            ADD CONSTRAINT ads_campaign_content_targets_target_required_chk
            CHECK (
              publication_id IS NOT NULL
              OR category_id IS NOT NULL
              OR NULLIF(page_slug, '') IS NOT NULL
            ) NOT VALID;
        END IF;

        ALTER TABLE ads_campaign_content_targets
          VALIDATE CONSTRAINT ads_campaign_content_targets_target_required_chk;

        CREATE INDEX IF NOT EXISTS ads_content_targets_page_slug_idx
          ON ads_campaign_content_targets(page_slug, targeting_mode)
          WHERE page_slug IS NOT NULL;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      DECLARE current_constraint record;
      BEGIN
        IF to_regclass('ads_campaign_content_targets') IS NULL THEN
          RETURN;
        END IF;

        DROP INDEX IF EXISTS ads_content_targets_page_slug_idx;

        FOR current_constraint IN
          SELECT conname
          FROM pg_constraint
          WHERE conrelid = 'ads_campaign_content_targets'::regclass
            AND contype = 'c'
            AND conname = 'ads_campaign_content_targets_target_required_chk'
        LOOP
          EXECUTE format(
            'ALTER TABLE ads_campaign_content_targets DROP CONSTRAINT IF EXISTS %I',
            current_constraint.conname
          );
        END LOOP;

        ALTER TABLE ads_campaign_content_targets
          DROP COLUMN IF EXISTS page_slug;

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'ads_campaign_content_targets_target_required_chk'
            AND conrelid = 'ads_campaign_content_targets'::regclass
        ) THEN
          ALTER TABLE ads_campaign_content_targets
            ADD CONSTRAINT ads_campaign_content_targets_target_required_chk
            CHECK (publication_id IS NOT NULL OR category_id IS NOT NULL) NOT VALID;
        END IF;

        ALTER TABLE ads_campaign_content_targets
          VALIDATE CONSTRAINT ads_campaign_content_targets_target_required_chk;
      END $$;
    `);
  },
};
