'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
UPDATE content_subscribers cs
SET user_id = u.id,
    display_name = COALESCE(NULLIF(cs.display_name, ''), TRIM(CONCAT(COALESCE(pp.first_name, ''), ' ', COALESCE(pp.last_name, '')))),
    updated_at = now()
FROM users u
JOIN patient_profiles pp ON pp.user_id = u.id AND pp.deleted_at IS NULL
WHERE cs.deleted_at IS NULL
  AND cs.user_id IS NULL
  AND lower(cs.email) = lower(u.email);

CREATE UNIQUE INDEX IF NOT EXISTS content_subscribers_user_uq
  ON content_subscribers(user_id)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS content_subscribers_patient_active_idx
  ON content_subscribers(user_id, subscription_tier, status, premium_until)
  WHERE deleted_at IS NULL AND user_id IS NOT NULL;
`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
DROP INDEX IF EXISTS content_subscribers_patient_active_idx;
DROP INDEX IF EXISTS content_subscribers_user_uq;
`);
  },
};
