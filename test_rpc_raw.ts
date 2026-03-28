
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  const url = `${process.env.SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql: 'SELECT 1' })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}

test();
