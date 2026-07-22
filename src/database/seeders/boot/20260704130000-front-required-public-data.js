'use strict';

const { randomUUID } = require('crypto');
const bcrypt = require('bcryptjs');

const PASSWORD = 'Demo123456!';
const jsonb = (value) => JSON.stringify(value ?? {});

async function query(qi, sql, replacements = {}) {
  return qi.sequelize.query(sql, { replacements });
}

async function scalar(qi, sql, replacements = {}) {
  const [rows] = await query(qi, sql, replacements);
  return rows?.[0] ?? null;
}

async function tableExists(qi, tableName) {
  const row = await scalar(qi, `SELECT to_regclass(:tableName) AS table_name`, { tableName: `public.${tableName}` });
  return Boolean(row?.table_name);
}

async function assertRequiredTables(qi) {
  const required = [
    'users',
    'roles',
    'permissions',
    'user_roles',
    'role_permissions',
    'admin_profiles',
    'patient_profiles',
    'therapist_profiles',
    'therapy_approaches',
    'therapy_products',
    'therapist_approaches',
    'therapist_products',
    'therapist_schedules',
    'cms_pages',
    'cms_elements',
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
    'homepage_sections',
    'homepage_featured_items',
    'account_groups',
    'accounts',
    'cost_centers',
  ];
  const missing = [];
  for (const table of required) {
    if (!(await tableExists(qi, table))) missing.push(table);
  }
  if (missing.length) {
    throw new Error(`Faltan tablas requeridas para seed frontend: ${missing.join(', ')}. Ejecuta migraciones o habilita DATABASE_BOOTSTRAP_ON_STARTUP=true antes de correr seeds.`);
  }
}

async function ensurePermission(qi, code, description, now) {
  await query(
    qi,
    `INSERT INTO permissions (id, code, description, created_at, updated_at)
     VALUES (:id, :code, :description, :now, :now)
     ON CONFLICT (code) DO UPDATE
       SET description = EXCLUDED.description,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), code, description, now },
  );
  return scalar(qi, 'SELECT id FROM permissions WHERE code = :code LIMIT 1', { code });
}

async function ensureRole(qi, code, name, description, now) {
  await query(
    qi,
    `INSERT INTO roles (id, code, name, description, created_at, updated_at)
     VALUES (:id, :code, :name, :description, :now, :now)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), code, name, description, now },
  );
  return scalar(qi, 'SELECT id FROM roles WHERE code = :code LIMIT 1', { code });
}

async function grantPermissions(qi, roleCode, permissionCodes) {
  const role = await scalar(qi, 'SELECT id FROM roles WHERE code = :roleCode LIMIT 1', { roleCode });
  if (!role?.id) return;

  for (const permissionCode of permissionCodes) {
    const permission = await scalar(qi, 'SELECT id FROM permissions WHERE code = :permissionCode LIMIT 1', { permissionCode });
    if (!permission?.id) continue;
    await query(
      qi,
      `INSERT INTO role_permissions (role_id, permission_id)
       VALUES (:roleId, :permissionId)
       ON CONFLICT DO NOTHING`,
      { roleId: role.id, permissionId: permission.id },
    );
  }
}

async function ensureUser(qi, input, passwordHash, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM users WHERE lower(email) = lower(:email) AND deleted_at IS NULL LIMIT 1`,
    { email: input.email },
  );

  if (existing?.id) {
    await query(
      qi,
      `UPDATE users
       SET status = 'ACTIVE',
           email_verified_at = COALESCE(email_verified_at, :now),
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, now },
    );
    return existing;
  }

  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO users (id, email, password_hash, status, email_verified_at, created_at, updated_at)
     VALUES (:id, :email, :passwordHash, 'ACTIVE', :now, :now, :now)`,
    { id, email: input.email, passwordHash, now },
  );
  return { id };
}

async function ensureUserRole(qi, userId, roleCode) {
  const role = await scalar(qi, 'SELECT id FROM roles WHERE code = :roleCode LIMIT 1', { roleCode });
  if (!role?.id) return;
  await query(
    qi,
    `INSERT INTO user_roles (user_id, role_id)
     VALUES (:userId, :roleId)
     ON CONFLICT DO NOTHING`,
    { userId, roleId: role.id },
  );
}

async function ensureAdminProfile(qi, user, now) {
  await query(
    qi,
    `INSERT INTO admin_profiles (user_id, first_name, last_name, level, created_at, updated_at)
     VALUES (:userId, :firstName, :lastName, :level, :now, :now)
     ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           level = EXCLUDED.level,
           updated_at = EXCLUDED.updated_at`,
    { userId: user.id, firstName: user.firstName, lastName: user.lastName, level: user.level, now },
  );
}

async function ensurePatientProfile(qi, user, now) {
  await query(
    qi,
    `INSERT INTO patient_profiles (user_id, first_name, last_name, phone, country, city, occupation, created_at, updated_at)
     VALUES (:userId, :firstName, :lastName, :phone, :country, :city, :occupation, :now, :now)
     ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone = EXCLUDED.phone,
           country = EXCLUDED.country,
           city = EXCLUDED.city,
           occupation = EXCLUDED.occupation,
           updated_at = EXCLUDED.updated_at`,
    {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      city: user.city,
      occupation: user.occupation,
      now,
    },
  );
}

async function ensureTherapistProfile(qi, user, now) {
  await query(
    qi,
    `INSERT INTO therapist_profiles
       (user_id, first_name, last_name, phone, title, main_specialty, bio, personal_phrase, license_number, country, city, base_session_price, approval_status, created_at, updated_at)
     VALUES
       (:userId, :firstName, :lastName, :phone, :title, :mainSpecialty, :bio, :personalPhrase, :licenseNumber, :country, :city, :baseSessionPrice, 'APPROVED', :now, :now)
     ON CONFLICT (user_id) DO UPDATE
       SET first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           phone = EXCLUDED.phone,
           title = EXCLUDED.title,
           main_specialty = EXCLUDED.main_specialty,
           bio = EXCLUDED.bio,
           personal_phrase = EXCLUDED.personal_phrase,
           license_number = EXCLUDED.license_number,
           country = EXCLUDED.country,
           city = EXCLUDED.city,
           base_session_price = EXCLUDED.base_session_price,
           approval_status = EXCLUDED.approval_status,
           updated_at = EXCLUDED.updated_at`,
    {
      userId: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      title: user.title,
      mainSpecialty: user.mainSpecialty,
      bio: user.bio,
      personalPhrase: user.personalPhrase,
      licenseNumber: user.licenseNumber,
      country: user.country,
      city: user.city,
      baseSessionPrice: user.baseSessionPrice,
      now,
    },
  );
}

async function ensurePublicPage(qi, page, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM cms_pages WHERE slug = :slug AND deleted_at IS NULL LIMIT 1`,
    { slug: page.slug },
  );

  if (existing?.id) {
    await query(
      qi,
      `UPDATE cms_pages
       SET title = :title,
           status = 'PUBLISHED',
           seo_metadata = CAST(:seoMetadata AS jsonb),
           published_at = COALESCE(published_at, :now),
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, title: page.title, seoMetadata: jsonb(page.seoMetadata), now },
    );
    return existing;
  }

  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO cms_pages (id, slug, title, status, seo_metadata, published_at, created_at, updated_at)
     VALUES (:id, :slug, :title, 'PUBLISHED', CAST(:seoMetadata AS jsonb), :now, :now, :now)`,
    { id, slug: page.slug, title: page.title, seoMetadata: jsonb(page.seoMetadata), now },
  );
  return { id };
}

