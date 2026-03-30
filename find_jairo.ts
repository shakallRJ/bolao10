
import { supabase } from './src/supabase.js';

async function findJairo() {
  try {
    const { data, error } = await supabase.from('users').select('*').ilike('name', '%Jairo%');
    if (error) console.log('Error:', error);
    console.log('Users with Jairo in name:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

findJairo();
