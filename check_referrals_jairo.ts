import { supabase } from './src/supabase.js';

async function checkReferrals() {
  // Find Jairo
  const { data: jairo } = await supabase.from('users').select('*').ilike('name', '%jairo%').maybeSingle();
  console.log('Jairo:', jairo);

  if (jairo) {
    // Find referrals by Jairo
    const { data: referrals } = await supabase.from('referrals').select('*, referred:users!referred_id(name, nickname)').eq('referrer_id', jairo.id);
    console.log('Referrals by Jairo:', referrals);

    for (const ref of referrals || []) {
      const { data: deposits } = await supabase.from('deposits').select('*').eq('user_id', ref.referred_id);
      console.log(`Deposits for ${ref.referred.name}:`, deposits);
    }
  }
}

checkReferrals();
