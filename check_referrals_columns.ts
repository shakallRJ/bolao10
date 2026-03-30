
import { supabase } from './src/supabase.js';

async function checkReferralsColumns() {
  try {
    const { data, error } = await supabase.from('referrals').select('*').limit(1);
    if (error) {
      console.log('Error:', error);
    } else if (data && data.length > 0) {
      console.log('Referrals columns:', Object.keys(data[0]));
    } else {
      console.log('Referrals table is empty.');
    }
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkReferralsColumns();
