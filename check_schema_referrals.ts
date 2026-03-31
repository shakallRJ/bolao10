import { supabase } from './src/supabase.js';

async function checkSchema() {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .limit(1);
  console.log('Referrals sample:', data);
  console.log('Referrals error:', error);
}

checkSchema();
