import { supabase } from './src/supabase.js';

async function checkDeposits() {
  const testUserIds = [52, 53];

  for (const userId of testUserIds) {
    const { data: deposits } = await supabase.from('deposits').select('*').eq('user_id', userId);
    console.log(`Deposits for user ${userId}:`, deposits);
  }
}

checkDeposits();
