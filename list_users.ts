
import { supabase } from './src/supabase.js';

async function listUsers() {
  try {
    const { data, error } = await supabase.from('users').select('id, nickname, referral_code, referred_by');
    if (error) console.log('Error:', error);
    console.log('Users:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

listUsers();
