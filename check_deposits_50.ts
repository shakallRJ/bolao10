import { supabase } from './src/supabase.js';

async function checkDeposits50() {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('user_id', 50);
  console.log('Deposits user 50:', data);
}

checkDeposits50();
