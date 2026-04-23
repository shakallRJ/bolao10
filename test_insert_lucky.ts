
import { supabase } from './src/supabase.js';

async function testInsert() {
  const { data, error } = await supabase
    .from('lucky_numbers')
    .insert([{ user_id: '8f727670-8b06-444a-9e19-915060799480', prediction_id: 1, number: '123456' }]);
  
  if (error) {
    console.log('Insert Error:', JSON.stringify(error, null, 2));
  } else {
    console.log('Insert Success:', data);
  }
}

testInsert();
