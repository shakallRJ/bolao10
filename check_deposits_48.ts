import { supabase } from './src/supabase.js';

async function checkDeposits() {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', 48);
  console.log('Deposits user 48:', data);
}

checkDeposits();
