import { supabase } from './src/supabase.js';

async function check() {
  const { data, error } = await supabase.from('wallet_transactions').update({ description: 'test' }).eq('id', '328b1f25-7cfb-4534-bcca-d9ad55623c38');
  console.log('Data:', data);
  console.log('Error:', error);
}

check();

