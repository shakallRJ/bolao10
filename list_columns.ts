
import { supabase } from './src/supabase.js';

async function listColumns() {
  const { data, error } = await supabase.from('prediction_items').select('*').limit(1);
  if (error) {
    console.log('Error:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  }
}

listColumns();
