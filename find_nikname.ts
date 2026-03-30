
import { supabase } from './src/supabase.js';

async function findNikname() {
  try {
    const { data, error } = await supabase.from('users').select('*').ilike('nickname', '%Nik%');
    if (error) console.log('Error:', error);
    console.log('Users with Nik:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

findNikname();
