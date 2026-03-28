
import { supabase } from './src/supabase.js';
import pg from 'pg';
const { Client } = pg;

async function runSQL() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('DATABASE_URL is missing');
    return;
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to DB');
    const sql = `
-- Add referral columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_validated BOOLEAN DEFAULT FALSE;

-- Create referrals table to track bonuses
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id BIGINT REFERENCES users(id) NOT NULL,
  referred_id BIGINT REFERENCES users(id) NOT NULL UNIQUE,
  bonus_paid BOOLEAN DEFAULT FALSE,
  bonus_amount DECIMAL(10,2) DEFAULT 2.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
    `;
    await client.query(sql);
    console.log('Migration successful');
  } catch (err) {
    console.log('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runSQL();
