import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import * as bcrypt from 'bcryptjs';
import cors from 'cors';
import dotenv from 'dotenv';
import { supabase } from './src/supabase.ts';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'bolao10-secret-key-2024';

import webpush from 'web-push';

// WebSocket Server
const wss = new WebSocketServer({ server: httpServer });
const clients = new Map<string, WebSocket>();

// Web Push Configuration
const vapidPublicKey = process.env.VITE_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
let vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@bolao10.com';

// Ensure vapidEmail is a valid URL (mailto: for emails)
if (vapidEmail && !vapidEmail.startsWith('http') && !vapidEmail.startsWith('mailto:')) {
  vapidEmail = `mailto:${vapidEmail}`;
}

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

const sendPushNotification = async (userId: string, payload: any) => {
  try {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', userId);

    if (subs && subs.length > 0) {
      const results = await Promise.allSettled(
        subs.map(s => webpush.sendNotification(s.subscription, JSON.stringify(payload)))
      );
      
      // Clean up failed subscriptions
      const failedIndices = results
        .map((r, i) => r.status === 'rejected' && (r as any).reason?.statusCode === 410 ? i : -1)
        .filter(i => i !== -1);

      if (failedIndices.length > 0) {
        const failedSubs = failedIndices.map(i => subs[i].subscription);
        for (const sub of failedSubs) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('subscription', sub);
        }
      }
    }
  } catch (err) {
    console.error('Error sending push notification:', err);
  }
};

const sendRealtimeNotification = (userId: string | 'all', notification: any) => {
  const payload = JSON.stringify(notification);
  if (userId === 'all') {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } else {
    const client = clients.get(userId.toString());
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
};

const generateReferralCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

const addAdminNotification = async (notification: any) => {
  try {
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    let notifications = [];
    if (setting?.value) {
      try {
        notifications = JSON.parse(setting.value);
      } catch (e) {
        notifications = [];
      }
    }

    notifications.unshift({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString(),
      ...notification
    });

    // Keep only last 100 notifications
    if (notifications.length > 100) notifications = notifications.slice(0, 100);

    await supabase.from('settings').upsert({ 
      key: 'admin_notifications', 
      value: JSON.stringify(notifications) 
    }, { onConflict: 'key' });

    // Broadcast to all admins
    const { data: adminUsers } = await supabase.from('users').select('id').eq('role', 'admin');
    if (adminUsers) {
      adminUsers.forEach(admin => {
        sendRealtimeNotification(admin.id, {
          type: 'notification',
          data: {
            ...notification,
            id: `admin-notif-${Date.now()}`,
            created_at: new Date().toISOString()
          }
        });
      });
    }
  } catch (err) {
    console.error('Error adding admin notification:', err);
  }
};

wss.on('connection', (ws, req) => {
  let userId: string | null = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'auth' && data.token) {
        const decoded = jwt.verify(data.token, JWT_SECRET) as any;
        userId = decoded.id.toString();
        clients.set(userId, ws);
        console.log(`User ${userId} connected via WebSocket`);
      }
    } catch (err) {
      console.error('WS Auth error:', err);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
      console.log(`User ${userId} disconnected from WebSocket`);
    }
  });
});

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
  const { email, password, name, nickname, phone, referralCode } = req.body;
  try {
    // Check if phone already exists (antifraude)
    const { data: existingPhone } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
    if (existingPhone) {
      return res.status(400).json({ error: 'Este número de telefone já está cadastrado em outra conta.' });
    }

    let referredById = null;
    if (referralCode) {
      const { data: referrer } = await supabase.from('users').select('id').ilike('referral_code', referralCode.trim()).maybeSingle();
      if (referrer) {
        referredById = referrer.id;
      }
    }

    const myReferralCode = generateReferralCode();

    // Storing password in plain text as requested to allow admin to view it
    const { data, error } = await supabase
      .from('users')
      .insert([{ 
        email, 
        password, 
        name, 
        nickname, 
        phone, 
        referral_code: myReferralCode,
        referred_by: referredById,
        phone_validated: true
      }])
      .select()
      .single();

    if (error) throw error;

    // Create wallet for user
    await supabase.from('wallets').insert([{ user_id: data.id, balance: 0 }]);

    // If referred, create referral record
    if (referredById) {
      await supabase.from('referrals').insert([{
        referrer_id: referredById,
        referred_id: data.id,
        bonus_amount: 2.00,
        bonus_paid: false
      }]);
    }

    const token = jwt.sign({ 
      id: data.id, 
      email: data.email, 
      role: data.role, 
      name: data.name, 
      nickname: data.nickname, 
      phone: data.phone,
      referral_code: data.referral_code,
      phone_validated: data.phone_validated
    }, JWT_SECRET);
    
    res.json({ 
      token, 
      user: { 
        id: data.id, 
        email: data.email, 
        name: data.name, 
        role: data.role, 
        nickname: data.nickname, 
        phone: data.phone,
        referral_code: data.referral_code,
        phone_validated: data.phone_validated
      } 
    });
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

app.post('/api/push-subscriptions', authenticate, async (req: any, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ error: 'Subscription is required' });

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({ user_id: req.user.id, subscription }, { onConflict: 'user_id, subscription' });

    if (error) throw error;
    res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('Error saving push subscription:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
    if (error || !user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Notify admin via a notification in settings
    await addAdminNotification({
      type: 'forgot_password',
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      user_phone: user.phone,
      message: `O usuário ${user.name} (@${user.nickname}) solicitou recuperação de senha.`
    });

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

    const { data: depositsData, error: depositsError } = await supabase
      .from('deposits')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('status', 'pending');

    if (depositsError) {
      console.error('Supabase error fetching deposits:', depositsError);
    }

    // Get user's wallet ID
    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', req.user.id).single();

    let pendingWithdrawals: any[] = [];
    if (wallet) {
      const { data: withdrawalsData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', wallet.id)
        .eq('type', 'withdrawal')
        .like('reference_id', 'pending_%');
      
      pendingWithdrawals = withdrawalsData || [];
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
    const pendingDeposits = depositsData || [];
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

    const { data: jackpotSetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_pool').maybeSingle();
    const jackpotPool = parseFloat(jackpotSetting?.value || '0');

    res.json({ totalSpent, predictionsMade, totalWinnings, pendingPredictions, pendingDeposits, pendingWithdrawals, jackpotPool });
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

    const { data: adminNotificationsSetting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    let adminNotifications: any[] = [];
    try {
      if (adminNotificationsSetting?.value) adminNotifications = JSON.parse(adminNotificationsSetting.value);
    } catch (e) {}

    const notifications: any[] = [];
    
    // Add manual admin notifications
    adminNotifications.forEach((msg: any) => {
      if (msg.target_type === 'all' || (msg.target_type === 'individual' && msg.user_id === req.user.id)) {
        notifications.push({
          id: msg.id,
          type: 'admin_msg',
          title: msg.title,
          message: msg.message,
          msgType: msg.type, // info, warning, success, alert
          createdAt: msg.created_at
        });
      }
    });

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
    const rId = parseInt(roundId);

    if (isNaN(rId)) {
      return res.status(400).json({ error: 'ID da rodada inválido' });
    }

    // Check if round is open and deadline hasn't passed
    const { data: round, error: roundErr } = await supabase
      .from('rounds')
      .select('status, start_time, entry_value, number')
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
    const totalCost = guessesArray.length * (round.entry_value || 10);

    // Fetch user wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('user_id', req.user.id)
      .single();

    if (walletErr || !wallet) {
      return res.status(400).json({ error: 'Carteira não encontrada.' });
    }

    if (wallet.balance < totalCost) {
      return res.status(400).json({ error: 'Saldo insuficiente na carteira.' });
    }

    // Deduct balance
    const newBalance = wallet.balance - totalCost;
    const { error: updateWalletErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id);

    if (updateWalletErr) {
      return res.status(500).json({ error: 'Erro ao atualizar saldo da carteira.' });
    }

    // Record transaction
    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      amount: -totalCost,
      type: 'bet_deduction',
      description: `Pagamento de palpites para rodada #${round.number || rId}`
    });

    // Insert predictions
    const predictionIds = [];
    for (const singleGuess of guessesArray) {
      const { data: predData, error: predErr } = await supabase
        .from('predictions')
        .insert({
          user_id: req.user.id,
          round_id: rId,
          status: 'approved',
          proof_path: 'wallet_payment'
        })
        .select('id')
        .single();

      if (predErr || !predData) {
        console.error('Error creating prediction:', predErr);
        continue;
      }

      predictionIds.push(predData.id);

      // Insert items
      const itemsToInsert = Object.entries(singleGuess).map(([gameId, guess]) => ({
        prediction_id: predData.id,
        game_id: parseInt(gameId),
        guess
      }));

      await supabase.from('prediction_items').insert(itemsToInsert);
    }

    res.json({ success: true, ids: predictionIds, newBalance });

    // Broadcast real-time notification
    sendRealtimeNotification('all', {
      type: 'notification',
      data: {
        id: `pred-${Date.now()}`,
        type: 'admin_msg', // For UI consistency
        msgType: 'info',
        title: '⚽ Novo Palpite!',
        message: `${req.user.name} (@${req.user.nickname}) acabou de enviar um palpite!`,
        created_at: new Date().toISOString()
      }
    });
  } catch (err: any) {
    console.error('Prediction submission error:', err);
    res.status(500).json({ error: err.message || 'Falha ao enviar palpite' });
  }
});

// --- NEW WALLET ENDPOINTS ---

app.get('/api/wallet/balance', authenticate, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', req.user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
    
    res.json({ balance: data?.balance || 0 });
  } catch (err) {
    console.error('Wallet balance error:', err);
    res.status(500).json({ error: 'Erro ao buscar saldo' });
  }
});

