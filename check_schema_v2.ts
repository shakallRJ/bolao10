
import { supabase } from './src/supabase.js';

async function checkSchema() {
  try {
    // Check if referrals table exists
    const { data: refData, error: refError } = await supabase.from('referrals').select('*').limit(1);
    if (refError) {
      console.log('Referrals table error:', JSON.stringify(refError, null, 2));
    } else {
      console.log('Referrals table exists.');
    }

    // Check users table columns
    const { data: userData, error: userError } = await supabase.from('users').select('*').limit(1);
    if (userError) {
      console.log('Users table error:', JSON.stringify(userError, null, 2));
    } else if (userData && userData.length > 0) {
      console.log('Users columns:', Object.keys(userData[0]));
    } else {
      console.log('Users table is empty or could not be read.');
    }
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkSchema();
