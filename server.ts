import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './src/supabase.js';

dotenv.config();

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bolao10-secret-key-2024';

// Ensure uploads directory exists
const uploadsDir = process.env.VERCEL ? '/tmp/uploads' : path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Auth Middleware
const authenticate = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const isAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
};

// --- API ROUTES ---

app.get('/api/health', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    res.json({ status: 'ok', db: 'connected', userCount: data });
  } catch (err: any) {
    res.status(500).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// Auth
app.post('/api/auth/register', async (req, res) => {
  const { email, password, name, nickname, phone } = req.body;
  try {
    // Storing password in plain text as requested to allow admin to view it
    const { data, error } = await supabase
      .from('users')
      .insert([{ email, password, name, nickname, phone }])
      .select()
      .single();

    if (error) throw error;

    const token = jwt.sign({ id: data.id, email: data.email, role: data.role, name: data.name, nickname: data.nickname, phone: data.phone }, JWT_SECRET);
    res.json({ token, user: { id: data.id, email: data.email, name: data.name, role: data.role, nickname: data.nickname, phone: data.phone } });
  } catch (err: any) {
    console.error('Register error:', err);
    res.status(400).json({ error: 'Email ou Nickname já existe ou dados inválidos' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    // Comparing plain text passwords as requested
    if (password !== user.password) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name, nickname: user.nickname, phone: user.phone }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({ 
      token, 
      user: { id: user.id, email: user.email, name: user.name, role: user.role, nickname: user.nickname, phone: user.phone } 
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno no servidor' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (error || !user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Notify admin via a notification in settings
    const { data: currentNotifs } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    const notifications = currentNotifs ? JSON.parse(currentNotifs.value) : [];
    
    notifications.unshift({
      id: Date.now(),
      type: 'forgot_password',
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      user_phone: user.phone,
      date: new Date().toISOString(),
      message: `O usuário ${user.name} (@${user.nickname}) solicitou recuperação de senha.`
    });

    await supabase.from('settings').upsert({ key: 'admin_notifications', value: JSON.stringify(notifications.slice(0, 50)) }, { onConflict: 'key' });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao processar solicitação' });
  }
});

app.put('/api/my-profile', authenticate, async (req: any, res) => {
  const { name, nickname, phone, password } = req.body;
  const userId = req.user.id;

  try {
    const updateData: any = { name, nickname, phone };
    if (password) {
      updateData.password = password; // Plain text as requested in previous turn
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Nickname já está em uso' });
      }
      throw error;
    }

    // Generate new token with updated user info
    const token = jwt.sign(
      { id: data.id, email: data.email, role: data.role, name: data.name, nickname: data.nickname, phone: data.phone }, 
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token,
      user: { id: data.id, email: data.email, name: data.name, role: data.role, nickname: data.nickname, phone: data.phone } 
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

// Rounds & Games
app.get('/api/rounds', async (req, res) => {
  try {
    const { data: rounds, error } = await supabase
      .from('rounds')
      .select('*')
      .order('number', { ascending: false });
    if (error) throw error;

    const { data: historySetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_history').maybeSingle();
    let jackpotHistory: any[] = [];
    if (historySetting?.value) {
      try {
        jackpotHistory = JSON.parse(historySetting.value);
      } catch (e) {}
    }

    const roundsWithJackpot = rounds?.map(round => {
      const roundJackpot = jackpotHistory.find(jh => jh.round_id == round.id);
      return {
        ...round,
        jackpot_winners_names: roundJackpot ? roundJackpot.winners_names : null,
        jackpot_prize_paid: roundJackpot ? roundJackpot.prize_paid : 0
      };
    }) || [];

    res.json(roundsWithJackpot);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar rodadas' });
  }
});

app.get('/api/rounds/latest', async (req, res) => {
  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('*')
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) throw roundErr;
    if (!round) return res.json(null);

    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('round_id', round.id)
      .order('game_order', { ascending: true });

    const { data: jackpotSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'jackpot_pool')
      .maybeSingle();

    res.json({ ...round, games: games || [], jackpotPool: parseFloat(jackpotSetting?.value || '0') });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar última rodada' });
  }
});

app.get('/api/rounds/current', async (req, res) => {
  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('*')
      .or('status.neq.finished,status.is.null')
      .order('number', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundErr) {
      console.error('Fetch current round error:', roundErr);
      return res.status(500).json({ error: roundErr.message });
    }

    if (!round) return res.json(null);

    const { data: games, error: gamesErr } = await supabase
      .from('games')
      .select('*')
      .eq('round_id', round.id)
      .order('game_order', { ascending: true });

    if (gamesErr) console.error('Fetch games error:', gamesErr);

    const { data: jackpotSetting, error: jackpotErr } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'jackpot_pool')
      .maybeSingle();

    if (jackpotErr) console.error('Fetch jackpot error:', jackpotErr);

    res.json({ ...round, games: games || [], jackpotPool: parseFloat(jackpotSetting?.value || '0'), entry_value: round.entry_value || 10 });
  } catch (err) {
    console.error('Current round route error:', err);
    res.status(500).json({ error: 'Erro interno ao buscar rodada' });
  }
});

app.get('/api/rounds/:id', async (req, res) => {
  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (roundErr) throw roundErr;

    const { data: games } = await supabase
      .from('games')
      .select('*')
      .eq('round_id', round.id)
      .order('game_order', { ascending: true });

    const { data: jackpotSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'jackpot_pool')
      .maybeSingle();

    const { data: historySetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'jackpot_history')
      .maybeSingle();

    let jackpotWinnerNames = null;
    let jackpotPrizePaid = 0;

    if (historySetting?.value) {
      try {
        const history = JSON.parse(historySetting.value);
        const roundJackpot = history.find((jh: any) => jh.round_id == round.id);
        if (roundJackpot) {
          jackpotWinnerNames = roundJackpot.winners_names;
          jackpotPrizePaid = roundJackpot.prize_paid;
        }
      } catch (e) {}
    }

    res.json({ 
      ...round, 
      games: games || [], 
      jackpotPool: parseFloat(jackpotSetting?.value || '0'),
      jackpot_winners_names: jackpotWinnerNames,
      jackpot_prize_paid: jackpotPrizePaid
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar detalhes da rodada' });
  }
});

app.get('/api/my-predictions', authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('predictions')
      .select('*, rounds(number, status, games(*)), prediction_items(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = data?.map((p: any) => ({
      ...p,
      round_number: p.rounds?.number || '?',
      round_status: p.rounds?.status || 'open',
      games: p.rounds?.games?.sort((a: any, b: any) => a.game_order - b.game_order) || [],
      items: p.prediction_items || []
    }));

    res.json(formatted || []);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar seus palpites' });
  }
});

app.get('/api/my-wallet', authenticate, async (req: any, res) => {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*, rounds(id, number, entry_value, status, winners_names, winners_prize)')
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Supabase error in /api/my-wallet:', error);
      throw error;
    }

    const { data: historySetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_history').maybeSingle();
    let jackpotHistory: any[] = [];
    try {
      if (historySetting?.value) jackpotHistory = JSON.parse(historySetting.value);
    } catch (e) {}

    let totalSpent = 0;
    let totalWinnings = 0;
    const approvedPredictions = predictions?.filter(p => p.status === 'approved') || [];
    const pendingPredictions = predictions?.filter(p => p.status === 'pending') || [];
    const predictionsMade = approvedPredictions.length;

    approvedPredictions.forEach((p: any) => {
      const entryValue = p.rounds?.entry_value || 10;
      totalSpent += entryValue;

      if (p.rounds?.status === 'finished') {
        // Check if user won the regular prize
        const winners = p.rounds?.winners_names?.split(',').map((w: string) => w.trim()) || [];
        if (winners.includes(req.user.nickname) || winners.includes(req.user.name)) {
          totalWinnings += (p.rounds?.winners_prize || 0) / (winners.length || 1);
        }

        // Check if user won the jackpot
        const roundJackpot = jackpotHistory.find(jh => jh.round_id == p.rounds?.id);
        if (roundJackpot) {
          const jackpotWinners = roundJackpot.winners_names?.split(',').map((w: string) => w.trim()) || [];
          if (jackpotWinners.includes(req.user.nickname) || jackpotWinners.includes(req.user.name)) {
            totalWinnings += (roundJackpot.prize_paid || 0) / (jackpotWinners.length || 1);
          }
        }
      }
    });

    res.json({ totalSpent, predictionsMade, totalWinnings, pendingPredictions });
  } catch (err) {
    console.error('Wallet error:', err);
    res.status(500).json({ error: 'Falha ao buscar resumo financeiro' });
  }
});

