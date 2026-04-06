import { supabase } from './src/supabase.js';

async function checkJairoPredictions() {
  const { data: predictions } = await supabase.from('predictions').select('*').eq('user_id', 11);
  console.log('Jairo predictions:', predictions);
}

checkJairoPredictions();
