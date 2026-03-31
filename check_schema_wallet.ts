import { supabase } from './src/supabase.js';

async function checkSchema() {
  const { data, error } = await supabase
    .from('wallet_transactions')
    .select('*')
    .limit(1);
  console.log('Transactions sample:', data);
  console.log('Transactions error:', error);
}

checkSchema();
