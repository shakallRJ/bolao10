import { supabase } from './src/supabase.js';

async function checkMissingBetDeductions() {
  const { data: predictions } = await supabase.from('predictions').select('*').eq('proof_path', 'wallet_payment');
  
  for (const pred of predictions || []) {
    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', pred.user_id).single();
    if (wallet) {
      const { data: trans } = await supabase.from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('type', 'bet_deduction')
        .like('description', `%#${pred.round_id}%`);
        
      if (!trans || trans.length === 0) {
        console.log(`Missing bet_deduction for user ${pred.user_id}, round ${pred.round_id}`);
      }
    }
  }
}

checkMissingBetDeductions();
