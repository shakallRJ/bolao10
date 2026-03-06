import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function addPhoneColumn() {
  const { error } = await supabase.rpc('exec_sql', {
    query: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;'
  });

  if (error) {
    console.error('Error adding column via RPC, trying direct SQL if possible:', error);
    // If RPC is not available, we can't easily alter the table from the client.
    // However, Supabase often allows adding columns if RLS permits or if using service role.
    // Let's try to insert a dummy record with phone to see if it exists.
    const { error: insertError } = await supabase.from('users').insert([{ email: 'dummy_phone_check@test.com', password: 'dummy', name: 'dummy', nickname: 'dummy', phone: '123' }]);
    if (insertError && insertError.code === 'PGRST204') {
        console.log('Column might not exist, but we cannot create it automatically without RPC. Please add it manually in Supabase dashboard: ALTER TABLE users ADD COLUMN phone TEXT;');
    } else {
        console.log('Column phone seems to exist or was added.');
        await supabase.from('users').delete().eq('email', 'dummy_phone_check@test.com');
    }
  } else {
    console.log('Successfully added phone column.');
  }
}

addPhoneColumn();
