
import { supabase } from './src/supabase.js';

async function searchUsers() {
  try {
    const { data: jairo, error: jairoErr } = await supabase
      .from('users')
      .select('*')
      .or('nickname.ilike.%Jairo%,nickname.ilike.%Dryk%');
    
    console.log('Jairo search:', jairo);

    const { data: nik, error: nikErr } = await supabase
      .from('users')
      .select('*')
      .or('nickname.ilike.%Nik%,nickname.ilike.%Nikname%');
    
    console.log('Nik search:', nik);
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

searchUsers();
