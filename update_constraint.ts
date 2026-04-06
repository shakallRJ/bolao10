import { supabase } from './src/supabase.js';

async function updateConstraint() {
  const { error } = await supabase.rpc('execute_sql', {
    sql_query: `
      ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
      ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_type_check CHECK (type IN ('deposit', 'bet_deduction', 'prize_credit', 'withdrawal', 'admin_adjustment', 'referral_bonus', 'prediction_fee'));
    `
  });
  console.log('Update constraint error:', error);
}

updateConstraint();
