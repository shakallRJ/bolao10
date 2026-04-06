import { supabase } from './src/supabase.js';

async function checkKarolDeposits() {
  const { data: deposits } = await supabase.from('deposits').select('*').eq('user_id', 49);
  console.log('Karol deposits:', deposits);
}

checkKarolDeposits();
