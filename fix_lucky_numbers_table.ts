
import { supabase } from './src/supabase.js';

async function runMigration() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.lucky_numbers (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
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
            USING (auth.uid() = user_id);
        END IF;

        IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins can view all lucky numbers') THEN
            CREATE POLICY "Admins can view all lucky numbers"
            ON public.lucky_numbers FOR SELECT
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE public.users.id = auth.uid()
                    AND public.users.role = 'admin'
                )
            );
        END IF;
    END $$;

    CREATE INDEX IF NOT EXISTS idx_lucky_numbers_user_id ON public.lucky_numbers(user_id);
    CREATE INDEX IF NOT EXISTS idx_lucky_numbers_prediction_id ON public.lucky_numbers(prediction_id);
  `;

  console.log('Running migration to create lucky_numbers table...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.log('Migration RPC Error:', JSON.stringify(error, null, 2));
    } else {
      console.log('Migration RPC Success:', data);
    }
  } catch (e) {
    console.log('Caught Error:', e);
  }
}

runMigration();
