import { supabase } from './src/supabase.js';

async function checkLowercaseReferralCodes() {
  const { data: users } = await supabase.from('users').select('id, name, referral_code');
  const lowercaseUsers = users?.filter(u => u.referral_code && u.referral_code !== u.referral_code.toUpperCase());
  console.log('Users with lowercase referral codes:', lowercaseUsers);
}

checkLowercaseReferralCodes();
