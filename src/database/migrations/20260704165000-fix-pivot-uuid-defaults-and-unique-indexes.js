'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

    await queryInterface.sequelize.query(`
ALTER TABLE IF EXISTS content_publication_tags
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE IF EXISTS ads_campaign_placements
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT table_schema, table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND udt_name = 'uuid'
      AND column_default IS NULL
      AND table_name IN (
        'content_authors',
        'content_categories',
        'content_tags',
        'content_publications',
        'content_publication_tags',
        'ads_companies',
        'ads_placements',
        'ads_campaigns',
        'ads_campaign_creatives',
        'ads_campaign_placements',
        'ads_campaign_content_targets',
        'ads_impressions',
        'homepage_sections',
        'homepage_featured_items',
        'cms_pages',
        'cms_elements'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN id SET DEFAULT uuid_generate_v4()',
      r.table_schema,
      r.table_name
    );
  END LOOP;
END $$;

DELETE FROM content_publication_tags a
USING content_publication_tags b
WHERE a.ctid < b.ctid
  AND a.publication_id = b.publication_id
  AND a.tag_id = b.tag_id;

DELETE FROM ads_campaign_placements a
USING ads_campaign_placements b
WHERE a.ctid < b.ctid
  AND a.campaign_id = b.campaign_id
  AND a.placement_id = b.placement_id;

CREATE UNIQUE INDEX IF NOT EXISTS content_publication_tags_publication_tag_uq
  ON content_publication_tags(publication_id, tag_id);

CREATE UNIQUE INDEX IF NOT EXISTS ads_campaign_placements_campaign_placement_uq
  ON ads_campaign_placements(campaign_id, placement_id);
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS content_publication_tags_publication_tag_uq;
DROP INDEX IF EXISTS ads_campaign_placements_campaign_placement_uq;
`);
  },
};
