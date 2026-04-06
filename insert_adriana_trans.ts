import { supabase } from './src/supabase.js';

async function insertAdrianaTransaction() {
  const jairoId = 11;
  const adrianaId = 48;

  const { data: referrerWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', jairoId)
    .single();

  if (!referrerWallet) return;

  const { data: referral } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', jairoId)
    .eq('referred_id', adrianaId)
    .single();

  if (referral) {
    // Insert transaction for referrer
    const { error: transErr } = await supabase.from('wallet_transactions').insert([{
      wallet_id: referrerWallet.id,
      amount: 2.00,
      type: 'prize_credit',
      balance_after: referrerWallet.balance, // using current balance
      reference_id: referral.id,
      description: `Bônus de indicação (Usuário #${adrianaId})`
    }]);

    if (transErr) {
      console.error('Error inserting transaction:', transErr);
    } else {
      console.log(`Successfully inserted transaction for referral ${referral.id}`);
    }
  }
}

insertAdrianaTransaction();
