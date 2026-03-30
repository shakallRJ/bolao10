
import { supabase } from './src/supabase.js';

async function listReferrals() {
  try {
    const { data, error } = await supabase.from('referrals').select('*, referrer:users!referrer_id(nickname), referred:users!referred_id(nickname)');
    if (error) console.log('Error:', error);
    console.log('Referrals:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

listReferrals();
