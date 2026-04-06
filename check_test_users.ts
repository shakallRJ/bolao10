import { supabase } from './src/supabase.js';

async function checkTestUsers() {
  const { data: users } = await supabase.from('users').select('*').ilike('name', '%teste 00%');
  console.log('Test users:', users);

  for (const user of users || []) {
    const { data: referrals } = await supabase.from('referrals').select('*').eq('referred_id', user.id);
    console.log(`Referrals for ${user.name}:`, referrals);
  }
}

checkTestUsers();
