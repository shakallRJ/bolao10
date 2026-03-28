
import { supabase } from './src/supabase.js';

async function test() {
  try {
    const { data, error } = await supabase.rpc('place_multiple_predictions_with_wallet', { 
      p_user_id: 1, 
      p_round_id: 1, 
      p_total_cost: 0, 
      p_predictions: [] 
    });
    if (error) {
      console.log('RPC Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('RPC Success:', data);
    }
  } catch (e) {
    console.log('Caught:', e);
  }
}

test();