async function ensureCmsElement(qi, pageId, element, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM cms_elements
     WHERE page_id = :pageId
       AND code = :code
       AND deleted_at IS NULL
     LIMIT 1`,
    { pageId, code: element.code },
  );

  if (existing?.id) {
    await query(
      qi,
      `UPDATE cms_elements
       SET type = :type,
           content = CAST(:content AS jsonb),
           sort_order = :sortOrder,
           status = 'ACTIVE',
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, type: element.type, content: jsonb(element.content), sortOrder: element.sortOrder, now },
    );
    return existing;
  }

  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO cms_elements (id, page_id, code, type, content, sort_order, status, created_at, updated_at)
     VALUES (:id, :pageId, :code, :type, CAST(:content AS jsonb), :sortOrder, 'ACTIVE', :now, :now)`,
    { id, pageId, code: element.code, type: element.type, content: jsonb(element.content), sortOrder: element.sortOrder, now },
  );
  return { id };
}

async function ensureCmsPages(qi, now) {
  const pages = [
    {
      slug: 'inicio',
      title: 'Inicio',
      seoMetadata: { description: 'Corazón Migrante: acompañamiento, información y apoyo para personas migrantes.' },
      elements: [
        {
          code: 'navbar',
          type: 'NAVBAR',
          sortOrder: 0,
          content: {
            brand: 'Corazón Migrante',
            tagline: 'Acompañamiento humano y orientación confiable',
            links: [
              { label: 'Inicio', href: '/' },
              { label: 'Biblioteca', href: '/biblioteca' },
              { label: 'Agendar', href: '/booking' },
            ],
            cta: { label: 'Ingresar', href: '/login' },
          },
        },
        {
          code: 'hero',
          type: 'HERO',
          sortOrder: 10,
          content: {
            eyebrow: 'Acompañamiento para migrantes',
            badge: 'Corazón Migrante',
            title: 'Apoyo humano para personas migrantes y sus familias',
            subtitle:
              'Conectamos orientación emocional, recursos públicos y servicios de acompañamiento en una experiencia clara, segura y cercana.',
            description: [
              'Información confiable para tomar mejores decisiones.',
              'Acompañamiento profesional sin juicios.',
              'Recursos públicos disponibles en todo momento.',
            ],
            primaryCta: { label: 'Explorar biblioteca', href: '/biblioteca' },
            secondaryCta: { label: 'Agendar orientación', href: '/booking' },
          },
        },
        {
          code: 'servicios',
          type: 'SECTION',
          sortOrder: 20,
          content: {
            badge: 'Servicios',
            title: 'Orientación, cuidado emocional y recursos útiles',
            body:
              'La plataforma reúne contenido público y canales de atención para acompañar procesos migratorios con orden y humanidad.',
            layout: 'cards',
            items: [
              { title: 'Biblioteca pública', body: 'Guías y lecturas para personas migrantes y sus familias.' },
              { title: 'Orientación emocional', body: 'Espacios de apoyo con enfoque humano, respetuoso y profesional.' },
              { title: 'Gestión clara', body: 'Procesos digitales para mejorar la atención y el seguimiento.' },
            ],
          },
        },
        {
          code: 'proceso',
          type: 'SECTION',
          sortOrder: 30,
          content: {
            badge: 'Cómo funciona',
            title: 'Una experiencia simple desde el primer contacto',
            paragraphs: [
              'Consulta recursos públicos y entiende las opciones disponibles.',
              'Agenda una atención cuando necesites acompañamiento personalizado.',
              'Recibe seguimiento desde un entorno digital seguro y ordenado.',
            ],
            layout: 'split',
          },
        },
        {
          code: 'confianza',
          type: 'SECTION',
          sortOrder: 40,
          content: {
            badge: 'Confianza',
            title: 'Diseñado para transmitir cercanía y responsabilidad',
            body:
              'Corazón Migrante prioriza claridad, trato digno y acceso a información útil para quienes atraviesan cambios importantes.',
            primaryCta: { label: 'Ver recursos', href: '/biblioteca' },
          },
        },
        {
          code: 'footer',
          type: 'FOOTER',
          sortOrder: 100,
          content: {
            note: 'Corazón Migrante acompaña con información clara, recursos públicos y atención humana.',
            phone: '+591 70000000',
            columns: [
              {
                title: 'Plataforma',
                links: [
                  { label: 'Biblioteca', href: '/biblioteca' },
                  { label: 'Agendar', href: '/booking' },
                ],
              },
              {
                title: 'Legal',
                links: [
                  { label: 'Privacidad', href: '/privacidad' },
                  { label: 'Términos', href: '/terminos' },
                ],
              },
            ],
          },
        },
      ],
    },
    {
      slug: 'biblioteca',
      title: 'Biblioteca',
      seoMetadata: { description: 'Biblioteca pública de recursos y guías de Corazón Migrante.' },
      elements: [
        {
          code: 'hero',
          type: 'HERO',
          sortOrder: 0,
          content: {
            eyebrow: 'Biblioteca',
            title: 'Recursos útiles para personas migrantes y sus familias',
            subtitle:
              'Lecturas breves, guías y materiales de orientación para acompañar procesos migratorios con claridad y calma.',
            ctaLabel: 'Explorar recursos',
            ctaHref: '#recursos',
          },
        },
        {
          code: 'guia-primeros-pasos',
          type: 'RESOURCE',
          sortOrder: 10,
          content: {
            slug: 'guia-primeros-pasos',
            title: 'Guía de primeros pasos para organizar tu proceso migratorio',
            summary: 'Una guía inicial para ordenar información, documentos y prioridades personales.',
            category: 'Orientación migrante',
            readTimeLabel: '4 min',
            authorLabel: 'Equipo Corazón Migrante',
            publishedAt: '2026-07-04',
            bodyBlocks: [
              'Empieza por reunir tus documentos personales, contactos de emergencia y cualquier información oficial relacionada con tu situación migratoria.',
              'Evita tomar decisiones importantes con información incompleta. Consulta fuentes confiables y registra cada trámite pendiente.',
              'Pide apoyo cuando el proceso se vuelva emocionalmente pesado. Organizarse también implica cuidar tu bienestar.',
            ],
          },
        },
        {
          code: 'acompanamiento-emocional',
          type: 'RESOURCE',
          sortOrder: 20,
          content: {
            slug: 'acompanamiento-emocional',
            title: 'Cómo cuidar tu salud emocional durante una etapa de cambio',
            summary: 'Recomendaciones simples para reconocer estrés, pedir apoyo y mantener rutinas sanas.',
            category: 'Bienestar emocional',
            readTimeLabel: '5 min',
            authorLabel: 'Equipo Corazón Migrante',
            publishedAt: '2026-07-04',
            bodyBlocks: [
              'Los cambios migratorios pueden traer cansancio, incertidumbre y sensación de desorden. No tienes que resolver todo en un solo día.',
              'Mantén hábitos básicos: descanso, alimentación, contacto con personas de confianza y pausas para respirar.',
              'Busca acompañamiento profesional si el malestar interfiere con tu vida diaria o tus relaciones importantes.',
            ],
          },
        },
        {
          code: 'redes-de-apoyo',
          type: 'RESOURCE',
          sortOrder: 30,
          content: {
            slug: 'redes-de-apoyo',
            title: 'Redes de apoyo: por qué no conviene atravesar el proceso en soledad',
            summary: 'Ideas prácticas para identificar personas, instituciones y recursos que puedan ayudarte.',
            category: 'Comunidad',
            readTimeLabel: '3 min',
            authorLabel: 'Equipo Corazón Migrante',
            publishedAt: '2026-07-04',
            bodyBlocks: [
              'Una red de apoyo puede incluir familiares, amistades, profesionales, comunidades e instituciones confiables.',
              'Anota quién puede ayudarte con información, quién puede escucharte y quién puede acompañarte en trámites importantes.',
              'Pedir ayuda a tiempo reduce riesgos y permite tomar decisiones con más calma.',
            ],
          },
        },
        {
          code: 'footer',
          type: 'FOOTER',
          sortOrder: 100,
          content: {
            note: 'La biblioteca se actualiza con materiales públicos de orientación y bienestar.',
            columns: [
              {
                title: 'Recursos',
                links: [
                  { label: 'Inicio', href: '/' },
                  { label: 'Agendar', href: '/booking' },
                ],
              },
            ],
          },
        },
      ],
    },
  ];

  for (const page of pages) {
    const pageRow = await ensurePublicPage(qi, page, now);
    for (const element of page.elements) {
      await ensureCmsElement(qi, pageRow.id, element, now);
    }
  }
}

async function ensureCategory(qi, input, now) {
  await query(
    qi,
    `INSERT INTO content_categories (id, slug, name, description, is_active, sort_order, created_at, updated_at)
     VALUES (:id, :slug, :name, :description, true, :sortOrder, :now, :now)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = true,
           sort_order = EXCLUDED.sort_order,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), ...input, now },
  );
  return scalar(qi, 'SELECT id FROM content_categories WHERE slug = :slug LIMIT 1', { slug: input.slug });
}

