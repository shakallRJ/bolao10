
import { supabase } from './src/supabase.js';

async function checkReferredUsers() {
  try {
    const { data, error } = await supabase.from('users').select('*').not('referred_by', 'is', null);
    if (error) console.log('Error:', error);
    console.log('Referred users:', data);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkReferredUsers();
