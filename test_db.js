
const { supabase } = require('./src/supabase.js');

async function test() {
  const { data, error } = await supabase.from('referrals').select('*').limit(1);
  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Data:', data);
  }
}

test();