app.get('/api/wallet/transactions', authenticate, async (req: any, res) => {
  try {
    const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', req.user.id).single();
    if (!wallet) return res.json([]);

    const { data, error } = await supabase
      .from('wallet_transactions')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Wallet transactions error:', err);
    res.status(500).json({ error: 'Erro ao buscar extrato' });
  }
});

app.post('/api/wallet/withdraw', authenticate, async (req: any, res) => {
  const { amount, pixKey } = req.body;
  const withdrawAmount = parseFloat(amount);

  if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
    return res.status(400).json({ error: 'Valor inválido para saque' });
  }

  if (!pixKey || pixKey.trim() === '') {
    return res.status(400).json({ error: 'Chave PIX é obrigatória' });
  }

  try {
    // 1. Get user's wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', req.user.id)
      .single();

    if (walletErr || !wallet) {
      return res.status(400).json({ error: 'Carteira não encontrada' });
    }

    // 2. Check balance
    if (wallet.balance < withdrawAmount) {
      return res.status(400).json({ error: 'Saldo insuficiente' });
    }

    // 3. Deduct from wallet
    const newBalance = wallet.balance - withdrawAmount;
    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateErr) throw updateErr;

    // 4. Record transaction as pending withdrawal
    const { error: transErr } = await supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: wallet.id,
        amount: -withdrawAmount,
        type: 'withdrawal',
        balance_after: newBalance,
        reference_id: `pending_${pixKey}`,
        description: `Pedido de Saque (PIX: ${pixKey})`
      }]);

    if (transErr) throw transErr;

    // 5. Notify Admins
    await addAdminNotification({
      type: 'withdrawal_request',
      user_id: req.user.id,
      user_name: req.user.name,
      user_nickname: req.user.nickname,
      user_email: req.user.email,
      user_phone: req.user.phone,
      amount: withdrawAmount,
      pix_key: pixKey,
      title: '💸 Novo Pedido de Saque',
      msgType: 'warning',
      message: `${req.user.name} solicitou um saque de R$ ${withdrawAmount.toFixed(2)}.`
    });

    res.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Withdrawal error:', JSON.stringify(err, null, 2));
    res.status(500).json({ error: 'Erro ao solicitar saque' });
  }
});

