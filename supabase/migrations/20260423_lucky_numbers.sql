-- Create lucky_numbers table
CREATE TABLE IF NOT EXISTS public.lucky_numbers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES public.users(id) ON DELETE CASCADE,
    prediction_id BIGINT REFERENCES public.predictions(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.lucky_numbers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own lucky numbers"
ON public.lucky_numbers FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_lucky_numbers_user_id ON public.lucky_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_lucky_numbers_prediction_id ON public.lucky_numbers(prediction_id);
