
import { supabase } from './src/supabase.js';

async function checkUsers() {
  try {
    // Find Jairoedryka
    const { data: jairo, error: jairoErr } = await supabase
      .from('users')
      .select('id, nickname, referral_code')
      .ilike('nickname', 'Jairoedryka')
      .maybeSingle();
    
    if (jairoErr) console.log('Jairo error:', jairoErr);
    console.log('Jairo:', jairo);

    // Find Nikname
    const { data: nikname, error: niknameErr } = await supabase
      .from('users')
      .select('id, nickname, referred_by')
      .ilike('nickname', 'Nikname')
      .maybeSingle();
    
    if (niknameErr) console.log('Nikname error:', niknameErr);
    console.log('Nikname:', nikname);

    if (jairo && nikname) {
      if (nikname.referred_by === jairo.id) {
        console.log('Referral link exists in users table.');
        
        // Check referrals table
        const { data: referral, error: refErr } = await supabase
          .from('referrals')
          .select('*')
          .eq('referred_id', nikname.id)
          .maybeSingle();
        
        if (refErr) console.log('Referral table error:', refErr);
        console.log('Referral record:', referral);
      } else {
        console.log('Nikname is NOT referred by Jairo in users table.');
      }
    }
  } catch (e) {
    console.log('Caught exception:', e);
  }
}

checkUsers();