async function ensureTag(qi, input, now) {
  await query(
    qi,
    `INSERT INTO content_tags (id, slug, name, created_at, updated_at)
     VALUES (:id, :slug, :name, :now, :now)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), ...input, now },
  );
  return scalar(qi, 'SELECT id FROM content_tags WHERE slug = :slug LIMIT 1', { slug: input.slug });
}

async function ensureAuthor(qi, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM content_authors WHERE display_name = 'Equipo Corazón Migrante' AND deleted_at IS NULL LIMIT 1`,
  );
  if (existing?.id) {
    await query(
      qi,
      `UPDATE content_authors
       SET headline = 'Redacción institucional',
           bio = 'Equipo editorial de Corazón Migrante.',
           status = 'ACTIVE',
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, now },
    );
    return existing;
  }
  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO content_authors (id, display_name, headline, bio, status, metadata, created_at, updated_at)
     VALUES (:id, 'Equipo Corazón Migrante', 'Redacción institucional', 'Equipo editorial de Corazón Migrante.', 'ACTIVE', '{}'::jsonb, :now, :now)`,
    { id, now },
  );
  return { id };
}

async function ensurePublication(qi, input, now) {
  await query(
    qi,
    `INSERT INTO content_publications
       (id, author_id, category_id, slug, title, summary, body, publication_type, access_type, status, published_at, seo_metadata, created_at, updated_at)
     VALUES
       (:id, :authorId, :categoryId, :slug, :title, :summary, :body, :publicationType, 'PUBLIC', 'PUBLISHED', :publishedAt, CAST(:seoMetadata AS jsonb), :now, :now)
     ON CONFLICT (slug) DO UPDATE
       SET author_id = EXCLUDED.author_id,
           category_id = EXCLUDED.category_id,
           title = EXCLUDED.title,
           summary = EXCLUDED.summary,
           body = EXCLUDED.body,
           publication_type = EXCLUDED.publication_type,
           access_type = 'PUBLIC',
           status = 'PUBLISHED',
           published_at = EXCLUDED.published_at,
           seo_metadata = EXCLUDED.seo_metadata,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), ...input, seoMetadata: jsonb(input.seoMetadata), now },
  );
  return scalar(qi, 'SELECT id FROM content_publications WHERE slug = :slug LIMIT 1', { slug: input.slug });
}

async function ensureContent(qi, now) {
  const author = await ensureAuthor(qi, now);
  const migration = await ensureCategory(
    qi,
    { slug: 'orientacion-migrante', name: 'Orientación migrante', description: 'Guías y recursos prácticos para personas migrantes.', sortOrder: 1 },
    now,
  );
  const wellbeing = await ensureCategory(
    qi,
    { slug: 'bienestar-emocional', name: 'Bienestar emocional', description: 'Contenido de acompañamiento y cuidado emocional.', sortOrder: 2 },
    now,
  );
  const stories = await ensureTag(qi, { slug: 'historias', name: 'Historias' }, now);
  const guides = await ensureTag(qi, { slug: 'guias', name: 'Guías' }, now);

  const publications = [
    {
      categoryId: migration.id,
      slug: 'guia-inicial-para-personas-migrantes',
      title: 'Guía inicial para personas migrantes',
      summary: 'Puntos clave para ordenar documentos, información y decisiones importantes.',
      body: 'Migrar implica decisiones prácticas y emocionales. Esta guía propone organizar documentos, identificar fuentes confiables y pedir apoyo cuando el proceso se vuelve difícil.',
      publicationType: 'NEWS',
      publishedAt: new Date('2026-07-04T10:00:00Z'),
      seoMetadata: { description: 'Guía inicial para personas migrantes.' },
      tagIds: [guides.id],
    },
    {
      categoryId: migration.id,
      slug: 'redes-de-apoyo-para-migrantes',
      title: 'Redes de apoyo para migrantes',
      summary: 'Cómo identificar personas, instituciones y recursos que pueden ayudarte.',
      body: 'Una red de apoyo permite compartir información, cuidar la salud emocional y reducir riesgos durante el proceso migratorio.',
      publicationType: 'NEWS',
      publishedAt: new Date('2026-07-04T09:00:00Z'),
      seoMetadata: { description: 'Redes de apoyo para migrantes.' },
      tagIds: [stories.id],
    },
    {
      categoryId: wellbeing.id,
      slug: 'acompanar-sin-juzgar',
      title: 'Acompañar sin juzgar',
      summary: 'Una columna sobre escucha, dignidad y apoyo emocional durante procesos migratorios.',
      body: 'Acompañar no significa resolverlo todo por la otra persona. Significa escuchar, orientar y sostener con respeto.',
      publicationType: 'COLUMN',
      publishedAt: new Date('2026-07-04T08:00:00Z'),
      seoMetadata: { description: 'Columna sobre acompañamiento humano.' },
      tagIds: [stories.id],
    },
    {
      categoryId: wellbeing.id,
      slug: 'cuidar-la-calma-en-una-etapa-de-cambio',
      title: 'Cuidar la calma en una etapa de cambio',
      summary: 'Ideas simples para sostener rutinas y pedir ayuda a tiempo.',
      body: 'Las rutinas pequeñas ayudan a recuperar sensación de control: dormir, comer, hablar con alguien de confianza y pedir ayuda profesional cuando sea necesario.',
      publicationType: 'COLUMN',
      publishedAt: new Date('2026-07-04T07:00:00Z'),
      seoMetadata: { description: 'Cuidado emocional en etapas de cambio.' },
      tagIds: [guides.id],
    },
  ];

  const created = [];
  for (const pub of publications) {
    const row = await ensurePublication(qi, { ...pub, authorId: author.id }, now);
    created.push({ ...row, publicationType: pub.publicationType });
    for (const tagId of pub.tagIds) {
      await query(
        qi,
        `INSERT INTO content_publication_tags (publication_id, tag_id)
         VALUES (:publicationId, :tagId)
         ON CONFLICT DO NOTHING`,
        { publicationId: row.id, tagId },
      );
    }
  }
  return created;
}

async function ensureCompany(qi, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM ads_companies
     WHERE business_name = 'Corazón Migrante - Aliado Institucional'
       AND deleted_at IS NULL
     LIMIT 1`,
  );
  if (existing?.id) {
    await query(
      qi,
      `UPDATE ads_companies
       SET commercial_name = 'Aliado Institucional',
           contact_email = 'contacto@corazondemigrante.com',
           status = 'ACTIVE',
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, now },
    );
    return existing;
  }
  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO ads_companies (id, business_name, commercial_name, contact_email, status, metadata, created_at, updated_at)
     VALUES (:id, 'Corazón Migrante - Aliado Institucional', 'Aliado Institucional', 'contacto@corazondemigrante.com', 'ACTIVE', '{}'::jsonb, :now, :now)`,
    { id, now },
  );
  return { id };
}

async function ensurePlacement(qi, input, now) {
  await query(
    qi,
    `INSERT INTO ads_placements (id, code, name, description, context, is_active, dimensions, created_at, updated_at)
     VALUES (:id, :code, :name, :description, :context, true, CAST(:dimensions AS jsonb), :now, :now)
     ON CONFLICT (code) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           context = EXCLUDED.context,
           is_active = true,
           dimensions = EXCLUDED.dimensions,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), ...input, dimensions: jsonb(input.dimensions), now },
  );
  return scalar(qi, 'SELECT id FROM ads_placements WHERE code = :code LIMIT 1', { code: input.code });
}

async function ensureCampaign(qi, companyId, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM ads_campaigns
     WHERE company_id = :companyId
       AND name = 'Campaña pública Corazón Migrante'
       AND deleted_at IS NULL
     LIMIT 1`,
    { companyId },
  );
  if (existing?.id) {
    await query(
      qi,
      `UPDATE ads_campaigns
       SET objective = 'PUBLIC_SERVICE',
           status = 'ACTIVE',
           starts_at = :startsAt,
           ends_at = :endsAt,
           budget_amount = 0,
           currency = 'BOB',
           priority = 10,
           pacing = 'STANDARD',
           notes = 'Campaña institucional requerida por el frontend público.',
           updated_at = :now
       WHERE id = :id`,
      {
        id: existing.id,
        startsAt: new Date('2026-07-01T00:00:00Z'),
        endsAt: new Date('2028-07-01T00:00:00Z'),
        now,
      },
    );
    return existing;
  }
  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO ads_campaigns
       (id, company_id, name, objective, status, starts_at, ends_at, budget_amount, currency, priority, pacing, notes, created_at, updated_at)
     VALUES
       (:id, :companyId, 'Campaña pública Corazón Migrante', 'PUBLIC_SERVICE', 'ACTIVE', :startsAt, :endsAt, 0, 'BOB', 10, 'STANDARD', 'Campaña institucional requerida por el frontend público.', :now, :now)`,
    {
      id,
      companyId,
      startsAt: new Date('2026-07-01T00:00:00Z'),
      endsAt: new Date('2028-07-01T00:00:00Z'),
      now,
    },
  );
  return { id };
}

async function ensureCreative(qi, campaignId, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM ads_campaign_creatives
     WHERE campaign_id = :campaignId
       AND title = 'Apoyo institucional Corazón Migrante'
       AND deleted_at IS NULL
     LIMIT 1`,
    { campaignId },
  );
  if (existing?.id) {
    await query(
      qi,
      `UPDATE ads_campaign_creatives
       SET media_type = 'IMAGE',
           asset_url = :assetUrl,
           destination_url = :destinationUrl,
           alt_text = :altText,
           mime_type = 'image/png',
           width = 1200,
           height = 360,
           size_bytes = 0,
           approval_status = 'APPROVED',
           is_primary = true,
           updated_at = :now
       WHERE id = :id`,
      {
        id: existing.id,
        assetUrl: 'https://res.cloudinary.com/demo/image/upload/corazon-migrante/global_assets/media/logo-corazon-migrante.png',
        destinationUrl: 'https://corazondemigrante.com/biblioteca',
        altText: 'Corazón Migrante - Biblioteca pública',
        now,
      },
    );
    return existing;
  }
  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO ads_campaign_creatives
       (id, campaign_id, title, media_type, asset_url, destination_url, alt_text, mime_type, width, height, size_bytes, approval_status, is_primary, created_at, updated_at)
     VALUES
       (:id, :campaignId, 'Apoyo institucional Corazón Migrante', 'IMAGE', :assetUrl, :destinationUrl, :altText, 'image/png', 1200, 360, 0, 'APPROVED', true, :now, :now)`,
    {
      id,
      campaignId,
      assetUrl: 'https://res.cloudinary.com/demo/image/upload/corazon-migrante/global_assets/media/logo-corazon-migrante.png',
      destinationUrl: 'https://corazondemigrante.com/biblioteca',
      altText: 'Corazón Migrante - Biblioteca pública',
      now,
    },
  );
  return { id };
}

async function ensureAdvertising(qi, now) {
  const company = await ensureCompany(qi, now);
  const placements = [];
  for (const input of [
    { code: 'home_hero', name: 'Principal de inicio', description: 'Espacio destacado para la página de inicio.', context: 'HOME', dimensions: { width: 1200, height: 360 } },
    { code: 'library_sidebar', name: 'Biblioteca lateral', description: 'Espacio de apoyo en biblioteca.', context: 'CATEGORY', dimensions: { width: 360, height: 360 } },
    { code: 'article_inline', name: 'Artículo interno', description: 'Espacio dentro de recursos publicados.', context: 'ARTICLE', dimensions: { width: 728, height: 90 } },
  ]) {
    placements.push(await ensurePlacement(qi, input, now));
  }
  const campaign = await ensureCampaign(qi, company.id, now);
  const creative = await ensureCreative(qi, campaign.id, now);

  for (const placement of placements) {
    await query(
      qi,
      `INSERT INTO ads_campaign_placements (campaign_id, placement_id)
       VALUES (:campaignId, :placementId)
       ON CONFLICT DO NOTHING`,
      { campaignId: campaign.id, placementId: placement.id },
    );
  }

  return { campaign, creative };
}

async function ensureHomepageSection(qi, input, now) {
  await query(
    qi,
    `INSERT INTO homepage_sections (id, code, title, type, sort_order, is_active, metadata, created_at, updated_at)
     VALUES (:id, :code, :title, :type, :sortOrder, true, CAST(:metadata AS jsonb), :now, :now)
     ON CONFLICT (code) DO UPDATE
       SET title = EXCLUDED.title,
           type = EXCLUDED.type,
           sort_order = EXCLUDED.sort_order,
           is_active = true,
           metadata = EXCLUDED.metadata,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), ...input, metadata: jsonb(input.metadata), now },
  );
  return scalar(qi, 'SELECT id FROM homepage_sections WHERE code = :code LIMIT 1', { code: input.code });
}

