import { supabase } from './src/supabase.js';

async function checkJairoPredictions() {
  const { data, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('user_id', 11);
  console.log('Jairo predictions:', data);
  console.log('Predictions error:', error);
}

checkJairoPredictions();
