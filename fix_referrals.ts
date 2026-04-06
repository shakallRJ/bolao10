import { supabase } from './src/supabase.js';

async function fixReferrals() {
  const jairoId = 11;
  const testUserIds = [52, 53]; // Teste 002 and Teste 003

  for (const userId of testUserIds) {
    // Update referred_by in users table
    const { error: updateErr } = await supabase
      .from('users')
      .update({ referred_by: jairoId })
      .eq('id', userId);
      
    if (updateErr) {
      console.error(`Error updating user ${userId}:`, updateErr);
      continue;
    }

    // Check if referral record already exists
    const { data: existingRef } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_id', userId)
      .maybeSingle();

    if (!existingRef) {
      // Insert referral record
      const { error: insertErr } = await supabase
        .from('referrals')
        .insert([{
          referrer_id: jairoId,
          referred_id: userId,
          bonus_amount: 2.00,
          bonus_paid: false
        }]);
        
      if (insertErr) {
        console.error(`Error inserting referral for user ${userId}:`, insertErr);
      } else {
        console.log(`Successfully fixed referral for user ${userId}`);
      }
    } else {
      console.log(`Referral record already exists for user ${userId}`);
    }
  }
}

fixReferrals();
