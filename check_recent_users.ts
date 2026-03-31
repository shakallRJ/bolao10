import { supabase } from './src/supabase.js';

async function checkRecentUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent users:', data);
}

checkRecentUsers();
