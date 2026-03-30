
import { supabase } from './src/supabase.js';

async function checkDeposits() {
  try {
    const { data, error } = await supabase.from('deposits').select('*').order('created_at', { ascending: false }).limit(10);
    if (error) console.log('Error:', error);
    console.log('Recent Deposits:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkDeposits();