app.put('/api/predictions/:id/proof', authenticate, upload.single('proof'), async (req: any, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Comprovante é obrigatório' });
    const proofPath = `/uploads/${req.file.filename}`;

    const { error } = await supabase
      .from('predictions')
      .update({ proof_path: proofPath, status: 'pending' })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, proofPath });
  } catch (err) {
    console.error('Update proof error:', err);
    res.status(500).json({ error: 'Erro ao enviar comprovante' });
  }
});

app.get('/api/my-notifications', authenticate, async (req: any, res) => {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('id, rounds(id, number, status, winners_names, winners_prize)')
      .eq('user_id', req.user.id)
      .eq('status', 'approved');

    if (error) {
      console.error('Supabase error in /api/my-notifications:', error);
      throw error;
    }

    const { data: historySetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_history').maybeSingle();
    let jackpotHistory: any[] = [];
    try {
      if (historySetting?.value) jackpotHistory = JSON.parse(historySetting.value);
    } catch (e) {}

    const notifications: any[] = [];
    const processedRounds = new Set();

    predictions?.forEach((p: any) => {
      if (p.rounds?.status === 'finished' && !processedRounds.has(p.rounds.id)) {
        processedRounds.add(p.rounds.id);
        
        const winners = p.rounds?.winners_names?.split(',').map((w: string) => w.trim()) || [];
        if (winners.includes(req.user.nickname) || winners.includes(req.user.name)) {
          const prize = (p.rounds?.winners_prize || 0) / winners.length;
          notifications.push({
            id: `win-main-${p.rounds.id}`,
            type: 'win_main',
            title: 'Parabéns! Você ganhou!',
            message: `Você foi um dos vencedores da Rodada ${p.rounds.number} e ganhou R$ ${prize.toFixed(2)}!`,
            roundId: p.rounds.id,
            amount: prize
          });
        }

        const roundJackpot = jackpotHistory.find(jh => jh.round_id == p.rounds?.id);
        if (roundJackpot) {
          const jackpotWinners = roundJackpot.winners_names?.split(',').map((w: string) => w.trim()) || [];
          if (jackpotWinners.includes(req.user.nickname) || jackpotWinners.includes(req.user.name)) {
            const prize = (roundJackpot.prize_paid || 0) / jackpotWinners.length;
            notifications.push({
              id: `win-jackpot-${p.rounds.id}`,
              type: 'win_jackpot',
              title: 'JACKPOT! Bônus 10!',
              message: `Você acertou todos os 10 jogos da Rodada ${p.rounds.number} e ganhou o Bônus de R$ ${prize.toFixed(2)}!`,
              roundId: p.rounds.id,
              amount: prize
            });
          }
        }
      }
    });

    res.json(notifications);
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ error: 'Falha ao buscar notificações' });
  }
});

