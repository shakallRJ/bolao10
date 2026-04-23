
import dotenv from 'dotenv';
dotenv.config();

async function runMigration() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.lucky_numbers (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
        prediction_id BIGINT REFERENCES public.predictions(id) ON DELETE CASCADE,
        number TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.lucky_numbers ENABLE ROW LEVEL SECURITY;

    DO $$ 
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own lucky numbers') THEN
            CREATE POLICY "Users can view their own lucky numbers"
            ON public.lucky_numbers FOR SELECT
            TO authenticated
            USING (auth.uid() = user_id::text); -- Adjust based on how auth.uid() is stored if needed, but BIGINT is rare for auth.uid()
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view all lucky numbers') THEN
            CREATE POLICY "Admins can view all lucky numbers"
            ON public.lucky_numbers FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE public.users.id::text = auth.uid()
                    AND public.users.role = 'admin'
                )
            );
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_lucky_numbers_user_id ON public.lucky_numbers(user_id);
    CREATE INDEX IF NOT EXISTS idx_lucky_numbers_prediction_id ON public.lucky_numbers(prediction_id);
  `;

  console.log('Running migration to create lucky_numbers table via REST API...');
  
  const url = `${process.env.SUPABASE_URL || 'https://zxnsubmxqoplohcngntu.supabase.co'}/rest/v1/rpc/exec_sql`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is missing');
    return;
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    console.log('Migration Status:', res.status);
    const text = await res.text();
    console.log('Migration Response:', text);
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

runMigration();
