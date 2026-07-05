'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS profile_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS patient_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS title VARCHAR(140) DEFAULT 'Terapeuta';
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS main_specialty VARCHAR(180) DEFAULT 'Psicoterapia';
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS approval_status VARCHAR(40) NOT NULL DEFAULT 'PENDING';
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapist_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) DEFAULT '';
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS level VARCHAR(40) NOT NULL DEFAULT 'STANDARD';
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS admin_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;


CREATE TABLE IF NOT EXISTS therapy_approaches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(180) NOT NULL DEFAULT 'General',
  slug VARCHAR(200) NOT NULL DEFAULT uuid_generate_v4()::text,
  description TEXT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  image_file_id UUID NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS therapy_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  approach_id UUID NULL,
  name VARCHAR(180) NOT NULL DEFAULT 'Sesión terapéutica',
  slug VARCHAR(200) NOT NULL DEFAULT uuid_generate_v4()::text,
  description TEXT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'BOB',
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  image_file_id UUID NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS therapist_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_user_id UUID NULL,
  weekday INTEGER NOT NULL DEFAULT 1,
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '10:00',
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS therapist_blocked_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_user_id UUID NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  reason VARCHAR(255) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_user_id UUID NULL,
  therapist_user_id UUID NULL,
  product_id UUID NULL,
  scheduled_start_at TIMESTAMPTZ NULL,
  scheduled_end_at TIMESTAMPTZ NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz',
  status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'BOB',
  notes_for_therapist TEXT NULL,
  admin_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);

ALTER TABLE IF EXISTS therapy_approaches ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS therapy_approaches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapy_approaches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapy_approaches ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BOB';
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS therapy_products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS therapist_user_id UUID NULL;
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS weekday INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS start_time TIME NOT NULL DEFAULT '09:00';
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS end_time TIME NOT NULL DEFAULT '10:00';
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz';
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS effective_from DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS effective_to DATE NULL;
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS therapist_schedules ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS therapist_blocked_times ADD COLUMN IF NOT EXISTS therapist_user_id UUID NULL;
ALTER TABLE IF EXISTS therapist_blocked_times ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS therapist_blocked_times ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS therapist_blocked_times ADD COLUMN IF NOT EXISTS status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE IF EXISTS therapist_blocked_times ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS patient_user_id UUID NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS therapist_user_id UUID NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS product_id UUID NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS timezone VARCHAR(80) NOT NULL DEFAULT 'America/La_Paz';
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'REQUESTED';
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BOB';
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS notes_for_therapist TEXT NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS admin_notes TEXT NULL;
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE IF EXISTS appointments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS content_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(180) NOT NULL,
  display_name VARCHAR(180) NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
  subscription_tier VARCHAR(40) NOT NULL DEFAULT 'FREE',
  premium_until TIMESTAMPTZ NULL,
  source VARCHAR(80) NOT NULL DEFAULT 'PUBLIC_FORM',
  consent_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL,
  CHECK (status IN ('ACTIVE','UNSUBSCRIBED','SUSPENDED')),
  CHECK (subscription_tier IN ('FREE','PREMIUM'))
);
CREATE UNIQUE INDEX IF NOT EXISTS content_subscribers_email_lower_uq ON content_subscribers (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_subscribers_user_idx ON content_subscribers(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS content_subscribers_premium_idx ON content_subscribers(subscription_tier, status, premium_until) WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW v_therapist_unavailable_intervals AS
SELECT
  therapist_user_id,
  start_at,
  end_at,
  'BLOCKED_TIME'::text AS source_type,
  id::text AS source_id
FROM therapist_blocked_times
WHERE deleted_at IS NULL AND status = 'ACTIVE' AND start_at IS NOT NULL AND end_at IS NOT NULL
UNION ALL
SELECT
  therapist_user_id,
  scheduled_start_at AS start_at,
  scheduled_end_at AS end_at,
  'APPOINTMENT'::text AS source_type,
  id::text AS source_id
FROM appointments
WHERE deleted_at IS NULL
  AND status IN ('REQUESTED','CONFIRMED')
  AND scheduled_start_at IS NOT NULL
  AND scheduled_end_at IS NOT NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP VIEW IF EXISTS v_therapist_unavailable_intervals;
DROP TABLE IF EXISTS content_subscribers;
`);
  },
};
