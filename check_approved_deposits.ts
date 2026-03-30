
import { supabase } from './src/supabase.js';

async function checkApprovedDeposits() {
  try {
    const { data, error } = await supabase.from('deposits').select('*, user:users(nickname, name)').eq('status', 'approved').gte('amount', 10).order('created_at', { ascending: false }).limit(20);
    if (error) console.log('Error:', error);
    console.log('Approved Deposits:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkApprovedDeposits();