// PagBank Integration
const PAGBANK_TOKEN = process.env.PAGBANK_TOKEN;
const PAGBANK_EMAIL = process.env.PAGBANK_EMAIL;
const PAGBANK_API_HOST = process.env.PAGBANK_API_HOST || 'https://api.pagseguro.com';

app.post('/api/pagbank/create-payment', authenticate, async (req: any, res) => {
  try {
    if (!PAGBANK_TOKEN) {
      throw new Error('Configuração do PagBank ausente (Token não encontrado). Verifique as variáveis de ambiente.');
    }

    const { amount, method, cardHash } = req.body;
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Valor inválido' });
    }

    // 1. Create record in deposits table
    const { data: deposit, error: depErr } = await supabase
      .from('deposits')
      .insert([{
        user_id: req.user.id,
        amount: depositAmount,
        status: 'pending',
        payment_method: method // pix or credit_card
      }])
      .select()
      .single();

    if (depErr) throw depErr;

    // 2. Prepare PagBank Request
    const appUrl = process.env.APP_URL || `https://${req.get('host')}`;
    const orderData: any = {
      reference_id: `DEP-${deposit.id}`,
      customer: {
        name: req.user.name,
        email: req.user.email,
        tax_id: '12345678909', // Dummy CPF for example, should be collected from user
        phones: [{ country: '55', area: '21', number: '999999999', type: 'MOBILE' }]
      },
      items: [{
        name: 'Depósito Bolão10',
        quantity: 1,
        unit_amount: Math.round(depositAmount * 100)
      }],
      notification_urls: [`${appUrl}/api/pagbank/webhook`]
    };

    if (method === 'pix') {
      orderData.qr_codes = [{ amount: { value: Math.round(depositAmount * 100) } }];
    } else if (method === 'credit_card' && cardHash) {
      orderData.charges = [{
        reference_id: `CHG-${deposit.id}`,
        description: 'Depósito Bolão10',
        amount: { value: Math.round(depositAmount * 100), currency: 'BRL' },
        payment_method: {
          type: 'CREDIT_CARD',
          installments: 1,
          capture: true,
          card: { encrypted: cardHash }
        }
      }];
    }

    const pbRes = await fetch(`${PAGBANK_API_HOST}/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAGBANK_TOKEN}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    const pbData = await pbRes.json();
    if (!pbRes.ok) {
      console.error('PagBank API Error Details:', JSON.stringify(pbData, null, 2));
      const errorMsg = pbData.error_messages?.[0]?.description || 'Erro na comunicação com PagBank';
      throw new Error(errorMsg);
    }

    // 3. Update deposit with PagBank ID
    await supabase
      .from('deposits')
      .update({ pagbank_id: pbData.id })
      .eq('id', deposit.id);

    // 4. Return necessary data to frontend
    if (method === 'pix') {
      const qrCode = pbData.qr_codes[0];
      res.json({
        success: true,
        depositId: deposit.id,
        pix: {
          qrcode: qrCode.links.find((l: any) => l.rel === 'QRCODE.PNG')?.href,
          text: qrCode.text
        }
      });
    } else {
      res.json({
        success: true,
        depositId: deposit.id,
        status: pbData.charges?.[0]?.status
      });
    }

  } catch (err: any) {
    console.error('Create PagBank payment error:', err.message || err);
    res.status(500).json({ error: err.message || 'Erro interno ao processar pagamento' });
  }
});

app.post('/api/pagbank/webhook', async (req, res) => {
  try {
    const notification = req.body;
    // Basic security: check if it's a valid PagBank notification structure
    if (!notification.id || !notification.reference_id) {
      return res.status(400).send('Invalid notification');
    }

    const pagbankId = notification.id;
    const status = notification.status; // PAID, DECLINED, etc.

    if (status === 'PAID') {
      // 1. Find deposit
      const { data: deposit, error: depErr } = await supabase
        .from('deposits')
        .select('*')
        .eq('pagbank_id', pagbankId)
        .single();

      if (depErr || !deposit) {
        console.error('Deposit not found for PagBank ID:', pagbankId);
        return res.status(404).send('Deposit not found');
      }

      if (deposit.status === 'approved') {
        return res.json({ success: true, message: 'Already processed' });
      }

      // 2. Update deposit status
      await supabase
        .from('deposits')
        .update({ status: 'approved' })
        .eq('id', deposit.id);

      // 3. Update wallet balance
      const { data: wallet } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', deposit.user_id)
        .single();

      if (wallet) {
        const newBalance = parseFloat(wallet.balance) + parseFloat(deposit.amount);
        await supabase
          .from('wallets')
          .update({ balance: newBalance })
          .eq('user_id', deposit.user_id);

        // 4. Record transaction
        await supabase.from('transactions').insert([{
          user_id: deposit.user_id,
          wallet_id: deposit.user_id, // Assuming wallet_id is user_id
          type: 'deposit',
          amount: deposit.amount,
          description: `Depósito via PagBank (${deposit.payment_method})`,
          status: 'completed'
        }]);

        // 5. Notify user
        sendRealtimeNotification(deposit.user_id, {
          id: `dep-paid-${deposit.id}`,
          type: 'deposit_confirmed',
          title: '✅ Depósito Confirmado',
          message: `Seu depósito de R$ ${parseFloat(deposit.amount).toFixed(2)} foi confirmado via PagBank!`,
          amount: deposit.amount
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('PagBank Webhook error:', err);
    res.status(500).send('Internal Error');
  }
});

app.post('/api/wallet/deposit/initiate', authenticate, async (req: any, res) => {
  try {
    const { amount } = req.body;
    const depositAmount = parseFloat(amount);

    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Valor de depósito inválido' });
    }

    const { data, error } = await supabase
      .from('deposits')
      .insert([{
        user_id: req.user.id,
        amount: depositAmount,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;

    // Notify Admins
    await addAdminNotification({
      id: `dep-req-${data.id}`,
      type: 'deposit_request',
      user_id: req.user.id,
      user_name: req.user.name,
      user_nickname: req.user.nickname,
      user_email: req.user.email,
      user_phone: req.user.phone,
      amount: depositAmount,
      title: '💰 Novo Depósito Iniciado',
      msgType: 'info',
      message: `${req.user.name} iniciou um depósito de R$ ${depositAmount.toFixed(2)}. Aguardando comprovante.`
    });

    res.json({ success: true, deposit: data });
  } catch (err: any) {
    console.error('Deposit initiation error:', err);
    res.status(500).json({ error: err.message || 'Erro ao iniciar depósito' });
  }
});

app.post('/api/wallet/deposit/update-amount', authenticate, async (req: any, res) => {
  try {
    const { depositId, amount } = req.body;
    const depositAmount = parseFloat(amount);

    if (!depositId) return res.status(400).json({ error: 'ID do depósito é obrigatório' });
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: 'Valor de depósito inválido' });
    }

    const { error } = await supabase
      .from('deposits')
      .update({ amount: depositAmount })
      .eq('id', depositId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    // Update Admin Notification
    await addAdminNotification({
      id: `dep-upd-${depositId}`,
      type: 'deposit_update',
      user_id: req.user.id,
      user_name: req.user.name,
      user_nickname: req.user.nickname,
      user_email: req.user.email,
      user_phone: req.user.phone,
      amount: depositAmount,
      title: '💰 Valor de Depósito Atualizado',
      msgType: 'info',
      message: `${req.user.name} alterou o valor do depósito #${depositId} para R$ ${depositAmount.toFixed(2)}.`
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Deposit update error:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar valor do depósito' });
  }
});