async function ensureHomepageItem(qi, sectionId, input, now) {
  const existing = await scalar(
    qi,
    `SELECT id FROM homepage_featured_items
     WHERE section_id = :sectionId
       AND item_type = :itemType
       AND item_id = :itemId
       AND deleted_at IS NULL
     LIMIT 1`,
    { sectionId, itemType: input.itemType, itemId: input.itemId },
  );
  if (existing?.id) {
    await query(
      qi,
      `UPDATE homepage_featured_items
       SET sort_order = :sortOrder,
           status = 'ACTIVE',
           metadata = CAST(:metadata AS jsonb),
           updated_at = :now
       WHERE id = :id`,
      { id: existing.id, sortOrder: input.sortOrder, metadata: jsonb(input.metadata), now },
    );
    return existing;
  }
  const id = randomUUID();
  await query(
    qi,
    `INSERT INTO homepage_featured_items (id, section_id, item_type, item_id, sort_order, status, metadata, created_at, updated_at)
     VALUES (:id, :sectionId, :itemType, :itemId, :sortOrder, 'ACTIVE', CAST(:metadata AS jsonb), :now, :now)`,
    { id, sectionId, itemType: input.itemType, itemId: input.itemId, sortOrder: input.sortOrder, metadata: jsonb(input.metadata), now },
  );
  return { id };
}

