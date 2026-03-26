-- 1. Criar tabela de Carteiras (Wallets)
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  balance NUMERIC(10, 2) DEFAULT 0.00 CHECK (balance >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar tabela de Transações (Ledger Imutável)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('deposit', 'bet_deduction', 'prize_credit', 'withdrawal', 'admin_adjustment')),
  balance_after NUMERIC(10, 2) NOT NULL,
  reference_id TEXT, -- ID do palpite, depósito, etc. (Usando TEXT para flexibilidade)
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar tabela de Depósitos
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proof_url TEXT,
  approved_by BIGINT REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Trigger para criar carteira automaticamente para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new.id, 0.00);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON public.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_wallet();

-- 5. Inserir carteiras para usuários já existentes
INSERT INTO wallets (user_id, balance)
SELECT id, 0.00 FROM users
ON CONFLICT (user_id) DO NOTHING;

-- 6. FUNÇÃO ACID PARA REGISTRAR PALPITES E DEBITAR SALDO
-- Esta função garante que o saldo não fique negativo e que a aposta só seja salva se houver saldo.
CREATE OR REPLACE FUNCTION place_multiple_predictions_with_wallet(
  p_user_id BIGINT,
  p_round_id INT,
  p_total_cost NUMERIC,
  p_predictions JSONB -- Array de arrays de palpites: [ [{"game_id": 1, "guess": "1"}, ...], [...] ]
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_current_balance NUMERIC;
  v_prediction_id INT;
  v_pred JSONB;
  v_guess JSONB;
  v_inserted_ids INT[] := '{}';
BEGIN
  -- 1. Bloquear a linha da carteira para leitura/escrita simultânea (Row-Level Lock)
  SELECT id, balance INTO v_wallet_id, v_current_balance
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carteira não encontrada para o usuário.';
  END IF;

  -- 2. Verificar se há saldo suficiente
  IF v_current_balance < p_total_cost THEN
    RAISE EXCEPTION 'Saldo insuficiente. Saldo atual: R$ %, Necessário: R$ %', v_current_balance, p_total_cost;
  END IF;

  -- 3. Debitar o saldo da carteira
  UPDATE wallets
  SET balance = balance - p_total_cost,
      updated_at = NOW()
  WHERE id = v_wallet_id
  RETURNING balance INTO v_current_balance;

  -- 4. Loop para inserir cada palpite (cartela)
  FOR v_pred IN SELECT * FROM jsonb_array_elements(p_predictions)
  LOOP
    -- Inserir o palpite principal (Já entra como 'approved' pois foi pago com saldo)
    INSERT INTO predictions (user_id, round_id, status)
    VALUES (p_user_id, p_round_id, 'approved')
    RETURNING id INTO v_prediction_id;

    v_inserted_ids := array_append(v_inserted_ids, v_prediction_id);

    -- Inserir os itens (jogos) do palpite
    FOR v_guess IN SELECT * FROM jsonb_array_elements(v_pred)
    LOOP
      INSERT INTO prediction_items (prediction_id, game_id, guess)
      VALUES (v_prediction_id, (v_guess->>'game_id')::INT, v_guess->>'guess');
    END LOOP;
  END LOOP;

  -- 5. Registrar a transação no Livro-Razão (Ledger)
  INSERT INTO wallet_transactions (wallet_id, amount, type, balance_after, description, reference_id)
  VALUES (
    v_wallet_id, 
    -p_total_cost, 
    'bet_deduction', 
    v_current_balance, 
    'Palpites (' || jsonb_array_length(p_predictions) || 'x) Rodada #' || p_round_id,
    array_to_string(v_inserted_ids, ',')
  );

  -- Retornar sucesso com os IDs gerados e o novo saldo
  RETURN jsonb_build_object(
    'success', true,
    'prediction_ids', v_inserted_ids,
    'new_balance', v_current_balance
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
