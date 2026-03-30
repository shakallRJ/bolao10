
import { supabase } from './src/supabase.js';

async function testInsert() {
  try {
    const { data, error } = await supabase.from('referrals').insert([{
      referrer_id: 1,
      referred_id: 1,
      bonus_amount: 2.00,
      bonus_paid: false
    }]).select();
    
    if (error) {
      console.log('Insert error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Insert success:', data);
      // Delete the test record
      await supabase.from('referrals').delete().eq('id', data[0].id);
    }
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

testInsert();