async function ensureHomepage(qi, publications, advertising, now) {
  const headlines = await ensureHomepageSection(
    qi,
    { code: 'headlines', title: 'Titulares', type: 'HEADLINES', sortOrder: 1, metadata: { source: 'content_publications' } },
    now,
  );
  const columns = await ensureHomepageSection(
    qi,
    { code: 'columns', title: 'Columnas', type: 'COLUMNS', sortOrder: 2, metadata: { source: 'content_publications' } },
    now,
  );
  const ads = await ensureHomepageSection(
    qi,
    { code: 'home_ads', title: 'Aliados', type: 'ADS', sortOrder: 3, metadata: { placement: 'home_hero' } },
    now,
  );

  let sort = 1;
  for (const publication of publications.filter((item) => item.publicationType === 'NEWS').slice(0, 3)) {
    await ensureHomepageItem(qi, headlines.id, { itemType: 'CONTENT_PUBLICATION', itemId: publication.id, sortOrder: sort++, metadata: {} }, now);
  }

  sort = 1;
  for (const publication of publications.filter((item) => item.publicationType === 'COLUMN').slice(0, 3)) {
    await ensureHomepageItem(qi, columns.id, { itemType: 'CONTENT_PUBLICATION', itemId: publication.id, sortOrder: sort++, metadata: {} }, now);
  }

  await ensureHomepageItem(qi, ads.id, { itemType: 'ADS_CREATIVE', itemId: advertising.creative.id, sortOrder: 1, metadata: { placement: 'home_hero' } }, now);
}

