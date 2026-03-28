
import { supabase } from './src/supabase.js';

async function test() {
  try {
    const { data, error } = await supabase.from('referrals').select('*').limit(1);
    if (error) {
      console.log('Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Data:', data);
    }
  } catch (e) {
    console.log('Caught:', e);
  }
}

test();
