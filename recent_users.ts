
import { supabase } from './src/supabase.js';

async function recentUsers() {
  try {
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false }).limit(10);
    if (error) console.log('Error:', error);
    console.log('Recent Users:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

recentUsers();
