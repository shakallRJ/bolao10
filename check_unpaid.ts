import { supabase } from './src/supabase.js';

async function checkUnpaidReferrals() {
  const { data: unpaid } = await supabase.from('referrals').select('*').eq('bonus_paid', false);
  console.log('Unpaid referrals:', unpaid);
}

checkUnpaidReferrals();
