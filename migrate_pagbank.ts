import { supabase } from './src/supabase.ts';

async function migrate() {
  console.log('Starting PagBank migration...');

  // Note: In a real Supabase environment, you'd use the SQL editor.
  // Here we try to use RPC if available, or just log the required SQL.
  
  const sql = `
    -- Add columns to deposits table if they don't exist
    ALTER TABLE deposits ADD COLUMN IF NOT EXISTS payment_method TEXT;
    ALTER TABLE deposits ADD COLUMN IF NOT EXISTS pagbank_id TEXT;

    -- Create perfil table as requested (alias for wallets or new table)
    CREATE TABLE IF NOT EXISTS perfil (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      saldo DECIMAL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );

    -- Ensure wallets table exists (used by the app)
    CREATE TABLE IF NOT EXISTS wallets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      balance DECIMAL DEFAULT 0,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
    );
  `;

  console.log('Please run the following SQL in your Supabase SQL Editor:');
  console.log(sql);

  // Try to check if columns exist
  const { data, error } = await supabase.from('deposits').select('*').limit(1);
  if (error) {
    console.error('Error checking deposits table:', error.message);
  } else if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    if (!columns.includes('payment_method')) console.log('Missing column: payment_method');
    if (!columns.includes('pagbank_id')) console.log('Missing column: pagbank_id');
  }

  console.log('Migration check complete.');
}

migrate();
