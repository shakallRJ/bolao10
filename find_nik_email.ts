
import { supabase } from './src/supabase.js';

async function findNikEmail() {
  try {
    const { data, error } = await supabase.from('users').select('*').ilike('email', '%Nik%');
    if (error) console.log('Error:', error);
    console.log('Users by email Nik:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

findNikEmail();
