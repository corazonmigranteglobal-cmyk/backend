-- Seed idempotente mínimo para que el frontend público no falle.
-- Úsalo solo si quieres sembrar datos directamente por SQL.
-- Recomendado: usar el seeder JS 20260704130000-front-required-public-data.js con sequelize-cli.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO cms_pages (id, slug, title, status, seo_metadata, published_at, created_at, updated_at)
VALUES
  (uuid_generate_v4(), 'inicio', 'Inicio', 'PUBLISHED', '{"description":"Corazón Migrante: acompañamiento, información y apoyo para personas migrantes."}'::jsonb, now(), now(), now()),
  (uuid_generate_v4(), 'biblioteca', 'Biblioteca', 'PUBLISHED', '{"description":"Biblioteca pública de recursos y guías de Corazón Migrante."}'::jsonb, now(), now(), now())
ON CONFLICT (slug) DO UPDATE
SET title = EXCLUDED.title,
    status = 'PUBLISHED',
    seo_metadata = EXCLUDED.seo_metadata,
    published_at = COALESCE(cms_pages.published_at, now()),
    deleted_at = NULL,
    updated_at = now();

WITH p AS (SELECT id FROM cms_pages WHERE slug = 'inicio' LIMIT 1), existing AS (
  SELECT e.id FROM cms_elements e JOIN p ON p.id = e.page_id WHERE e.code = 'hero' AND e.deleted_at IS NULL LIMIT 1
)
INSERT INTO cms_elements (id, page_id, code, type, content, sort_order, status, created_at, updated_at)
SELECT uuid_generate_v4(), p.id, 'hero', 'HERO', '{"eyebrow":"Acompañamiento para migrantes","title":"Apoyo humano para personas migrantes y sus familias","subtitle":"Conectamos orientación emocional, recursos públicos y servicios de acompañamiento en una experiencia clara, segura y cercana.","primaryCta":{"label":"Explorar biblioteca","href":"/biblioteca"},"secondaryCta":{"label":"Agendar orientación","href":"/booking"}}'::jsonb, 10, 'ACTIVE', now(), now()
FROM p
WHERE NOT EXISTS (SELECT 1 FROM existing);

WITH p AS (SELECT id FROM cms_pages WHERE slug = 'biblioteca' LIMIT 1), existing AS (
  SELECT e.id FROM cms_elements e JOIN p ON p.id = e.page_id WHERE e.code = 'hero' AND e.deleted_at IS NULL LIMIT 1
)
INSERT INTO cms_elements (id, page_id, code, type, content, sort_order, status, created_at, updated_at)
SELECT uuid_generate_v4(), p.id, 'hero', 'HERO', '{"eyebrow":"Biblioteca","title":"Recursos útiles para personas migrantes y sus familias","subtitle":"Lecturas breves, guías y materiales de orientación para acompañar procesos migratorios con claridad y calma.","ctaLabel":"Explorar recursos","ctaHref":"#recursos"}'::jsonb, 0, 'ACTIVE', now(), now()
FROM p
WHERE NOT EXISTS (SELECT 1 FROM existing);

WITH p AS (SELECT id FROM cms_pages WHERE slug = 'biblioteca' LIMIT 1), existing AS (
  SELECT e.id FROM cms_elements e JOIN p ON p.id = e.page_id WHERE e.code = 'guia-primeros-pasos' AND e.deleted_at IS NULL LIMIT 1
)
INSERT INTO cms_elements (id, page_id, code, type, content, sort_order, status, created_at, updated_at)
SELECT uuid_generate_v4(), p.id, 'guia-primeros-pasos', 'RESOURCE', '{"slug":"guia-primeros-pasos","title":"Guía de primeros pasos para organizar tu proceso migratorio","summary":"Una guía inicial para ordenar información, documentos y prioridades personales.","category":"Orientación migrante","readTimeLabel":"4 min","authorLabel":"Equipo Corazón Migrante","bodyBlocks":["Empieza por reunir tus documentos personales, contactos de emergencia y cualquier información oficial relacionada con tu situación migratoria.","Evita tomar decisiones importantes con información incompleta. Consulta fuentes confiables y registra cada trámite pendiente.","Pide apoyo cuando el proceso se vuelva emocionalmente pesado. Organizarse también implica cuidar tu bienestar."]}'::jsonb, 10, 'ACTIVE', now(), now()
FROM p
WHERE NOT EXISTS (SELECT 1 FROM existing);
