import { supabase } from './src/supabase.js';

async function insertPredictionFee() {
  const jairoId = 11;
  const roundId = 12;

  const { data: referrerWallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', jairoId)
    .single();

  if (!referrerWallet) return;

  const { error: transErr } = await supabase.from('wallet_transactions').insert([{
    wallet_id: referrerWallet.id,
    amount: -10.00,
    type: 'bet_deduction',
    balance_after: referrerWallet.balance, // using current balance
    reference_id: `prediction_round_${roundId}`,
    description: `Pagamento de palpites para rodada #${roundId}`
  }]);

  if (transErr) {
    console.error('Error inserting transaction:', transErr);
  } else {
    console.log(`Successfully inserted transaction for prediction fee`);
  }
}

insertPredictionFee();
