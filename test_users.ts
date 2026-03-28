
import { supabase } from './src/supabase.js';

async function test() {
  try {
    const { data, error } = await supabase.from('users').select('*').limit(1);
    if (error) {
      console.log('Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Users columns:', Object.keys(data[0]));
    }
  } catch (e) {
    console.log('Caught:', e);
  }
}

test();
