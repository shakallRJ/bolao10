import { supabase } from './src/supabase.js';

async function searchJairo() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .ilike('name', '%jairo%');
  console.log('Jairo by name:', data);

  const { data: data2, error: error2 } = await supabase
    .from('users')
    .select('*')
    .ilike('nickname', '%jairo%');
  console.log('Jairo by nickname:', data2);
}

searchJairo();
