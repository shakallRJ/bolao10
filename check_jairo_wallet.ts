import { supabase } from './src/supabase.js';

async function checkJairoWallet() {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', 11)
    .single();
  console.log('Jairo wallet:', wallet);
  
  if (wallet) {
    const { data: transactions } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id);
    console.log('Jairo transactions:', transactions);
  }
}

checkJairoWallet();
