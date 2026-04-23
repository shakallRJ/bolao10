
import { supabase } from './src/supabase.js';

async function checkUsers() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('User ID type:', typeof data[0].id, data[0].id);
  }
}

checkUsers();