app.post('/api/predictions', authenticate, upload.single('proof'), async (req: any, res) => {
  try {
    const { roundId, guesses } = req.body;
    
    if (!roundId || roundId === 'undefined' || !guesses) {
      return res.status(400).json({ error: 'Dados incompletos ou inválidos (roundId ou guesses ausentes)' });
    }

    const parsedGuesses = JSON.parse(guesses);
    const proofPath = req.file ? `/uploads/${req.file.filename}` : '';
    const rId = parseInt(roundId);

    if (isNaN(rId)) {
      return res.status(400).json({ error: 'ID da rodada inválido' });
    }

    // Check if round is open and deadline hasn't passed
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('status, start_time')
      .eq('id', rId)
      .single();

    if (roundErr || !round) {
      return res.status(404).json({ error: 'Rodada não encontrada' });
    }

    if (round.status !== 'open') {
      return res.status(400).json({ error: 'Esta rodada não está mais aberta para palpites' });
    }

    if (round.start_time && new Date() > new Date(round.start_time)) {
      return res.status(400).json({ error: 'O prazo para enviar palpites nesta rodada já encerrou' });
    }

    const guessesArray = Array.isArray(parsedGuesses) ? parsedGuesses : [parsedGuesses];
    const createdIds = [];

    for (const singleGuess of guessesArray) {
      // 1. Create prediction
      const { data: prediction, error: predErr } = await supabase
        .from('predictions')
        .insert([{ 
          user_id: req.user.id, 
          round_id: rId, 
          proof_path: proofPath,
          status: 'pending'
        }])
        .select()
        .single();

      if (predErr) {
        console.error('Supabase Prediction Insert Error:', predErr);
        throw new Error(`Erro ao criar palpite: ${predErr.message}`);
      }
      createdIds.push(prediction.id);

      // 2. Create items
      const items = Object.entries(singleGuess).map(([gameId, guess]) => ({
        prediction_id: prediction.id,
        game_id: parseInt(gameId),
        guess
      }));

      const { error: itemsErr } = await supabase.from('prediction_items').insert(items);
      if (itemsErr) {
        console.error('Supabase Items Insert Error:', itemsErr);
        throw new Error(`Erro ao criar itens do palpite: ${itemsErr.message}`);
      }
    }

    res.json({ success: true, ids: createdIds });
  } catch (err: any) {
    console.error('Prediction submission error:', err);
    res.status(500).json({ error: err.message || 'Falha ao enviar palpite' });
  }
});

