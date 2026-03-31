import { supabase } from './src/supabase.js';

async function checkJairoReferrals() {
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referrer_id', 11);
  console.log('Jairo referrals:', data);
  
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')
    .eq('referred_by', 11);
  console.log('Users referred by Jairo:', users);
}

checkJairoReferrals();