async function ensureTherapyCatalog(qi, now) {
  await query(
    qi,
    `INSERT INTO therapy_approaches (id, name, slug, description, status, sort_order, created_at, updated_at)
     VALUES (:id, 'Acompañamiento migrante', 'acompanamiento-migrante', 'Apoyo emocional para personas migrantes y sus familias.', 'ACTIVE', 1, :now, :now)
     ON CONFLICT (slug) DO UPDATE
       SET name = EXCLUDED.name,
           description = EXCLUDED.description,
           status = 'ACTIVE',
           sort_order = EXCLUDED.sort_order,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), now },
  );
  const approach = await scalar(qi, `SELECT id FROM therapy_approaches WHERE slug = 'acompanamiento-migrante' LIMIT 1`);

  await query(
    qi,
    `INSERT INTO therapy_products (id, approach_id, name, slug, description, duration_minutes, price, currency, status, sort_order, created_at, updated_at)
     VALUES (:id, :approachId, 'Sesión individual online', 'sesion-individual-online', 'Sesión terapéutica individual de 60 minutos.', 60, 180, 'BOB', 'ACTIVE', 1, :now, :now)
     ON CONFLICT (slug) DO UPDATE
       SET approach_id = EXCLUDED.approach_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           duration_minutes = EXCLUDED.duration_minutes,
           price = EXCLUDED.price,
           currency = EXCLUDED.currency,
           status = 'ACTIVE',
           sort_order = EXCLUDED.sort_order,
           deleted_at = NULL,
           updated_at = EXCLUDED.updated_at`,
    { id: randomUUID(), approachId: approach.id, now },
  );
  const product = await scalar(qi, `SELECT id FROM therapy_products WHERE slug = 'sesion-individual-online' LIMIT 1`);

  return { approach, product };
}

async function ensureTherapistSchedule(qi, therapistId, now) {
  for (const weekday of [1, 2, 3, 4, 5]) {
    const existing = await scalar(
      qi,
      `SELECT id FROM therapist_schedules
       WHERE therapist_user_id = :therapistId
         AND weekday = :weekday
         AND start_time = '09:00'
         AND end_time = '13:00'
         AND effective_from = '2026-07-01'
         AND deleted_at IS NULL
       LIMIT 1`,
      { therapistId, weekday },
    );
    if (existing?.id) {
      await query(qi, `UPDATE therapist_schedules SET status = 'ACTIVE', updated_at = :now WHERE id = :id`, { id: existing.id, now });
      continue;
    }
    await query(
      qi,
      `INSERT INTO therapist_schedules
         (id, therapist_user_id, weekday, start_time, end_time, timezone, effective_from, status, version, created_at, updated_at)
       VALUES
         (:id, :therapistId, :weekday, '09:00', '13:00', 'America/La_Paz', '2026-07-01', 'ACTIVE', 1, :now, :now)`,
      { id: randomUUID(), therapistId, weekday, now },
    );
  }
}

async function ensureUsersAndSecurity(qi, now) {
  const permissions = [
    ['users:read', 'Ver usuarios'],
    ['therapy:read', 'Ver catálogo terapéutico'],
    ['therapy:write', 'Gestionar catálogo terapéutico'],
    ['appointments:read', 'Ver citas'],
    ['audit:read', 'Ver auditoría'],
    ['messaging:read', 'Ver mensajería'],
    ['messaging:write', 'Gestionar mensajería'],
    ['accounting:read', 'Ver contabilidad'],
    ['accounting:write', 'Gestionar contabilidad'],
    ['analytics:read', 'Ver analítica'],
    ['cms:write', 'Gestionar páginas públicas'],
    ['content:read', 'Ver contenido editorial'],
    ['content:write', 'Gestionar contenido editorial'],
    ['advertising:read', 'Ver publicidad'],
    ['advertising:write', 'Gestionar publicidad'],
    ['homepage:read', 'Ver portada'],
    ['homepage:write', 'Gestionar portada'],
  ];
  for (const [code, description] of permissions) await ensurePermission(qi, code, description, now);

  await ensureRole(qi, 'SUPER_ADMIN', 'Super administrador', 'Acceso completo al sistema.', now);
  await ensureRole(qi, 'ADMIN', 'Administrador', 'Administración general.', now);
  await ensureRole(qi, 'EDITOR', 'Editor de contenido', 'Gestión editorial y páginas públicas.', now);
  await ensureRole(qi, 'ADVERTISING_MANAGER', 'Gestor de publicidad', 'Gestión de campañas publicitarias.', now);
  await ensureRole(qi, 'PATIENT', 'Paciente', 'Usuario paciente.', now);
  await ensureRole(qi, 'THERAPIST', 'Terapeuta', 'Usuario terapeuta.', now);

  await grantPermissions(qi, 'SUPER_ADMIN', permissions.map(([code]) => code));
  await grantPermissions(qi, 'ADMIN', permissions.map(([code]) => code));
  await grantPermissions(qi, 'EDITOR', ['content:read', 'content:write', 'homepage:read', 'cms:write']);
  await grantPermissions(qi, 'ADVERTISING_MANAGER', ['advertising:read', 'advertising:write', 'homepage:read']);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await ensureUser(qi, { email: 'admin@corazonmigrante.test' }, passwordHash, now);
  await ensureUserRole(qi, admin.id, 'SUPER_ADMIN');
  await ensureUserRole(qi, admin.id, 'ADMIN');
  await ensureAdminProfile(qi, { id: admin.id, firstName: 'Admin', lastName: 'Corazón Migrante', level: 'SUPER_ADMIN' }, now);

  const patient = await ensureUser(qi, { email: 'paciente@corazonmigrante.test' }, passwordHash, now);
  await ensureUserRole(qi, patient.id, 'PATIENT');
  await ensurePatientProfile(qi, { id: patient.id, firstName: 'Paciente', lastName: 'Demo', phone: '+59170000001', country: 'Bolivia', city: 'Santa Cruz de la Sierra', occupation: 'Estudiante' }, now);

  const therapist = await ensureUser(qi, { email: 'terapeuta@corazonmigrante.test' }, passwordHash, now);
  await ensureUserRole(qi, therapist.id, 'THERAPIST');
  await ensureTherapistProfile(
    qi,
    {
      id: therapist.id,
      firstName: 'Terapeuta',
      lastName: 'Demo',
      phone: '+59170000002',
      title: 'Psicóloga',
      mainSpecialty: 'Acompañamiento migrante',
      bio: 'Terapeuta demo para validar agenda, disponibilidad y citas.',
      personalPhrase: 'Acompañar también es ordenar el camino con calma.',
      licenseNumber: 'MAT-DEMO-001',
      country: 'Bolivia',
      city: 'Santa Cruz de la Sierra',
      baseSessionPrice: 180,
    },
    now,
  );

  return { admin, patient, therapist };
}

async function ensureTherapyLinks(qi, therapist, catalog, now) {
  await query(
    qi,
    `INSERT INTO therapist_approaches (therapist_user_id, approach_id)
     VALUES (:therapistId, :approachId)
     ON CONFLICT DO NOTHING`,
    { therapistId: therapist.id, approachId: catalog.approach.id },
  );
  await query(
    qi,
    `INSERT INTO therapist_products (therapist_user_id, product_id, custom_price, is_active, created_at, updated_at)
     VALUES (:therapistId, :productId, 180, true, :now, :now)
     ON CONFLICT (therapist_user_id, product_id) DO UPDATE
       SET custom_price = EXCLUDED.custom_price,
           is_active = true,
           updated_at = EXCLUDED.updated_at`,
    { therapistId: therapist.id, productId: catalog.product.id, now },
  );
  await ensureTherapistSchedule(qi, therapist.id, now);
}

async function ensureAccountingMinimum(qi, now) {
  const groups = [
    { code: 'ACTIVO', name: 'Activo', type: 'ASSET' },
    { code: 'INGRESOS', name: 'Ingresos', type: 'INCOME' },
    { code: 'GASTOS', name: 'Gastos', type: 'EXPENSE' },
  ];
  for (const group of groups) {
    await query(
      qi,
      `INSERT INTO account_groups (id, code, name, type, status, created_at, updated_at)
       VALUES (:id, :code, :name, :type, 'ACTIVE', :now, :now)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             type = EXCLUDED.type,
             status = 'ACTIVE',
             deleted_at = NULL,
             updated_at = EXCLUDED.updated_at`,
      { id: randomUUID(), ...group, now },
    );
  }

  const activo = await scalar(qi, `SELECT id FROM account_groups WHERE code = 'ACTIVO' LIMIT 1`);
  const ingresos = await scalar(qi, `SELECT id FROM account_groups WHERE code = 'INGRESOS' LIMIT 1`);
  const gastos = await scalar(qi, `SELECT id FROM account_groups WHERE code = 'GASTOS' LIMIT 1`);

  const accounts = [
    { groupId: activo.id, code: 'CAJA', name: 'Caja', normalBalance: 'DEBIT' },
    { groupId: activo.id, code: 'BANCO', name: 'Banco', normalBalance: 'DEBIT' },
    { groupId: ingresos.id, code: 'SERVICIOS', name: 'Ingresos por servicios', normalBalance: 'CREDIT' },
    { groupId: gastos.id, code: 'GASTOS_OPERATIVOS', name: 'Gastos operativos', normalBalance: 'DEBIT' },
  ];

  for (const account of accounts) {
    await query(
      qi,
      `INSERT INTO accounts (id, group_id, code, name, normal_balance, status, created_at, updated_at)
       VALUES (:id, :groupId, :code, :name, :normalBalance, 'ACTIVE', :now, :now)
       ON CONFLICT (code) DO UPDATE
         SET group_id = EXCLUDED.group_id,
             name = EXCLUDED.name,
             normal_balance = EXCLUDED.normal_balance,
             status = 'ACTIVE',
             deleted_at = NULL,
             updated_at = EXCLUDED.updated_at`,
      { id: randomUUID(), ...account, now },
    );
  }

  const existing = await scalar(qi, `SELECT id FROM cost_centers WHERE code = 'GENERAL' AND deleted_at IS NULL LIMIT 1`);
  if (existing?.id) {
    await query(qi, `UPDATE cost_centers SET name = 'General', status = 'ACTIVE', updated_at = :now WHERE id = :id`, { id: existing.id, now });
    return;
  }
  await query(
    qi,
    `INSERT INTO cost_centers (id, code, name, status, created_at, updated_at)
     VALUES (:id, 'GENERAL', 'General', 'ACTIVE', :now, :now)`,
    { id: randomUUID(), now },
  );
}

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await assertRequiredTables(queryInterface);

    const users = await ensureUsersAndSecurity(queryInterface, now);
    const therapyCatalog = await ensureTherapyCatalog(queryInterface, now);
    await ensureTherapyLinks(queryInterface, users.therapist, therapyCatalog, now);
    await ensureCmsPages(queryInterface, now);
    const publications = await ensureContent(queryInterface, now);
    const advertising = await ensureAdvertising(queryInterface, now);
    await ensureHomepage(queryInterface, publications, advertising, now);
    await ensureAccountingMinimum(queryInterface, now);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DELETE FROM homepage_featured_items WHERE section_id IN (SELECT id FROM homepage_sections WHERE code IN ('headlines','columns','home_ads'));
      DELETE FROM homepage_sections WHERE code IN ('headlines','columns','home_ads');

      DELETE FROM ads_campaign_placements WHERE campaign_id IN (SELECT id FROM ads_campaigns WHERE name = 'Campaña pública Corazón Migrante');
      DELETE FROM ads_campaign_creatives WHERE campaign_id IN (SELECT id FROM ads_campaigns WHERE name = 'Campaña pública Corazón Migrante') AND title = 'Apoyo institucional Corazón Migrante';
      DELETE FROM ads_campaigns WHERE name = 'Campaña pública Corazón Migrante';
      DELETE FROM ads_placements WHERE code IN ('home_hero','library_sidebar','article_inline');
      DELETE FROM ads_companies WHERE business_name = 'Corazón Migrante - Aliado Institucional';

      DELETE FROM content_publication_tags WHERE publication_id IN (SELECT id FROM content_publications WHERE slug IN ('guia-inicial-para-personas-migrantes','redes-de-apoyo-para-migrantes','acompanar-sin-juzgar','cuidar-la-calma-en-una-etapa-de-cambio'));
      DELETE FROM content_publications WHERE slug IN ('guia-inicial-para-personas-migrantes','redes-de-apoyo-para-migrantes','acompanar-sin-juzgar','cuidar-la-calma-en-una-etapa-de-cambio');
      DELETE FROM content_tags WHERE slug IN ('historias','guias');
      DELETE FROM content_categories WHERE slug IN ('orientacion-migrante','bienestar-emocional');
      DELETE FROM content_authors WHERE display_name = 'Equipo Corazón Migrante';

      DELETE FROM cms_elements WHERE page_id IN (SELECT id FROM cms_pages WHERE slug IN ('inicio','biblioteca')) AND code IN ('navbar','hero','servicios','proceso','confianza','footer','guia-primeros-pasos','acompanamiento-emocional','redes-de-apoyo');
      DELETE FROM cms_pages WHERE slug IN ('inicio','biblioteca');
    `);
  },
};
