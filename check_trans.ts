import { supabase } from './src/supabase.js';

async function checkTransactions() {
  const { data: trans } = await supabase.from('wallet_transactions').select('*').eq('wallet_id', '55f3c258-7622-4a86-881b-7b414be98219'); // Jairo's wallet ID
  console.log('Jairo transactions:', trans);
}

checkTransactions();
