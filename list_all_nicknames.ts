
import { supabase } from './src/supabase.js';

async function listAllNicknames() {
  try {
    const { data, error } = await supabase.from('users').select('nickname');
    if (error) console.log('Error:', error);
    console.log('All Nicknames:', data.map(u => u.nickname));
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

listAllNicknames();
