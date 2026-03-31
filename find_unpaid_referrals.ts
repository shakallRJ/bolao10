import { supabase } from './src/supabase.js';

async function findUnpaidReferrals() {
  const { data: referrals, error } = await supabase
    .from('referrals')
    .select('*, referred:users!referred_id(id, nickname)')
    .eq('bonus_paid', false);
    
  if (error) {
    console.error('Error fetching referrals:', error);
    return;
  }
  
  console.log(`Found ${referrals.length} unpaid referrals.`);
  console.log('Unpaid referrals:', referrals);
  
  for (const ref of referrals) {
    const { data: deposits, error: depErr } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', ref.referred_id)
      .eq('status', 'approved')
      .gte('amount', 10);
      
    if (deposits && deposits.length > 0) {
      console.log(`User ${ref.referred.nickname} (ID: ${ref.referred_id}) has approved deposits >= 10, but bonus is unpaid!`);
      console.log('Referral record:', ref);
    }
  }
}

findUnpaidReferrals();
