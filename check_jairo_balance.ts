import { supabase } from './src/supabase.js';

async function checkJairoBalance() {
  const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', 11).single();
  console.log('Jairo wallet:', wallet);
}

checkJairoBalance();
