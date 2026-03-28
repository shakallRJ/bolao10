
import { supabase } from './src/supabase.js';

async function test() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
    if (error) {
      console.log('RPC Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('RPC Success:', data);
    }
  } catch (e) {
    console.log('Caught:', e);
  }
}

test();
