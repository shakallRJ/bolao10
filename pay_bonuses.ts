import { supabase } from './src/supabase.js';

async function payBonuses() {
  const jairoId = 11;
  const testUserIds = [52, 53];

  for (const userId of testUserIds) {
    // Get the unpaid referral record
    const { data: referral } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', jairoId)
      .eq('referred_id', userId)
      .eq('bonus_paid', false)
      .maybeSingle();

    if (referral) {
      console.log(`Paying bonus for referral ${referral.id} (referred_id: ${userId})`);
      
      const bonusAmount = 2.00;

      // 1. Mark referral as paid
      const { error: updateRefErr } = await supabase
        .from('referrals')
        .update({ bonus_paid: true, updated_at: new Date().toISOString() })
        .eq('id', referral.id);

      if (updateRefErr) {
        console.error('Error updating referral:', updateRefErr);
        continue;
      }

      // 2. Get referrer wallet
      const { data: referrerWallet, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', jairoId)
        .single();

      if (walletErr || !referrerWallet) {
        console.error('Error getting referrer wallet:', walletErr);
        continue;
      }

      // 3. Update referrer wallet balance
      const referrerNewBalance = referrerWallet.balance + bonusAmount;
      const { error: updateWalletErr } = await supabase
        .from('wallets')
        .update({ balance: referrerNewBalance, updated_at: new Date().toISOString() })
        .eq('id', referrerWallet.id);

      if (updateWalletErr) {
        console.error('Error updating referrer wallet:', updateWalletErr);
        continue;
      }

      // 4. Insert transaction for referrer
      const { error: transErr } = await supabase.from('wallet_transactions').insert([{
        wallet_id: referrerWallet.id,
        amount: bonusAmount,
        type: 'prize_credit',
        balance_after: referrerNewBalance,
        reference_id: referral.id,
        description: `Bônus de indicação (Usuário #${userId})`
      }]);

      if (transErr) {
        console.error('Error inserting transaction:', transErr);
      } else {
        console.log(`Successfully paid bonus for referral ${referral.id}`);
      }
    } else {
      console.log(`No unpaid referral found for user ${userId}`);
    }
  }
}

payBonuses();
