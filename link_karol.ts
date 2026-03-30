
import { supabase } from './src/supabase.js';

async function linkKarol() {
  try {
    const referrerId = 48; // Dryk@
    const referredId = 49; // K@rol
    
    console.log(`Linking user ${referredId} to referrer ${referrerId}...`);

    // 1. Update user referred_by
    const { error: userUpdateErr } = await supabase
      .from('users')
      .update({ referred_by: referrerId })
      .eq('id', referredId);
    
    if (userUpdateErr) throw userUpdateErr;

    // 2. Create referral record
    const { data: referral, error: refInsertErr } = await supabase
      .from('referrals')
      .insert([{
        referrer_id: referrerId,
        referred_id: referredId,
        bonus_amount: 2.00,
        bonus_paid: false // Will be paid on first deposit
      }])
      .select()
      .single();
    
    if (refInsertErr) throw refInsertErr;

    console.log('Karol linked to Dryk@ successfully.');
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

linkKarol();