app.post('/api/predictions/attach-proof', authenticate, upload.single('proof'), async (req: any, res) => {
  try {
    const { predictionIds } = req.body;
    if (!predictionIds || predictionIds === 'undefined' || predictionIds === '[]') {
      return res.status(400).json({ error: 'Nenhum palpite selecionado para anexar comprovante' });
    }
    
    const ids = JSON.parse(predictionIds);
    
    if (!req.file) return res.status(400).json({ error: 'Comprovante é obrigatório' });
    const proofPath = `/uploads/${req.file.filename}`;

    const { error } = await supabase
      .from('predictions')
      .update({ proof_path: proofPath, status: 'pending' })
      .in('id', ids)
      .eq('user_id', req.user.id);

    if (error) {
      console.error('Supabase Proof Update Error:', error);
      throw new Error(`Erro ao atualizar comprovante: ${error.message}`);
    }
    res.json({ success: true, proofPath });
  } catch (err: any) {
    console.error('Attach proof error:', err);
    res.status(500).json({ error: err.message || 'Erro ao enviar comprovante' });
  }
});

app.get('/api/rounds/:id/transparency', async (req, res) => {
  try {
    const { data: predictions, error } = await supabase
      .from('predictions')
      .select('*, users(name, nickname), prediction_items(*)')
      .eq('round_id', req.params.id)
      .eq('status', 'approved');

    if (error) throw error;

    const formatted = predictions?.map((p: any) => ({
      id: p.id,
      user_name: p.users.nickname || p.users.name,
      score: p.score,
      items: (p.prediction_items || []).sort((a: any, b: any) => a.game_id - b.game_id)
    }));

    res.json(formatted || []);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar transparência' });
  }
});

app.get('/api/rounds/:id/check-prediction', authenticate, async (req: any, res) => {
  try {
    if (req.user.role === 'admin') {
      return res.json({ hasPrediction: true });
    }

    const { data, error } = await supabase
      .from('predictions')
      .select('id')
      .eq('round_id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('status', 'approved')
      .maybeSingle();

    if (error) throw error;
    res.json({ hasPrediction: !!data });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar palpite' });
  }
});

// Admin: User Management
app.get('/api/admin/users', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, nickname, role, created_at, phone')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar usuários' });
  }
});

app.put('/api/admin/users/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, nickname, role, phone, password } = req.body;
    const updateData: any = { name, nickname, role, phone };
    if (password) {
      updateData.password = password; // Plain text as requested
    }
    const { error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao atualizar usuário' });
  }
});

app.delete('/api/admin/users/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao excluir usuário' });
  }
});

// Admin: Financial Details (Jackpot, Prizes, Withdrawals)
app.get('/api/admin/financial-details', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: jackpot } = await supabase.from('settings').select('value').eq('key', 'jackpot_pool').maybeSingle();
    const { data: prizes } = await supabase.from('settings').select('value').eq('key', 'prizes_history').maybeSingle();
    const { data: withdrawals } = await supabase.from('settings').select('value').eq('key', 'withdrawals_history').maybeSingle();

    res.json({
      jackpotPool: parseFloat(jackpot?.value || '0'),
      prizesHistory: prizes?.value ? JSON.parse(prizes.value) : [],
      withdrawalsHistory: withdrawals?.value ? JSON.parse(withdrawals.value) : []
    });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao carregar detalhes financeiros' });
  }
});

