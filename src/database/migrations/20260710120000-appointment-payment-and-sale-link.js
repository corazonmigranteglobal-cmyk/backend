'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF to_regclass('appointments') IS NULL THEN
          RETURN;
        END IF;

        ALTER TABLE appointments
          ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;

        ALTER TABLE appointments
          ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL;

        ALTER TABLE appointments
          ADD COLUMN IF NOT EXISTS sale_transaction_id UUID NULL;

        IF to_regclass('accounting_transactions') IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM pg_constraint
             WHERE conname = 'appointments_sale_transaction_id_fkey'
           ) THEN
          ALTER TABLE appointments
            ADD CONSTRAINT appointments_sale_transaction_id_fkey
            FOREIGN KEY (sale_transaction_id) REFERENCES accounting_transactions(id) ON DELETE SET NULL;
        END IF;

        CREATE INDEX IF NOT EXISTS appointments_is_paid_idx ON appointments(is_paid);
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF to_regclass('appointments') IS NULL THEN
          RETURN;
        END IF;

        DROP INDEX IF EXISTS appointments_is_paid_idx;

        ALTER TABLE appointments
          DROP CONSTRAINT IF EXISTS appointments_sale_transaction_id_fkey;

        ALTER TABLE appointments
          DROP COLUMN IF EXISTS sale_transaction_id;

        ALTER TABLE appointments
          DROP COLUMN IF EXISTS paid_at;

        ALTER TABLE appointments
          DROP COLUMN IF EXISTS is_paid;
      END $$;
    `);
  },
};
