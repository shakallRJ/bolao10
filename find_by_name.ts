
import { supabase } from './src/supabase.js';

async function findByName() {
  try {
    const { data, error } = await supabase.from('users').select('*').ilike('name', '%Nik%');
    if (error) console.log('Error:', error);
    console.log('Users by name:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

findByName();
