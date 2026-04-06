import { supabase } from './src/supabase.js';

async function insertMissingBetDeductions() {
  const missingUsers = [17, 32, 43, 24];
  const roundId = 12;

  for (const userId of missingUsers) {
    const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', userId).single();
    if (wallet) {
      // Check if transaction already exists
      const { data: trans } = await supabase.from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('type', 'bet_deduction')
        .like('description', `%#${roundId}%`);

      if (!trans || trans.length === 0) {
        // Calculate total cost based on number of predictions
        const { count } = await supabase.from('predictions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('round_id', roundId)
          .eq('proof_path', 'wallet_payment');

        const totalCost = (count || 0) * 10; // Assuming 10 per prediction

        if (totalCost > 0) {
          const { error: transErr } = await supabase.from('wallet_transactions').insert([{
            wallet_id: wallet.id,
            amount: -totalCost,
            type: 'bet_deduction',
            balance_after: wallet.balance, // using current balance
            reference_id: `prediction_round_${roundId}`,
            description: `Pagamento de palpites para rodada #${roundId}`
          }]);

          if (transErr) {
            console.error(`Error inserting transaction for user ${userId}:`, transErr);
          } else {
            console.log(`Successfully inserted transaction for user ${userId}`);
          }
        }
      }
    }
  }
}

insertMissingBetDeductions();
