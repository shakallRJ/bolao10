
import { supabase } from './src/supabase.js';

async function listUsersColumns() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) {
    console.log('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Users table columns:', Object.keys(data[0]));
    console.log('Sample User:', data[0]);
  }
}

listUsersColumns();
