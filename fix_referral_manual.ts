
import { supabase } from './src/supabase.js';

async function fixReferral() {
  try {
    const referrerId = 11; // Shakall (Jairo)
    const referredId = 48; // Dryk@ (Adriana)
    
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
        bonus_paid: true // We are paying it now
      }])
      .select()
      .single();
    
    if (refInsertErr) throw refInsertErr;

    // 3. Update referrer's wallet
    const { data: wallet, error: walErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', referrerId)
      .single();
    
    if (walErr) throw walErr;

    const newBalance = parseFloat(wallet.balance) + 2.00;
    const { error: walUpdateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);
    
    if (walUpdateErr) throw walUpdateErr;

    // 4. Insert transaction
    await supabase.from('wallet_transactions').insert([{
      wallet_id: wallet.id,
      amount: 2.00,
      type: 'referral_bonus',
      balance_after: newBalance,
      reference_id: referral.id,
      description: `Bônus por indicação de amigo (Dryk@)`
    }]);

    console.log('Referral fixed and bonus paid successfully.');
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

fixReferral();