app.post('/api/wallet/deposit/attach-proof', authenticate, upload.single('proof'), async (req: any, res) => {
  try {
    const { depositId } = req.body;
    if (!depositId) return res.status(400).json({ error: 'ID do depósito é obrigatório' });
    if (!req.file) return res.status(400).json({ error: 'Comprovante é obrigatório' });

    const proofPath = `/uploads/${req.file.filename}`;

    const { error } = await supabase
      .from('deposits')
      .update({ proof_url: proofPath })
      .eq('id', depositId)
      .eq('user_id', req.user.id);

    if (error) throw error;

    // Update Admin Notification
    await addAdminNotification({
      id: `dep-proof-${depositId}`,
      type: 'deposit_proof',
      user_id: req.user.id,
      user_name: req.user.name,
      user_nickname: req.user.nickname,
      user_email: req.user.email,
      user_phone: req.user.phone,
      title: '📄 Comprovante Enviado',
      msgType: 'info',
      message: `${req.user.name} enviou o comprovante para o depósito #${depositId}.`
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error('Attach proof error:', err);
    res.status(500).json({ error: err.message || 'Erro ao anexar comprovante' });
  }
});

// Admin endpoint to get pending deposits
app.get('/api/admin/deposits', authenticate, isAdmin, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('deposits')
      .select(`
        id,
        amount,
        proof_url,
        status,
        created_at,
        users:user_id (
          name,
          nickname,
          email,
          phone
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formattedData = data.map(d => {
      const user = Array.isArray(d.users) ? d.users[0] : d.users;
      return {
        id: d.id,
        amount: d.amount,
        proof_url: d.proof_url,
        status: d.status,
        created_at: d.created_at,
        user_name: user?.name,
        user_nickname: user?.nickname,
        user_email: user?.email,
        user_phone: user?.phone
      };
    });

    res.json(formattedData);
  } catch (err: any) {
    console.error('Fetch deposits error:', err);
    res.status(500).json({ error: err.message || 'Erro ao buscar depósitos' });
  }
});

// Admin endpoint to approve or reject deposit
app.post('/api/admin/deposits/:id/approve', authenticate, isAdmin, async (req: any, res) => {
  try {
    const depositId = req.params.id;
    const { status } = req.body; // 'approved' or 'rejected'

    if (status !== 'approved' && status !== 'rejected') {
      return res.status(400).json({ error: 'Status inválido' });
    }

    const { data: deposit, error: depErr } = await supabase
      .from('deposits')
      .select('*')
      .eq('id', depositId)
      .single();

    if (depErr || !deposit) return res.status(404).json({ error: 'Depósito não encontrado' });
    if (deposit.status !== 'pending') return res.status(400).json({ error: 'Depósito já processado' });

    if (status === 'approved') {
      // Get wallet
      const { data: wallet, error: walErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', deposit.user_id)
        .single();

      if (walErr || !wallet) return res.status(404).json({ error: 'Carteira não encontrada' });

      const newBalance = parseFloat(wallet.balance) + parseFloat(deposit.amount);

      // 1. Update Wallet
      const { error: updateWalErr } = await supabase
        .from('wallets')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', wallet.id);

      if (updateWalErr) throw updateWalErr;

      // 2. Insert Transaction
      await supabase.from('wallet_transactions').insert([{
        wallet_id: wallet.id,
        amount: deposit.amount,
        type: 'deposit',
        balance_after: newBalance,
        reference_id: deposit.id,
        description: 'Depósito via PIX aprovado'
      }]);

      // 2.1 Check for Referral Bonus
      try {
        const amount = parseFloat(deposit.amount);
        if (amount >= 10) {
          // Check if user was referred and bonus is unpaid
          const { data: referral } = await supabase
            .from('referrals')
            .select('*')
            .eq('referred_id', deposit.user_id)
            .eq('bonus_paid', false)
            .maybeSingle();

          if (referral) {
            const referrerId = referral.referrer_id;
            
            // Get referrer's wallet
            const { data: referrerWallet } = await supabase
              .from('wallets')
              .select('*')
              .eq('user_id', referrerId)
              .single();

            if (referrerWallet) {
              const bonusAmount = parseFloat(referral.bonus_amount || '2.00');
              const referrerNewBalance = parseFloat(referrerWallet.balance) + bonusAmount;

              // Update referrer's wallet
              await supabase
                .from('wallets')
                .update({ balance: referrerNewBalance, updated_at: new Date().toISOString() })
                .eq('id', referrerWallet.id);

              // Insert transaction for referrer
              await supabase.from('wallet_transactions').insert([{
                wallet_id: referrerWallet.id,
                amount: bonusAmount,
                type: 'prize_credit',
                balance_after: referrerNewBalance,
                reference_id: referral.id,
                description: `Bônus por indicação de amigo (${deposit.user_id})`
              }]);

              // Mark referral as paid
              await supabase
                .from('referrals')
                .update({ bonus_paid: true, updated_at: new Date().toISOString() })
                .eq('id', referral.id);

              // Notify referrer
              const { data: settingRef } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
              let refNotifications = [];
              if (settingRef?.value) {
                try {
                  refNotifications = JSON.parse(settingRef.value);
                } catch (e) {
                  refNotifications = [];
                }
              }

              const refNotification = {
                id: `ref-bon-${Date.now()}`,
                title: '🎁 Bônus de Indicação!',
                message: `Você recebeu R$ ${bonusAmount.toFixed(2)} de bônus porque seu amigo fez o primeiro depósito!`,
                type: 'success',
                target_type: 'individual',
                user_id: referrerId,
                created_at: new Date().toISOString()
              };

              refNotifications.unshift(refNotification);
              if (refNotifications.length > 100) refNotifications = refNotifications.slice(0, 100);

              await supabase
                .from('settings')
                .upsert({ key: 'admin_notifications', value: JSON.stringify(refNotifications) }, { onConflict: 'key' });

              sendRealtimeNotification(referrerId, {
                type: 'notification',
                data: refNotification
              });
            }
          }
        }
      } catch (err) {
        console.error('Error processing referral bonus:', err);
      }

      // 3. Send Notification
      const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
      let notifications = [];
      if (setting?.value) {
        try {
          notifications = JSON.parse(setting.value);
        } catch (e) {
          notifications = [];
        }
      }

      const newNotification = {
        id: `dep-app-${Date.now()}`,
        title: '💰 Depósito Aprovado!',
        message: `Seu depósito de R$ ${parseFloat(deposit.amount).toFixed(2)} foi aprovado e creditado na sua carteira.`,
        type: 'success',
        target_type: 'individual',
        user_id: deposit.user_id,
        created_at: new Date().toISOString(),
        sender_id: req.user.id
      };

      notifications.unshift(newNotification);
      if (notifications.length > 100) notifications = notifications.slice(0, 100);

      await supabase
        .from('settings')
        .upsert({ key: 'admin_notifications', value: JSON.stringify(notifications) }, { onConflict: 'key' });

      sendRealtimeNotification(deposit.user_id, {
        type: 'notification',
        data: {
          ...newNotification,
          type: 'admin_msg',
          msgType: 'success',
          createdAt: newNotification.created_at
        }
      });
    } else if (status === 'rejected') {
      // Send Notification for rejection
      const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
      let notifications = [];
      if (setting?.value) {
        try {
          notifications = JSON.parse(setting.value);
        } catch (e) {
          notifications = [];
        }
      }

      const newNotification = {
        id: `dep-rej-${Date.now()}`,
        title: '❌ Depósito Rejeitado',
        message: `Seu depósito de R$ ${parseFloat(deposit.amount).toFixed(2)} foi rejeitado. Verifique o comprovante e tente novamente.`,
        type: 'error',
        target_type: 'individual',
        user_id: deposit.user_id,
        created_at: new Date().toISOString(),
        sender_id: req.user.id
      };

      notifications.unshift(newNotification);
      if (notifications.length > 100) notifications = notifications.slice(0, 100);

      await supabase
        .from('settings')
        .upsert({ key: 'admin_notifications', value: JSON.stringify(notifications) }, { onConflict: 'key' });

      sendRealtimeNotification(deposit.user_id, {
        type: 'notification',
        data: {
          ...newNotification,
          type: 'admin_msg',
          msgType: 'error',
          createdAt: newNotification.created_at
        }
      });
    }

    // 4. Update Deposit Status
    await supabase
      .from('deposits')
      .update({ status: status, approved_by: req.user.id, updated_at: new Date().toISOString() })
      .eq('id', deposit.id);

    res.json({ success: true });
  } catch (err: any) {
    console.error('Approve deposit error:', err);
    res.status(500).json({ error: err.message || 'Erro ao processar depósito' });
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

app.post('/api/admin/send-notification', authenticate, isAdmin, async (req: any, res) => {
  try {
    const { title, message, type, target_type, user_id } = req.body;
    
    if (!title || !message) {
      return res.status(400).json({ error: 'Título e mensagem são obrigatórios' });
    }

    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    let notifications = [];
    if (setting?.value) {
      try {
        notifications = JSON.parse(setting.value);
      } catch (e) {
        notifications = [];
      }
    }

    const newNotification = {
      id: `admin-msg-${Date.now()}`,
      title,
      message,
      type: type || 'info',
      target_type: target_type || 'all',
      user_id: target_type === 'individual' ? user_id : null,
      created_at: new Date().toISOString(),
      sender_id: req.user.id
    };

    notifications.unshift(newNotification); // Newest first
    
    // Keep only last 100 notifications to avoid hitting Supabase cell limit
    if (notifications.length > 100) notifications = notifications.slice(0, 100);

    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'admin_notifications', value: JSON.stringify(notifications) }, { onConflict: 'key' });

    if (error) throw error;

    // Send real-time notification
    sendRealtimeNotification(target_type === 'all' ? 'all' : user_id, {
      type: 'notification',
      data: {
        ...newNotification,
        type: 'admin_msg', // For frontend compatibility
        msgType: type || 'info'
      }
    });

    res.json({ success: true, notification: newNotification });
  } catch (err: any) {
    console.error('Send notification error:', err);
    res.status(500).json({ error: 'Erro ao enviar notificação' });
  }
});

app.get('/api/admin/notifications', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    let notifications = [];
    if (setting?.value) {
      try {
        notifications = JSON.parse(setting.value);
      } catch (e) {
        notifications = [];
      }
    }
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

app.delete('/api/admin/notifications/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'admin_notifications').maybeSingle();
    
    if (setting?.value) {
      let notifications = JSON.parse(setting.value);
      notifications = notifications.filter((n: any) => n.id !== id);
      
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'admin_notifications', value: JSON.stringify(notifications) }, { onConflict: 'key' });
        
      if (error) throw error;
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao excluir notificação' });
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
      .limit(1);

    if (error) throw error;
    res.json({ hasPrediction: data && data.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar palpite' });
  }
});

// Admin: User Wallets Detailed
app.get('/api/admin/user-wallets', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: users, error: usersErr } = await supabase.from('users').select('id, name, email, nickname');
    if (usersErr) throw usersErr;

    const { data: wallets, error: walletsErr } = await supabase.from('wallets').select('id, user_id, balance');
    if (walletsErr) throw walletsErr;

    const { data: transactions, error: transErr } = await supabase.from('wallet_transactions').select('*');
    if (transErr) throw transErr;

    const { data: deposits, error: depErr } = await supabase.from('deposits').select('*').order('created_at', { ascending: false });
    if (depErr) throw depErr;

    const userWallets = users.map(user => {
      const wallet = wallets?.find(w => w.user_id === user.id);
      const userTransactions = wallet ? (transactions || []).filter(t => t.wallet_id === wallet.id) : [];
      const userDeposits = (deposits || []).filter(d => d.user_id === user.id);

      const totalDeposited = userTransactions.filter(t => t.type === 'deposit').reduce((sum, t) => sum + t.amount, 0);
      const totalWinnings = userTransactions.filter(t => t.type === 'prize').reduce((sum, t) => sum + t.amount, 0);
      const totalWithdrawn = userTransactions.filter(t => t.type === 'withdrawal').reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        user: { id: user.id, name: user.name, email: user.email, nickname: user.nickname },
        balance: wallet ? wallet.balance : 0,
        totalDeposited,
        totalWinnings,
        totalWithdrawn,
        deposits: userDeposits
      };
    });

    res.json(userWallets);
  } catch (err) {
    console.error('Error fetching user wallets:', err);
    res.status(500).json({ error: 'Erro ao buscar carteiras dos usuários' });
  }
});

app.post('/api/admin/wallets/deposit', authenticate, isAdmin, async (req: any, res) => {
  const { userId, amount, description } = req.body;
  
  if (!userId || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Dados inválidos para depósito' });
  }

  try {
    // 1. Get user's wallet
    const { data: wallet, error: walletErr } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletErr || !wallet) {
      return res.status(404).json({ error: 'Carteira não encontrada' });
    }

    const newBalance = parseFloat(wallet.balance) + parseFloat(amount);

    // 2. Update balance
    const { error: updateErr } = await supabase
      .from('wallets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', wallet.id);

    if (updateErr) throw updateErr;

    // 3. Record transaction
    const { error: transErr } = await supabase
      .from('wallet_transactions')
      .insert([{
        wallet_id: wallet.id,
        amount: parseFloat(amount),
        type: 'admin_adjustment',
        balance_after: newBalance,
        description: description || 'Depósito manual via administrativo'
      }]);

    if (transErr) throw transErr;

    // 4. Send notification to user
    sendRealtimeNotification(userId.toString(), {
      type: 'notification',
      data: {
        id: `admin-dep-${Date.now()}`,
        type: 'admin_msg',
        msgType: 'success',
        title: '💰 Depósito Recebido!',
        message: `Um depósito de R$ ${parseFloat(amount).toFixed(2)} foi adicionado à sua carteira pelo administrador.`,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, newBalance });
  } catch (err: any) {
    console.error('Manual deposit error:', err);
    res.status(500).json({ error: 'Erro ao realizar depósito manual' });
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
      withdrawalsHistory: withdrawals?.value ? JSON.parse(withdrawals.value) : [],
      notifications: [] // Placeholder or fetch if needed, but App.tsx now uses /api/admin/notifications
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

app.post('/api/admin/jackpot/inject', authenticate, isAdmin, async (req, res) => {
  const { amount, description } = req.body;
  if (!amount) return res.status(400).json({ error: 'Valor é obrigatório' });

  try {
    const { data: jackpotSetting } = await supabase.from('settings').select('value').eq('key', 'jackpot_pool').maybeSingle();
    const currentJackpot = parseFloat(jackpotSetting?.value || '0');
    const newJackpot = currentJackpot + parseFloat(amount);
    
    await supabase.from('settings').upsert({ key: 'jackpot_pool', value: newJackpot.toString() }, { onConflict: 'key' });
    
    // Also record in a log or history if needed
    console.log(`Admin injected R$ ${amount} into jackpot. Reason: ${description}`);
    
    res.json({ success: true, newJackpot });
  } catch (err) {
    console.error('Error injecting jackpot:', err);
    res.status(500).json({ error: 'Falha ao injetar bônus' });
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

    // Send real-time notification for new round
    sendRealtimeNotification('all', {
      type: 'notification',
      data: {
        id: `round-${round.id}-${Date.now()}`,
        type: 'admin_msg',
        msgType: 'info',
        title: '⚽ Nova Rodada Aberta!',
        message: `A Rodada #${number} já está aberta para palpites. Garanta sua participação!`,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true, roundId: round.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create round' });
  }
});

app.get('/api/admin/pending-withdrawals', authenticate, isAdmin, async (req, res) => {
  try {
    const { data: withdrawals } = await supabase
      .from('wallet_transactions')
      .select(`
        *,
        wallets (
          user_id,
          users (name, email, nickname, phone)
        )
      `)
      .eq('type', 'withdrawal')
      .like('reference_id', 'pending_%')
      .order('created_at', { ascending: false });

    const formatted = withdrawals?.map((w: any) => ({
      ...w,
      user_name: w.wallets?.users?.name,
      user_nickname: w.wallets?.users?.nickname,
      user_email: w.wallets?.users?.email,
      user_phone: w.wallets?.users?.phone,
      user_id: w.wallets?.user_id,
      pix_key: w.reference_id?.replace('pending_', '')
    })) || [];

    res.json(formatted);
  } catch (err) {
    console.error('Fetch pending withdrawals error:', err);
    res.status(500).json({ error: 'Erro ao buscar saques pendentes' });
  }
});

app.post('/api/admin/withdrawals/:id/approve', authenticate, isAdmin, async (req: any, res) => {
  try {
    // 1. Get transaction
    const { data: transaction } = await supabase
      .from('wallet_transactions')
      .select('*, wallets(user_id)')
      .eq('id', req.params.id)
      .single();

    if (!transaction) return res.status(404).json({ error: 'Saque não encontrado' });
    if (!transaction.reference_id?.startsWith('pending_')) return res.status(400).json({ error: 'Saque já processado' });

    // 2. Update transaction status
    const { error: updateErr } = await supabase
      .from('wallet_transactions')
      .update({ reference_id: transaction.reference_id.replace('pending_', 'completed_') })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;

    // 3. Notify user
    sendRealtimeNotification(transaction.wallets.user_id, {
      type: 'notification',
      data: {
        id: `withdraw-app-${Date.now()}`,
        type: 'admin_msg',
        msgType: 'success',
        title: '💸 Saque Realizado!',
        message: `Seu pedido de saque de R$ ${Math.abs(transaction.amount).toFixed(2)} foi processado e transferido para sua conta.`,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Approve withdrawal error:', err);
    res.status(500).json({ error: 'Erro ao aprovar saque' });
  }
});

app.post('/api/admin/withdrawals/:id/reject', authenticate, isAdmin, async (req: any, res) => {
  try {
    // 1. Get transaction
    const { data: transaction } = await supabase
      .from('wallet_transactions')
      .select('*, wallets(id, balance, user_id)')
      .eq('id', req.params.id)
      .single();

    if (!transaction) return res.status(404).json({ error: 'Saque não encontrado' });
    if (!transaction.reference_id?.startsWith('pending_')) return res.status(400).json({ error: 'Saque já processado' });

    // 2. Refund wallet
    const newBalance = transaction.wallets.balance + Math.abs(transaction.amount);
    await supabase.from('wallets').update({ balance: newBalance }).eq('id', transaction.wallets.id);

    // 3. Update transaction status
    const { error: updateErr } = await supabase
      .from('wallet_transactions')
      .update({ reference_id: transaction.reference_id.replace('pending_', 'rejected_') })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;

    // 4. Record refund transaction
    await supabase.from('wallet_transactions').insert([{
      wallet_id: transaction.wallets.id,
      amount: Math.abs(transaction.amount),
      type: 'admin_adjustment',
      balance_after: newBalance,
      reference_id: `refund_${req.params.id}`,
      description: `Estorno de Saque Rejeitado`
    }]);

    // 5. Notify user
    sendRealtimeNotification(transaction.wallets.user_id, {
      type: 'notification',
      data: {
        id: `withdraw-rej-${Date.now()}`,
        type: 'admin_msg',
        msgType: 'error',
        title: '❌ Saque Rejeitado',
        message: `Seu pedido de saque de R$ ${Math.abs(transaction.amount).toFixed(2)} foi rejeitado. O valor retornou para sua carteira.`,
        created_at: new Date().toISOString()
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Reject withdrawal error:', err);
    res.status(500).json({ error: 'Erro ao rejeitar saque' });
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

app.post('/api/admin/rounds/:id/partial-results', authenticate, isAdmin, async (req, res) => {
  const { results } = req.body;
  
  try {
    // 1. Update game results
    for (const gameId in results) {
      if (results[gameId]) {
        await supabase.from('games').update({ result: results[gameId] }).eq('id', gameId);
      }
    }

    // 2. Recalculate scores
    const { data: predictions } = await supabase
      .from('predictions')
      .select('id')
      .eq('round_id', req.params.id)
      .eq('status', 'approved');

    if (predictions) {
      for (const p of predictions) {
        const { data: items } = await supabase.from('prediction_items').select('game_id, guess').eq('prediction_id', p.id);
        let score = 0;
        items?.forEach((item: any) => {
          if (results[item.game_id] && results[item.game_id] === item.guess) score++;
        });
        await supabase.from('predictions').update({ score }).eq('id', p.id);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Partial results error:', err);
    res.status(500).json({ error: 'Failed to update partial results' });
  }
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
      .select('score, user_id, users(name, nickname)')
      .eq('round_id', req.params.id)
      .eq('status', 'approved')
      .order('score', { ascending: false });

    const maxScore = scoredPredictions?.[0]?.score || 0;
    const winnersData = scoredPredictions?.filter(p => p.score === maxScore) || [];
    const winners = winnersData.map(p => {
      const u = Array.isArray(p.users) ? p.users[0] : p.users;
      return u?.nickname || u?.name;
    });
    
    // Check if anyone got 10/10 for jackpot, or if admin forced jackpot distribution
    const tenCorrect = distributeJackpot 
      ? winnersData
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

    // Record prizes in history and credit wallets
    if (winnersData.length > 0) {
      const { data: prizesSetting } = await supabase.from('settings').select('value').eq('key', 'prizes_history').maybeSingle();
      let prizesHistory = [];
      try {
        if (prizesSetting?.value) prizesHistory = JSON.parse(prizesSetting.value);
      } catch (e) {}
      
      const prizePerWinner = winnersPool / winnersData.length;
      
      for (const winner of winnersData) {
        const u = Array.isArray(winner.users) ? winner.users[0] : winner.users;
        const name = u?.nickname || u?.name;
        
        prizesHistory.push({
          round_id: req.params.id,
          round_number: round.number,
          winner_name: name,
          amount: prizePerWinner,
          date: new Date().toISOString(),
          type: 'round_winner'
        });

        // Credit Wallet
        const { data: wallet } = await supabase.from('wallets').select('*').eq('user_id', winner.user_id).single();
        if (wallet) {
          const newBalance = wallet.balance + prizePerWinner;
          await supabase.from('wallets').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('id', wallet.id);
          
          await supabase.from('wallet_transactions').insert([{
            wallet_id: wallet.id,
            amount: prizePerWinner,
            type: 'prize_credit',
            balance_after: newBalance,
            description: `Prêmio da Rodada #${round.number}`
          }]);
          
          // Notify individual winner
          sendRealtimeNotification(winner.user_id, {
            type: 'notification',
            data: {
              id: `win-personal-${req.params.id}-${Date.now()}`,
              type: 'admin_msg',
              msgType: 'success',
              title: '💰 Prêmio Recebido!',
              message: `Você ganhou R$ ${prizePerWinner.toFixed(2)} na Rodada #${round.number}. O valor já está na sua carteira!`,
              created_at: new Date().toISOString()
            }
          });
        }
      }
      
      await supabase.from('settings').upsert({ key: 'prizes_history', value: JSON.stringify(prizesHistory) }, { onConflict: 'key' });

      // Broadcast real-time notification
      sendRealtimeNotification('all', {
        type: 'notification',
        data: {
          id: `win-${Date.now()}`,
          type: 'admin_msg', // Use admin_msg to reuse frontend UI
          msgType: 'success',
          title: '🎉 Temos Ganhadores!',
          message: `A Rodada #${round.number} foi finalizada. Ganhadores: ${winners.join(', ')}`,
          created_at: new Date().toISOString()
        }
      });
    }

    // 5. Send Push Notifications to all participants
    if (scoredPredictions && scoredPredictions.length > 0) {
      for (const p of scoredPredictions) {
        const isWinner = winnersData.some(w => w.user_id === p.user_id);
        const title = isWinner ? '🏆 Você Ganhou!' : '🏁 Rodada Finalizada';
        const message = isWinner 
          ? `Parabéns! Você venceu a Rodada #${round.number} com ${p.score} pontos!` 
          : `A Rodada #${round.number} terminou. Você fez ${p.score} pontos. Confira o ranking!`;

        sendPushNotification(p.user_id, {
          title,
          body: message,
          icon: '/logo.png', // Assuming a logo exists
          data: { url: '/ranking' }
        });
      }
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

// Referral System
app.get('/api/user/referral-info', authenticate, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('referral_code, referred_by')
      .eq('id', userId)
      .single();

    if (userErr) throw userErr;

    const { data: referrals, error: refErr } = await supabase
      .from('referrals')
      .select('*, referred:users!referred_id(name, nickname, created_at)')
      .eq('referrer_id', userId);

    if (refErr) throw refErr;

    const totalReferred = referrals?.length || 0;
    const paidReferrals = referrals?.filter(r => r.bonus_paid).length || 0;
    const totalBonusEarned = referrals?.reduce((acc, r) => r.bonus_paid ? acc + parseFloat(r.bonus_amount) : acc, 0) || 0;

    res.json({
      referral_code: user.referral_code,
      total_referred: totalReferred,
      paid_referrals: paidReferrals,
      total_bonus_earned: totalBonusEarned,
      referrals: referrals || []
    });
  } catch (err: any) {
    console.error('Referral info error:', err);
    res.status(500).json({ error: 'Erro ao buscar informações de indicação' });
  }
});

app.get('/api/admin/referrals', authenticate, isAdmin, async (req: any, res) => {
  try {
    const { data, error } = await supabase
      .from('referrals')
      .select('*, referrer:users!referrer_id(name, nickname, email), referred:users!referred_id(name, nickname, email, created_at)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    console.error('Admin referrals error:', err);
    res.status(500).json({ error: 'Erro ao buscar indicações' });
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
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
