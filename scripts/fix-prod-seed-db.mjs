import pg from 'pg';

const { Client } = pg;

function boolEnv(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: boolEnv(process.env.DATABASE_SSL) ? { rejectUnauthorized: false } : false,
});

const sql = String.raw`
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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

COMMIT;
`;

try {
  console.log('DB_FIX_START', {
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    ssl: process.env.DATABASE_SSL,
  });
  await client.connect();
  await client.query(sql);

  const { rows } = await client.query(`
    SELECT table_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'id'
      AND table_name IN ('content_publication_tags','ads_campaign_placements')
    ORDER BY table_name;
  `);

  console.table(rows);
  console.log('DB_FIX_OK');
} catch (error) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('DB_FIX_ERROR', error.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