app.post('/api/admin/withdrawals', authenticate, isAdmin, async (req, res) => {
  const { amount, reason } = req.body;
  if (!amount || !reason) return res.status(400).json({ error: 'Valor e motivo são obrigatórios' });

  try {
    const { data: withdrawalsSetting } = await supabase.from('settings').select('value').eq('key', 'withdrawals_history').maybeSingle();
    let withdrawalsHistory = [];
    try {
      if (withdrawalsSetting?.value) withdrawalsHistory = JSON.parse(withdrawalsSetting.value);
    } catch (e) {}

    withdrawalsHistory.push({
      amount: parseFloat(amount),
      reason,
      date: new Date().toISOString()
    });

    await supabase.from('settings').upsert({ key: 'withdrawals_history', value: JSON.stringify(withdrawalsHistory) }, { onConflict: 'key' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao registrar saque' });
  }
});

// Admin: Financial Summary
app.get('/api/admin/notifications', authenticate, isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    if (error) throw error;
    res.json(data ? JSON.parse(data.value) : []);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao buscar notificações' });
  }
});

app.get('/api/admin/financial-summary', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'finished')
      .order('number', { ascending: false });

    const summary = await Promise.all((rounds || []).map(async (r: any) => {
      const { count } = await supabase
        .from('predictions')
        .select('*', { count: 'exact', head: true })
        .eq('round_id', r.id)
        .eq('status', 'approved');
      
      const totalCollection = r.total_collected !== null ? r.total_collected : (count || 0) * (r.entry_value || 10);
      const adminFee = r.admin_fee_collected !== null ? r.admin_fee_collected : totalCollection * 0.20;
      const winnersPool = r.winners_prize !== null ? r.winners_prize : totalCollection * 0.75;
      const jackpotContribution = r.jackpot_contribution !== null ? r.jackpot_contribution : totalCollection * 0.05;

      return {
        id: r.id,
        number: r.number,
        total_collected: totalCollection,
        admin_fee_collected: adminFee,
        winners_prize: winnersPool,
        jackpot_contribution: jackpotContribution,
        approved_count: count,
        winners_names: r.winners_names
      };
    }));

    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: 'Falha ao gerar resumo financeiro' });
  }
});

// Admin Routes
app.post('/api/admin/rounds', authenticate, isAdmin, async (req, res) => {
  const { number, startTime, games, entryValue } = req.body;
  
  try {
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .insert([{ 
        number, 
        start_time: startTime, 
        entry_value: entryValue || 10, 
        status: 'open' 
      }])
      .select()
      .single();

    if (roundErr) throw roundErr;

    const gameItems = games.map((g: any, index: number) => ({
      round_id: round.id,
      home_team: g.home,
      away_team: g.away,
      game_order: index
    }));

    const { error: gamesErr } = await supabase.from('games').insert(gameItems);
    if (gamesErr) throw gamesErr;

    res.json({ success: true, roundId: round.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create round' });
  }
});

app.get('/api/admin/pending-predictions', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: predictions } = await supabase
      .from('predictions')
      .select(`
        *,
        users (name, email, nickname, phone),
        rounds (number, games(*)),
        prediction_items (*)
      `)
      .eq('status', 'pending');

    const formatted = predictions?.map((p: any) => ({
      ...p,
      user_name: p.users.name,
      user_nickname: p.users.nickname,
      user_email: p.users.email,
      user_phone: p.users.phone,
      round_number: p.rounds.number,
      games: p.rounds.games?.sort((a: any, b: any) => a.game_order - b.game_order) || [],
      items: p.prediction_items || []
    }));

    res.json(formatted || []);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch pending' });
  }
});

app.post('/api/admin/predictions/:id/validate', authenticate, isAdmin, async (req, res) => {
  const { status } = req.body;
  const { error } = await supabase
    .from('predictions')
    .update({ status })
    .eq('id', req.params.id);
  
  if (error) return res.status(500).json({ error: 'Validation failed' });
  res.json({ success: true });
});

