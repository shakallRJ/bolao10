import { supabase } from './src/supabase.js';

async function checkSchema() {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .limit(1);
  console.log('Deposits sample:', data);
  console.log('Deposits error:', error);
}

checkSchema();
