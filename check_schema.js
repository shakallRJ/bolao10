
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'referrals' });
  if (error) {
    // If RPC doesn't exist, try a simple query
    console.log('RPC failed, trying direct query');
    const { data: cols, error: colErr } = await supabase.from('referrals').select('*').limit(1);
    console.log('Referrals sample:', cols);
    console.log('Referrals error:', colErr);
    
    const { data: userCols, error: userColErr } = await supabase.from('users').select('*').limit(1);
    console.log('Users sample:', userCols);
    console.log('Users error:', userColErr);
  } else {
    console.log('Table info:', data);
  }
}

checkSchema();
