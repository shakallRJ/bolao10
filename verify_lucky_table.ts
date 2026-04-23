
import { supabase } from './src/supabase.js';

async function checkTable() {
  console.log('Checking lucky_numbers table...');
  const { data, error } = await supabase.from('lucky_numbers').select('*').limit(1);
  
  if (error) {
    console.log('Table error/not found:', JSON.stringify(error, null, 2));
  } else {
    console.log('Table exists. Data sample:', data);
  }
}

checkTable();
