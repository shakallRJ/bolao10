import { supabase } from './src/supabase.js';

async function checkDeposits49() {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', 49);
  console.log('Deposits user 49:', data);
}

checkDeposits49();
