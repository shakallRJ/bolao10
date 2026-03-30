
import { supabase } from './src/supabase.js';

async function checkReferralsTable() {
  try {
    // We can't directly check schema with supabase-js easily, 
    // but we can try to insert a dummy record to see if it works.
    // Or we can try to select from it.
    const { data, error } = await supabase.from('referrals').select('*').limit(1);
    if (error) {
      console.log('Referrals table error:', error);
    } else {
      console.log('Referrals table exists and is accessible.');
    }
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkReferralsTable();