app.post('/api/admin/rounds/:id/finish', authenticate, isAdmin, async (req, res) => {
  const { results, distributeJackpot } = req.body;
  
  try {
    // 1. Get round info
    const { data: round } = await supabase.from('rounds').select('*').eq('id', req.params.id).single();
    const entryValue = round?.entry_value || 10;

    // 2. Update game results
    for (const gameId in results) {
      await supabase.from('games').update({ result: results[gameId] }).eq('id', gameId);
    }

    // 3. Calculate scores
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id, user_id, users(name, nickname)')
      .eq('round_id', req.params.id)
      .eq('status', 'approved');

    if (predictions) {
      for (const p of predictions) {
        const { data: items } = await supabase.from('prediction_items').select('game_id, guess').eq('prediction_id', p.id);
        let score = 0;
        items?.forEach((item: any) => {
          if (results[item.game_id] === item.guess) score++;
        });
        await supabase.from('predictions').update({ score }).eq('id', p.id);
      }
    }

    // 4. Calculate prizes
    const { count: approvedCount } = await supabase
      .from('predictions')
      .select('*', { count: 'exact', head: true })
      .eq('round_id', req.params.id)
      .eq('status', 'approved');

    const totalCollection = (approvedCount || 0) * entryValue;
    let winnersPool = totalCollection * 0.75;
    const adminFee = totalCollection * 0.20;
    const jackpotContribution = totalCollection * 0.05;

    const { data: jackpotSetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_pool').single();
    let newJackpot = parseFloat(jackpotSetting?.value || '0') + jackpotContribution;

    // Find winners (highest score)
    const { data: scoredPredictions } = await supabase
      .from('predictions')
      .select('score, users(name, nickname)')
      .eq('round_id', req.params.id)
      .eq('status', 'approved')
      .order('score', { ascending: false });

    const maxScore = scoredPredictions?.[0]?.score || 0;
    const winners = scoredPredictions?.filter(p => p.score === maxScore).map(p => {
      const u = Array.isArray(p.users) ? p.users[0] : p.users;
      return u?.nickname || u?.name;
    }) || [];
    
    // Check if anyone got 10/10 for jackpot, or if admin forced jackpot distribution
    const tenCorrect = distributeJackpot 
      ? scoredPredictions?.filter(p => p.score === maxScore) || []
      : scoredPredictions?.filter(p => p.score === 10) || [];

    let jackpotWinnerNames = null;
    let jackpotPrizePaid = 0;
    const jackpotValue = parseFloat(jackpotSetting?.value || '0') + jackpotContribution;

    if (tenCorrect && tenCorrect.length > 0) {
      jackpotWinnerNames = tenCorrect.map(p => {
        const u = Array.isArray(p.users) ? p.users[0] : p.users;
        return u?.nickname || u?.name;
      }).join(', ');
      jackpotPrizePaid = jackpotValue;
      winnersPool += jackpotValue; // Add accumulated bonus to the prize
      newJackpot = 0; // Start a new bonus count
    }

    await supabase.from('settings').update({ value: newJackpot.toString() }).eq('key', 'jackpot_pool');
    
    // Update round with financial results
    const { error: updateErr } = await supabase.from('rounds').update({ 
      status: 'finished', 
      jackpot_contribution: jackpotContribution,
      total_collected: totalCollection,
      winners_prize: winnersPool,
      admin_fee_collected: adminFee,
      winners_names: winners.join(', ')
    }).eq('id', req.params.id);

    if (updateErr) {
      console.error('Error updating round status:', updateErr);
      throw updateErr;
    }

    // Record prizes in history
    if (winners.length > 0) {
      const { data: prizesSetting } = await supabase.from('settings').select('value').eq('key', 'prizes_history').maybeSingle();
      let prizesHistory = [];
      try {
        if (prizesSetting?.value) prizesHistory = JSON.parse(prizesSetting.value);
      } catch (e) {}
      
      const prizePerWinner = winnersPool / winners.length;
      winners.forEach(name => {
        prizesHistory.push({
          round_id: req.params.id,
          round_number: round.number,
          winner_name: name,
          amount: prizePerWinner,
          date: new Date().toISOString(),
          type: 'round_winner'
        });
      });
      
      await supabase.from('settings').upsert({ key: 'prizes_history', value: JSON.stringify(prizesHistory) }, { onConflict: 'key' });
    }

    if (jackpotWinnerNames) {
      const { data: historySetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_history').maybeSingle();
      let history = [];
      try {
        if (historySetting?.value) history = JSON.parse(historySetting.value);
      } catch (e) {}
      history.push({
        round_id: req.params.id,
        winners_names: jackpotWinnerNames,
        prize_paid: jackpotPrizePaid
      });
      
      const { error: upsertErr } = await supabase.from('settings').upsert({ key: 'jackpot_history', value: JSON.stringify(history) }, { onConflict: 'key' });
      if (upsertErr) console.error('Error saving jackpot history:', upsertErr);
    }

    res.json({ success: true, summary: { winnersPool, adminFee, jackpotContribution, winners, jackpotWinnerNames, jackpotPrizePaid } });
  } catch (err) {
    console.error('Finish round error:', err);
    res.status(500).json({ error: 'Failed to finish round' });
  }
});

// Handle 404 for API routes to prevent falling through to SPA fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
