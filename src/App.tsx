import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from './contexts/AuthContext';
import { 
  Trophy, 
  LayoutDashboard, 
  History, 
  ShieldCheck, 
  LogOut, 
  User as UserIcon,
  Menu,
  X,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Upload,
  Copy,
  Check,
  TrendingUp,
  Gift,
  Wallet,
  DollarSign,
  FileText,
  BarChart2,
  ListOrdered,
  TrendingDown,
  Info,
  ArrowLeft,
  Bell,
  Mail,
  MessageCircle,
  Eye,
  EyeOff,
  Send,
  Trash2,
  CheckCircle,
  Plus,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { generatePixPayload } from './utils/pix';

// --- HELPERS ---

const parseDate = (date: any) => {
  if (!date) return null;
  if (typeof date === 'string') {
    // Safari compatibility: replace space with T for ISO-like strings
    return new Date(date.replace(' ', 'T'));
  }
  return new Date(date);
};

const formatDate = (date: any, formatStr: string, options?: any) => {
  if (!date) return '-';
  const d = parseDate(date);
  if (!d || isNaN(d.getTime())) return '-';
  return format(d, formatStr, options);
};

const NotificationsDropdown = () => {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) return;
      try {
        const res = await fetch('/api/my-notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data);
          
          let readIds = [];
          try {
            readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
          } catch (e) {
            readIds = [];
          }
          const unread = data.filter((n: any) => !readIds.includes(n.id));
          setUnreadCount(unread.length);
        }
      } catch (err) {
        console.error('Failed to fetch notifications');
      }
    };
    
    fetchNotifications();

    // Request Notification Permissions
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }

    // WebSocket Connection
    if (token) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'notification') {
            const newNotif = message.data;
            setNotifications(prev => {
              // Avoid duplicates
              if (prev.some(n => n.id === newNotif.id)) return prev;
              const updated = [newNotif, ...prev];
              
              // Update unread count
              let readIds = [];
              try {
                readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
              } catch (e) {
                readIds = [];
              }
              if (!readIds.includes(newNotif.id)) {
                setUnreadCount(c => c + 1);
              }
              
              return updated;
            });

            // Optional: Play a sound or show a browser notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              new Notification(newNotif.title, { body: newNotif.message });
            }
          }
        } catch (err) {
          console.error('WS Message error:', err);
        }
      };

      return () => {
        ws.close();
      };
    }
  }, [token]);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      let readIds = [];
      try {
        readIds = JSON.parse(localStorage.getItem('read_notifications') || '[]');
      } catch (e) {
        readIds = [];
      }
      const newReadIds = [...new Set([...readIds, ...notifications.map(n => n.id)])];
      localStorage.setItem('read_notifications', JSON.stringify(newReadIds));
      setUnreadCount(0);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={handleOpen}
        className="relative p-2 text-gray-500 hover:text-primary transition-colors rounded-full hover:bg-gray-100"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
          >
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Notificações</h3>
              {unreadCount > 0 && (
                <span className="bg-primary text-white text-xs px-2 py-1 rounded-full font-medium">
                  {unreadCount} novas
                </span>
              )}
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhuma notificação no momento.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notif) => {
                    const isAdminMsg = notif.type === 'admin_msg';
                    const iconColor = isAdminMsg ? (
                      notif.msgType === 'success' ? 'bg-green-100 text-green-600' :
                      notif.msgType === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                      (notif.msgType === 'alert' || notif.msgType === 'error') ? 'bg-red-100 text-red-600' :
                      'bg-blue-100 text-blue-600'
                    ) : 'bg-green-100 text-green-600';

                    const Icon = isAdminMsg ? (
                      (notif.msgType === 'alert' || notif.msgType === 'error') ? AlertCircle :
                      notif.msgType === 'warning' ? Info :
                      notif.msgType === 'success' ? CheckCircle :
                      Bell
                    ) : Trophy;

                    return (
                      <div key={notif.id} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-bold text-gray-900">{notif.title}</p>
                            <p className="text-sm text-gray-600 mt-0.5 leading-snug">{notif.message}</p>
                            <div className="flex items-center justify-between mt-2">
                              {isAdminMsg && (
                                <p className="text-[10px] text-gray-400 uppercase font-bold">Aviso Oficial</p>
                              )}
                              {notif.createdAt && (
                                <p className="text-[10px] text-gray-400">{formatDate(notif.createdAt, 'dd/MM HH:mm')}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Navbar = ({ onNavigate, currentPage }: { onNavigate: (page: string) => void, currentPage: string }) => {
  const { user, logout, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, show: !!user },
    { id: 'predictions', label: 'Fazer Palpite', icon: Trophy, show: !!user && !isAdmin },
    { id: 'wallet', label: 'Minha Carteira', icon: Wallet, show: !!user && !isAdmin },
    { id: 'profile', label: 'Meu Perfil', icon: UserIcon, show: !!user },
    { id: 'transparency', label: 'Transparência', icon: ShieldCheck, show: !!user },
    { id: 'ranking', label: 'Ranking', icon: BarChart2, show: !!user },
    { id: 'terms', label: 'Regras', icon: FileText, show: true },
    { id: 'admin', label: 'Admin', icon: ShieldCheck, show: isAdmin },
    { id: 'admin-rounds', label: 'Gerenciar Rodadas', icon: ListOrdered, show: isAdmin },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center cursor-pointer" onClick={() => onNavigate('landing')}>
              <span className="text-2xl font-bold text-primary">BOLÃO<span className="text-secondary">10</span></span>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
              {navItems.filter(i => i.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    currentPage === item.id 
                      ? 'border-secondary text-primary' 
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <item.icon className="w-4 h-4 mr-2" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hidden sm:ml-6 sm:flex sm:items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                <NotificationsDropdown />
                <button 
                  onClick={() => onNavigate('profile')}
                  className="flex items-center text-sm text-gray-700 hover:text-primary transition-colors"
                >
                  <UserIcon className="w-4 h-4 mr-2" />
                  {user.name}
                </button>
                <button
                  onClick={logout}
                  className="text-gray-500 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => onNavigate('login')}
                className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-opacity-90 transition-all"
              >
                Entrar
              </button>
            )}
          </div>
          <div className="flex items-center sm:hidden space-x-2">
            {user && <NotificationsDropdown />}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="sm:hidden bg-white border-b border-gray-200"
          >
            <div className="pt-2 pb-3 space-y-1">
              {navItems.filter(i => i.show).map((item) => (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setIsMenuOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-base font-medium text-gray-600 hover:bg-gray-50"
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.label}
                </button>
              ))}
              {user ? (
                <button
                  onClick={logout}
                  className="flex items-center w-full px-4 py-2 text-base font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5 mr-3" />
                  Sair
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('login')}
                  className="flex items-center w-full px-4 py-2 text-base font-medium text-primary hover:bg-gray-50"
                >
                  Entrar
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

// --- PAGES ---

const LandingPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-7xl font-bold text-primary tracking-tight"
          >
            BOLÃO<span className="text-secondary">10</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto"
          >
            A plataforma de palpites de futebol focada em conhecimento e transparência. Sem algoritmos, sem truques. Apenas você e seus amigos.
          </motion.p>
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-col sm:flex-row justify-center gap-4"
          >
            <button 
              onClick={() => onNavigate('login')}
              className="bg-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all flex items-center justify-center"
            >
              Começar Agora <ArrowRight className="ml-2 w-5 h-5" />
            </button>
            <button className="bg-gray-100 text-gray-700 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-200 transition-all">
              Como Funciona
            </button>
          </motion.div>
        </div>

        <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { title: 'Transparência Total', desc: 'Todos os palpites ficam visíveis para todos os participantes assim que a rodada começa.', icon: ShieldCheck },
            { title: 'Prêmios Reais', desc: '75% da arrecadação vai para os vencedores da rodada. Simples e direto.', icon: Trophy },
            { title: 'Bônus Acumulado', desc: 'Acerte os 10 resultados e leve o pote acumulado do Bônus 10.', icon: CheckCircle2 },
          ].map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="p-8 bg-gray-50 rounded-3xl border border-gray-100"
            >
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-6">
                <feature.icon className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="text-xl font-bold text-primary mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

const LoginPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { login } = useAuth();

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setPhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const body = isRegister ? { email, password, name, nickname, phone } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        login(data.token, data.user);
        onNavigate('dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu e-mail para solicitar a recuperação.');
      return;
    }
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccess('Solicitação enviada ao administrador. Por favor, aguarde o contato.');
      } else {
        const data = await res.json();
        setError(data.error || 'Erro ao processar solicitação');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor');
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100"
      >
        <h2 className="text-3xl font-bold text-primary mb-2">
          {isRegister ? 'Criar Conta' : 'Bem-vindo'}
        </h2>
        <p className="text-gray-500 mb-8">
          {isRegister ? 'Junte-se ao Bolão10 hoje.' : 'Acesse sua conta para palpitar.'}
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" /> {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-xl text-sm flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nickname (Apelido)</label>
                <input 
                  type="text" 
                  required 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
                  placeholder="Ex: artilheiro10"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
                <input 
                  type="tel" 
                  required 
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all pr-12"
                placeholder="••••••••"
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {!isRegister && (
            <div className="text-right">
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-xs text-secondary hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
          )}

          <button 
            type="submit"
            className="w-full bg-primary text-white py-4 rounded-xl font-semibold hover:bg-opacity-90 transition-all mt-4"
          >
            {isRegister ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-gray-500 hover:text-secondary transition-colors"
          >
            {isRegister ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const WalletPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token, user } = useAuth();
  const [walletData, setWalletData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/my-wallet', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao carregar resumo financeiro');
      const data = await res.json();
      setWalletData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, [token]);

  const handleUpdateProof = async (id: number) => {
    if (!proofFile) return alert('Selecione o comprovante.');
    
    setUploadingId(id);
    const formData = new FormData();
    formData.append('proof', proofFile);

    try {
      const res = await fetch(`/api/predictions/${id}/proof`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) throw new Error('Falha ao enviar comprovante');
      alert('Comprovante enviado com sucesso! Aguarde a validação.');
      setProofFile(null);
      setUploadingId(null);
      fetchWallet();
    } catch (err: any) {
      alert(err.message);
      setUploadingId(null);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-4">
          <button onClick={() => onNavigate('dashboard')} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Resumo Financeiro</h1>
        </div>
      </header>
      
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Minha Carteira</h2>
              <p className="text-gray-500">Resumo da sua conta</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">Total Gasto</h3>
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <p className="text-3xl font-bold text-gray-900">
                R$ {walletData?.totalSpent?.toFixed(2) || '0.00'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">Total Ganho</h3>
                <TrendingUp className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-3xl font-bold text-green-600">
                R$ {walletData?.totalWinnings?.toFixed(2) || '0.00'}
              </p>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 font-medium">Palpites Feitos</h3>
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {walletData?.predictionsMade || 0}
              </p>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-50 text-blue-800 rounded-xl text-sm flex items-start">
            <Info className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <p>
              O total gasto considera apenas os palpites que foram validados pelo administrador. 
              Os ganhos são calculados com base nas rodadas finalizadas onde você foi um dos vencedores.
            </p>
          </div>
        </div>

        {walletData?.pendingPredictions?.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
            <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
              <Clock className="w-5 h-5 mr-2" /> Palpites Pendentes de Pagamento
            </h3>
            <div className="space-y-4">
              {walletData.pendingPredictions.map((p: any) => (
                <div key={p.id} className="p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                      <p className="font-bold text-orange-800">Rodada #{p.rounds?.number}</p>
                      <p className="text-sm text-orange-600">Aguardando validação do comprovante.</p>
                      <p className="text-xs text-orange-500 mt-1">Enviado em: {formatDate(p.created_at, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    <div className="w-full md:w-auto">
                      <div className="flex flex-col space-y-2">
                        <label className="text-xs font-bold text-orange-700 uppercase">Reenviar Comprovante:</label>
                        <div className="flex gap-2">
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                            className="text-xs file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-orange-100 file:text-orange-700 hover:file:bg-orange-200"
                          />
                          <button 
                            onClick={() => handleUpdateProof(p.id)}
                            disabled={uploadingId === p.id || !proofFile}
                            className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-orange-700 transition-all disabled:opacity-50"
                          >
                            {uploadingId === p.id ? 'Enviando...' : 'Pagar Palpite Pendente'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const ProfilePage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token, user, login } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 2) {
      value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    }
    if (value.length > 10) {
      value = `${value.slice(0, 10)}-${value.slice(10)}`;
    }
    setPhone(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password && password !== confirmPassword) {
      return setError('As senhas não coincidem');
    }

    setLoading(true);
    try {
      const res = await fetch('/api/my-profile', {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, nickname, phone, password: password || undefined })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar perfil');

      login(data.token, data.user);
      setSuccess('Perfil atualizado com sucesso!');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-primary text-white p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center space-x-4">
          <button onClick={() => onNavigate('dashboard')} className="hover:bg-white/10 p-2 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold">Editar Perfil</h1>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 max-w-2xl mx-auto w-full">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-sm border border-gray-100 p-8 md:p-12"
        >
          <div className="flex items-center space-x-4 mb-8">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              <UserIcon className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Configurações da Conta</h2>
              <p className="text-gray-500">Mantenha seus dados atualizados</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" /> {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 text-green-600 rounded-2xl text-sm flex items-center">
              <CheckCircle2 className="w-4 h-4 mr-2" /> {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Nome Completo</label>
                <input 
                  type="text" 
                  required 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none transition-all"
                  placeholder="Seu nome"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Nickname (Apelido)</label>
                <input 
                  type="text" 
                  required 
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none transition-all"
                  placeholder="Seu apelido"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Telefone (WhatsApp)</label>
              <input 
                type="tel" 
                required 
                value={phone}
                onChange={handlePhoneChange}
                className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none transition-all"
                placeholder="(00) 00000-0000"
              />
            </div>

            <hr className="border-gray-100 my-8" />
            
            <h3 className="text-lg font-bold text-primary mb-4">Alterar Senha</h3>
            <p className="text-sm text-gray-500 mb-6">Deixe em branco se não desejar alterar sua senha atual.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Nova Senha</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wider">Confirmar Nova Senha</label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:bg-opacity-90 transition-all shadow-md disabled:opacity-50 mt-8"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
};

const Dashboard = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token, user } = useAuth();
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [myPredictions, setMyPredictions] = useState<any[]>([]);
  const [walletData, setWalletData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      try {
        const [roundRes, predRes, walletRes] = await Promise.all([
          fetch('/api/rounds/current'),
          fetch('/api/my-predictions', {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch('/api/my-wallet', {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        if (!roundRes.ok) {
          const errorData = await roundRes.json().catch(() => ({}));
          throw new Error(`Erro ao carregar rodada: ${errorData.error || roundRes.statusText}`);
        }
        if (!predRes.ok) {
          const errorData = await predRes.json().catch(() => ({}));
          throw new Error(`Erro ao carregar palpites: ${errorData.error || predRes.statusText}`);
        }
        if (!walletRes.ok) {
          const errorData = await walletRes.json().catch(() => ({}));
          throw new Error(`Erro ao carregar carteira: ${errorData.error || walletRes.statusText}`);
        }

        const roundData = await roundRes.json();
        const predData = await predRes.json();
        const walletData = await walletRes.json();
        setCurrentRound(roundData);
        setMyPredictions(predData);
        setWalletData(walletData);
      } catch (err: any) {
        console.error('Dashboard error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <div className="bg-red-50 p-8 rounded-3xl border border-red-100 inline-block">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-red-800 mb-2">Erro ao carregar Dashboard</h3>
          <p className="text-red-600 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-red-700 transition-all"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary">Olá, {user?.nickname || user?.name}! 👋</h1>
        <p className="text-gray-500">Bem-vindo de volta ao Bolão10.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Wallet Summary */}
          {walletData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
                <div>
                  <p className="text-green-100 font-medium mb-1">Total Ganho</p>
                  <p className="text-3xl font-bold">R$ {walletData.totalWinnings?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
                <div>
                  <p className="text-amber-100 font-medium mb-1">Bônus 10 Acertos</p>
                  <p className="text-3xl font-bold">R$ {currentRound?.jackpotPool?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate('wallet')}>
                <div>
                  <p className="text-gray-500 font-medium mb-1">Minha Carteira</p>
                  <p className="text-xl font-bold text-primary">Ver Detalhes</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-primary" />
                </div>
              </div>
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all" onClick={() => onNavigate('profile')}>
                <div>
                  <p className="text-gray-500 font-medium mb-1">Meu Perfil</p>
                  <p className="text-xl font-bold text-primary">Editar Dados</p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                  <UserIcon className="w-6 h-6 text-secondary" />
                </div>
              </div>
            </div>
          )}

          {/* Current Round Card */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-primary">Rodada Atual</h2>
                <p className="text-gray-500">Rodada #{currentRound?.number || '?'}</p>
              </div>
              <div className="bg-secondary bg-opacity-10 text-secondary px-4 py-2 rounded-full text-sm font-bold">
                {currentRound?.status === 'open' ? 'Aberta' : 'Fechada'}
              </div>
            </div>

            {currentRound ? (
              <div className="space-y-4">
                <div className="flex items-center text-sm text-gray-600">
                  <Clock className="w-4 h-4 mr-2" />
                  Início: {formatDate(currentRound.start_time, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Valor do Palpite</p>
                    <p className="text-2xl font-bold text-primary">R$ {currentRound.entry_value.toFixed(2)}</p>
                  </div>
                  <button 
                    onClick={() => onNavigate('predictions')}
                    disabled={currentRound.status !== 'open'}
                    className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:shadow-md transition-all disabled:opacity-50"
                  >
                    Palpitar
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 italic">Nenhuma rodada ativa no momento.</p>
            )}
          </div>

          {/* History */}
          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h2 className="text-2xl font-bold text-primary mb-6">Meus Palpites</h2>
            <div className="space-y-4">
              {myPredictions.length > 0 ? myPredictions.map((pred) => (
                <div key={pred.id} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
                  <div 
                    onClick={() => setExpandedPrediction(expandedPrediction === pred.id ? null : pred.id)}
                    className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        pred.status === 'approved' ? 'bg-green-100 text-green-600' : 
                        pred.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'
                      }`}>
                        {pred.status === 'approved' ? <CheckCircle2 className="w-5 h-5" /> : 
                         pred.status === 'rejected' ? <X className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-primary">Rodada #{pred.round_number}</p>
                        <p className="text-xs text-gray-500">{formatDate(pred.created_at, 'dd/MM/yyyy HH:mm')}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {pred.status === 'approved' 
                            ? (pred.round_status === 'finished' ? `${pred.score} pontos` : 'Em andamento') 
                            : 'Aguardando'}
                        </p>
                        <p className={`text-xs ${
                          pred.status === 'approved' ? 'text-green-600' : 
                          pred.status === 'rejected' ? 'text-red-600' : 'text-yellow-600'
                        }`}>
                          {pred.status === 'approved' ? 'Validado' : 
                           pred.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                        </p>
                      </div>
                      <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${expandedPrediction === pred.id ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  
                  <AnimatePresence>
                    {expandedPrediction === pred.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-gray-50 border-t border-gray-100"
                      >
                        <div className="p-4">
                          <h4 className="text-sm font-bold text-gray-700 mb-3">Seus Palpites</h4>
                          {pred.items && pred.games ? (
                            <div className="space-y-2">
                              {pred.games.map((game: any) => {
                                const item = pred.items.find((i: any) => i.game_id === game.id);
                                const guess = item?.guess;
                                const isCorrect = game.result && guess === game.result;
                                const isFinished = !!game.result;
                                
                                return (
                                  <div key={game.id} className="flex items-center justify-between bg-white p-3 rounded-xl border border-gray-100">
                                    <div className="flex items-center space-x-3 flex-1">
                                      <span className="text-xs font-bold text-gray-400 w-4">{game.game_order + 1}</span>
                                      <div className="flex-1 flex justify-between items-center text-sm">
                                        <span className={`font-medium ${guess === 'home' ? 'text-primary' : 'text-gray-600'}`}>{game.home_team}</span>
                                        <span className="text-gray-300 mx-2">x</span>
                                        <span className={`font-medium ${guess === 'away' ? 'text-primary' : 'text-gray-600'}`}>{game.away_team}</span>
                                      </div>
                                    </div>
                                    <div className="ml-4 flex items-center space-x-2">
                                      <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                                        {guess === 'home' ? 'Casa' : guess === 'away' ? 'Fora' : 'Empate'}
                                      </span>
                                      {isFinished && (
                                        isCorrect 
                                          ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                          : <X className="w-4 h-4 text-red-500" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">Detalhes não disponíveis.</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )) : (
                <p className="text-gray-500 text-center py-8">Você ainda não fez nenhum palpite.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          <div className="bg-primary text-white rounded-3xl p-8 shadow-lg">
            <Trophy className="w-10 h-10 mb-4 text-secondary" />
            <h3 className="text-xl font-bold mb-2">Ranking de Transparência</h3>
            <p className="text-white text-opacity-70 text-sm mb-6">Confira quem são os maiores pontuadores da plataforma.</p>
            <button 
              onClick={() => onNavigate('transparency')}
              className="w-full bg-white text-primary py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all"
            >
              Ver Ranking
            </button>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
            <h3 className="text-lg font-bold text-primary mb-4">Como Funciona</h3>
            <ul className="space-y-4 text-sm text-gray-600">
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">1</div>
                Faça seus palpites nos 10 jogos da rodada.
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">2</div>
                Envie o comprovante do PIX (R$ {currentRound?.entry_value.toFixed(2) || '10,00'}).
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">3</div>
                Acompanhe os jogos e torça para ser o maior pontuador!
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const PredictionsPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token } = useAuth();
  const [round, setRound] = useState<any>(null);
  const [guesses, setGuesses] = useState<Record<number, string>>({});
  const [predictionsList, setPredictionsList] = useState<Record<number, string>[]>(() => {
    try {
      const saved = localStorage.getItem('bolao10_predictions_list');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });
  const [step, setStep] = useState(() => {
    try {
      const saved = localStorage.getItem('bolao10_prediction_step');
      return saved ? parseInt(saved) : 1;
    } catch (e) {
      return 1;
    }
  }); // 1: Palpites, 2: Pagamento

  useEffect(() => {
    localStorage.setItem('bolao10_predictions_list', JSON.stringify(predictionsList));
  }, [predictionsList]);

  useEffect(() => {
    localStorage.setItem('bolao10_prediction_step', step.toString());
  }, [step]);

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeadlinePopup, setShowDeadlinePopup] = useState(false);
  const [pendingPredictionIds, setPendingPredictionIds] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('bolao10_pending_ids');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('bolao10_pending_ids', JSON.stringify(pendingPredictionIds));
  }, [pendingPredictionIds]);

  useEffect(() => {
    fetch('/api/rounds/current')
      .then(res => {
        if (!res.ok) throw new Error('Erro ao carregar rodada');
        return res.json();
      })
      .then(data => {
        setRound(data);
        setLoading(false);
        
        // Clear session if it's a different round
        const savedRoundId = localStorage.getItem('bolao10_current_round_id');
        if (savedRoundId && data && savedRoundId !== data.id.toString()) {
          localStorage.removeItem('bolao10_pending_ids');
          localStorage.removeItem('bolao10_predictions_list');
          localStorage.removeItem('bolao10_prediction_step');
          setPendingPredictionIds([]);
          setPredictionsList([]);
          setStep(1);
        }
        if (data) {
          localStorage.setItem('bolao10_current_round_id', data.id.toString());
        }

        if (data && data.start_time && new Date() > (parseDate(data.start_time) || new Date(0))) {
          setShowDeadlinePopup(true);
        }
      })
      .catch(err => {
        console.error('Predictions error:', err);
        setLoading(false);
      });
  }, []);

  const handleGuess = (gameId: number, guess: string) => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    setGuesses(prev => ({ ...prev, [gameId]: guess }));
  };

  const savePrediction = async (currentGuesses: Record<number, string>) => {
    if (!round?.id) {
      alert('Erro: Rodada não identificada. Por favor, recarregue a página.');
      return false;
    }
    const formData = new FormData();
    formData.append('roundId', round.id.toString());
    formData.append('guesses', JSON.stringify([currentGuesses]));

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setPendingPredictionIds(prev => [...prev, ...data.ids]);
        return true;
      } else {
        alert(data.error || 'Erro ao salvar palpite');
        return false;
      }
    } catch (err) {
      alert('Erro ao salvar palpite');
      return false;
    }
  };

  const handleAddPrediction = async () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    if (Object.keys(guesses).length < 10) {
      return alert('Por favor, complete todos os 10 palpites antes de adicionar outro.');
    }
    
    setSubmitting(true);
    const success = await savePrediction(guesses);
    if (success) {
      setPredictionsList(prev => [...prev, guesses]);
      setGuesses({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    setSubmitting(false);
  };

  const handleProceedToPayment = async () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    
    setSubmitting(true);
    if (Object.keys(guesses).length === 10) {
      const success = await savePrediction(guesses);
      if (success) {
        setPredictionsList(prev => [...prev, guesses]);
        setGuesses({});
        setStep(2);
      }
    } else if (predictionsList.length > 0) {
      setStep(2);
    } else {
      alert('Complete seu palpite antes de prosseguir.');
    }
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    if (!file) return alert('Por favor, anexe o comprovante.');
    setSubmitting(true);
    
    const formData = new FormData();
    formData.append('predictionIds', JSON.stringify(pendingPredictionIds));
    formData.append('proof', file);

    try {
      const res = await fetch('/api/predictions/attach-proof', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        alert('Comprovante enviado com sucesso! Aguarde a validação.');
        localStorage.removeItem('bolao10_pending_ids');
        localStorage.removeItem('bolao10_predictions_list');
        localStorage.removeItem('bolao10_prediction_step');
        onNavigate('dashboard');
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao enviar comprovante');
      }
    } catch (err) {
      alert('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = (predictionsList.length) * (round?.entry_value || 10);

  const pixPayload = useMemo(() => {
    if (totalAmount <= 0) return '';
    return generatePixPayload(
      'admin@bolao10.com',
      'BOLAO10',
      'SAO PAULO',
      totalAmount
    );
  }, [totalAmount]);

  const copyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;
  if (!round || round.status !== 'open') return <div className="text-center py-20">Nenhuma rodada aberta no momento.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold text-primary">Rodada #{round.number}</h2>
        <div className="flex space-x-2">
          <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-secondary' : 'bg-gray-200'}`} />
          <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-secondary' : 'bg-gray-200'}`} />
        </div>
      </div>

      {step === 1 ? (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-2xl text-blue-700 text-sm mb-6 flex items-start">
            <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
            Selecione o resultado de cada um dos 10 jogos abaixo. 1 = Mandante, X = Empate, 2 = Visitante.
          </div>
          
          {predictionsList.length > 0 && (
            <div className="bg-green-50 p-4 rounded-2xl text-green-700 text-sm mb-6 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="font-bold">{predictionsList.length} palpite(s) adicionado(s) ao carrinho.</span>
                <span className="font-bold">Total: R$ {(predictionsList.length * (round.entry_value || 10)).toFixed(2)}</span>
              </div>
              <button 
                onClick={() => {
                  if(confirm('Deseja limpar todos os palpites salvos nesta sessão?')) {
                    localStorage.removeItem('bolao10_pending_ids');
                    localStorage.removeItem('bolao10_predictions_list');
                    setPendingPredictionIds([]);
                    setPredictionsList([]);
                  }
                }}
                className="text-xs bg-white text-red-500 px-3 py-1 rounded-lg font-bold border border-red-100 hover:bg-red-50 transition-colors"
              >
                Limpar Carrinho
              </button>
            </div>
          )}

          {round.games.map((game: any) => (
            <div key={game.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 grid grid-cols-3 items-center gap-4">
                <span className="text-right font-bold text-primary">{game.home_team}</span>
                <span className="text-center text-gray-400 font-mono">VS</span>
                <span className="text-left font-bold text-primary">{game.away_team}</span>
              </div>
              <div className="flex justify-center space-x-2">
                {['1', 'X', '2'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleGuess(game.id, opt)}
                    className={`w-12 h-12 rounded-xl font-bold transition-all ${
                      guesses[game.id] === opt 
                        ? 'bg-secondary text-white shadow-md scale-105' 
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-col sm:flex-row gap-4 mt-8">
            <button
              disabled={Object.keys(guesses).length < 10 || submitting}
              onClick={handleAddPrediction}
              className="flex-1 bg-gray-100 text-primary py-4 rounded-2xl font-bold text-lg hover:bg-gray-200 transition-all disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Fazer Mais um Palpite'}
            </button>
            <button
              disabled={(Object.keys(guesses).length < 10 && predictionsList.length === 0) || submitting}
              onClick={handleProceedToPayment}
              className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:shadow-lg transition-all disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Continuar para Pagamento'}
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm text-center">
            <h3 className="text-xl font-bold text-primary mb-4">Pagamento via PIX</h3>
            <p className="text-gray-600 mb-6">Para validar {predictionsList.length} palpite(s), realize o pagamento de <span className="font-bold text-primary">R$ {totalAmount.toFixed(2)}</span> utilizando o QR Code ou a chave Copia e Cola abaixo:</p>
            
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm">
                <QRCode value={pixPayload} size={200} />
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between mb-8 max-w-md mx-auto border border-gray-200">
              <span className="font-mono text-sm text-gray-500 truncate mr-4">{pixPayload}</span>
              <button onClick={copyPix} className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0">
                {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-500" />}
              </button>
            </div>

            <div className="space-y-4 text-left max-w-sm mx-auto">
              <label className="block text-sm font-bold text-gray-700">Anexar Comprovante (Imagem ou PDF)</label>
              <div className="relative">
                <input 
                  type="file" 
                  accept="image/*,.pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden" 
                  id="proof-upload"
                />
                <label 
                  htmlFor="proof-upload"
                  className="w-full flex items-center justify-center px-4 py-4 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer hover:border-secondary transition-colors"
                >
                  {file ? (
                    <span className="text-secondary font-medium flex items-center">
                      <CheckCircle2 className="w-5 h-5 mr-2" /> {file.name}
                    </span>
                  ) : (
                    <span className="text-gray-500 flex items-center">
                      <Upload className="w-5 h-5 mr-2" /> Selecionar Arquivo
                    </span>
                  )}
                </label>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 text-sm text-gray-500">
              <p className="mb-3 font-medium text-gray-600">Problemas com o pagamento? Entre em contato:</p>
              <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                <span className="text-gray-500 font-medium">Contato:</span>
                <a href="mailto:admin@bolao10.com" className="text-blue-600 hover:text-blue-700 hover:underline flex items-center transition-colors bg-blue-50 p-3 rounded-full shadow-sm" title="admin@bolao10.com">
                  <Mail className="w-5 h-5" />
                </a>
                <a href="https://wa.me/5521989886916" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 hover:underline flex items-center transition-colors bg-green-50 p-3 rounded-full shadow-sm" title="(21) 98988-6916">
                  <MessageCircle className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
            >
              Voltar
            </button>
            <button
              disabled={!file || submitting}
              onClick={handleSubmit}
              className="flex-[2] bg-secondary text-white py-4 rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
            >
              {submitting ? 'Enviando...' : 'Enviar Comprovante'}
            </button>
          </div>
        </motion.div>
      )}

      {showDeadlinePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Prazo Encerrado</h3>
            <p className="text-gray-600 mb-8">
              O prazo para enviar palpites nesta rodada já encerrou.
            </p>
            <button
              onClick={() => {
                setShowDeadlinePopup(false);
                onNavigate('dashboard');
              }}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold hover:shadow-lg transition-all"
            >
              Voltar ao Início
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {
  const { token } = useAuth();
  const [pending, setPending] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [financialDetails, setFinancialDetails] = useState<any>({ jackpotPool: 0, prizesHistory: [], withdrawalsHistory: [] });
  const [newWithdrawal, setNewWithdrawal] = useState({ amount: '', reason: '' });
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [viewingPrediction, setViewingPrediction] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'financial' | 'history' | 'notifications' | 'messages'>('pending');
  const [roundHistory, setRoundHistory] = useState<any[]>([]);
  
  // Notification Form State
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'info',
    target_type: 'all',
    user_id: ''
  });
  const [sendingNotification, setSendingNotification] = useState(false);
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<any>(null);

  const fetchPending = async () => {
    const res = await fetch('/api/admin/pending-predictions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setPending(data);
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUsers(data);
  };

  const fetchFinancials = async () => {
    const res = await fetch('/api/admin/financial-summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setFinancials(data);
  };

  const fetchFinancialDetails = async () => {
    const res = await fetch('/api/admin/financial-details', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setFinancialDetails(await res.json());
  };

  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/withdrawals', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newWithdrawal)
    });
    if (res.ok) {
      alert('Saque registrado com sucesso!');
      setNewWithdrawal({ amount: '', reason: '' });
      setShowWithdrawalForm(false);
      fetchFinancialDetails();
    }
  };

  const fetchRoundHistory = async () => {
    const res = await fetch('/api/rounds');
    const data = await res.json();
    setRoundHistory(data);
  };

  const fetchNotifications = async () => {
    const res = await fetch('/api/admin/notifications', { 
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setAdminNotifications(await res.json());
    }
  };

  const fetchSentNotifications = async () => {
    const res = await fetch('/api/admin/notifications', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setSentNotifications(await res.json());
  };

  useEffect(() => { 
    setLoading(true);
    const promises = [fetchPending()];
    if (activeTab === 'users' || activeTab === 'messages') promises.push(fetchUsers());
    if (activeTab === 'notifications') promises.push(fetchNotifications());
    if (activeTab === 'messages') promises.push(fetchSentNotifications());
    if (activeTab === 'financial') {
      promises.push(fetchFinancials());
      promises.push(fetchFinancialDetails());
    }
    if (activeTab === 'history') promises.push(fetchRoundHistory());
    Promise.all(promises).finally(() => setLoading(false));
  }, [token, activeTab]);

  const handleValidate = async (id: number, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/admin/predictions/${id}/validate`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchPending();
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editingUser)
    });
    if (res.ok) {
      alert('Usuário atualizado!');
      setEditingUser(null);
      fetchUsers();
    }
  };

  const handleDeleteUser = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) fetchUsers();
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingNotification(true);
    try {
      const res = await fetch('/api/admin/send-notification', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationForm)
      });
      if (res.ok) {
        alert('Notificação enviada com sucesso!');
        setNotificationForm({
          title: '',
          message: '',
          type: 'info',
          target_type: 'all',
          user_id: ''
        });
        fetchSentNotifications();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao enviar notificação');
      }
    } catch (err) {
      alert('Erro de conexão');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleDeleteNotification = async (id: string) => {
    if (!confirm('Deseja excluir esta mensagem do histórico?')) return;
    try {
      const res = await fetch(`/api/admin/notifications/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchSentNotifications();
      }
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h2 className="text-3xl font-bold text-primary">Painel Administrativo</h2>
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto max-w-full">
          {[
            { id: 'pending', label: 'Validações' },
            { id: 'users', label: 'Usuários' },
            { id: 'financial', label: 'Financeiro' },
            { id: 'history', label: 'Histórico' },
            { id: 'notifications', label: 'Alertas' },
            { id: 'messages', label: 'Mensagens' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {activeTab === 'pending' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-primary">Validação Manual de Palpites</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Rodada</th>
                  <th className="px-6 py-4">Data Envio</th>
                  <th className="px-6 py-4">Palpites</th>
                  <th className="px-6 py-4">Comprovante</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pending.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary">{p.user_name} ({p.user_nickname})</p>
                      <p className="text-xs text-gray-500">{p.user_email}</p>
                      {p.user_phone && <p className="text-xs text-gray-500">{p.user_phone}</p>}
                    </td>
                    <td className="px-6 py-4 font-medium">#{p.round_number}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{formatDate(p.created_at, 'dd/MM HH:mm')}</td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setViewingPrediction(p)}
                        className="text-primary hover:underline text-sm font-bold"
                      >
                        Ver Palpites
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setViewingProof(p.proof_path)}
                        className="text-secondary hover:underline text-sm font-bold"
                      >
                        Ver Arquivo
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleValidate(p.id, 'approved')}
                          className="bg-green-100 text-green-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-200"
                        >
                          Aprovar
                        </button>
                        <button 
                          onClick={() => handleValidate(p.id, 'rejected')}
                          className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-200"
                        >
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-primary">Gerenciamento de Usuários</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Nome / Nickname</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Senha</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary">{u.name}</p>
                      <p className="text-xs text-gray-500">@{u.nickname}</p>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <p>{u.email}</p>
                      {u.phone && <p className="text-xs text-gray-500">{u.phone}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">{u.password}</code>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => setEditingUser(u)}
                          className="text-blue-600 hover:underline text-xs font-bold"
                        >
                          Editar
                        </button>
                        <a 
                          href={`mailto:${u.email}`}
                          className="text-green-600 hover:underline text-xs font-bold"
                        >
                          E-mail
                        </a>
                        {u.phone && (
                          <a 
                            href={`https://wa.me/55${u.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-500 hover:underline text-xs font-bold"
                          >
                            WhatsApp
                          </a>
                        )}
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-red-600 hover:underline text-xs font-bold"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-primary">Alertas e Solicitações</h3>
            <Bell className="w-5 h-5 text-secondary" />
          </div>
          <div className="divide-y divide-gray-100">
            {adminNotifications.length === 0 ? (
              <div className="p-12 text-center text-gray-400 italic">
                Nenhum alerta pendente.
              </div>
            ) : (
              adminNotifications.map((n: any) => (
                <div key={n.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${n.type === 'forgot_password' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                        {n.type === 'forgot_password' ? <AlertCircle className="w-5 h-5" /> : <Bell className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{n.message}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Solicitado em {formatDate(n.created_at || n.date, 'dd/MM/yyyy HH:mm')}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <a 
                            href={`mailto:${n.user_email}?subject=Recuperação de Senha - Bolão10&body=Olá ${n.user_name}, recebemos sua solicitação de recuperação de senha.`}
                            className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center"
                          >
                            <Mail className="w-3.5 h-3.5 mr-1.5" /> Enviar E-mail
                          </a>
                          {n.user_phone && (
                            <a 
                              href={`https://wa.me/55${n.user_phone.replace(/\D/g, '')}?text=Olá ${n.user_name}, recebemos sua solicitação de recuperação de senha no Bolão10.`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors flex items-center"
                            >
                              <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Enviar WhatsApp
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm sticky top-8">
              <h3 className="text-xl font-bold text-primary mb-6">Enviar Notificação</h3>
              <form onSubmit={handleSendNotification} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Título</label>
                  <input 
                    type="text" 
                    required 
                    value={notificationForm.title}
                    onChange={(e) => setNotificationForm({...notificationForm, title: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                    placeholder="Ex: Nova Rodada Aberta!"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensagem</label>
                  <textarea 
                    required 
                    rows={4}
                    value={notificationForm.message}
                    onChange={(e) => setNotificationForm({...notificationForm, message: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 resize-none"
                    placeholder="Digite o conteúdo da mensagem..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tipo de Alerta</label>
                  <select 
                    value={notificationForm.type}
                    onChange={(e) => setNotificationForm({...notificationForm, type: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                  >
                    <option value="info">ℹ️ Informação (Azul)</option>
                    <option value="success">✅ Sucesso (Verde)</option>
                    <option value="warning">⚠️ Aviso (Amarelo)</option>
                    <option value="error">❌ Erro / Crítico (Vermelho)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Destinatário</label>
                  <select 
                    value={notificationForm.target_type}
                    onChange={(e) => setNotificationForm({...notificationForm, target_type: e.target.value})}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200"
                  >
                    <option value="all">Todos os Usuários</option>
                    <option value="individual">Usuário Específico</option>
                  </select>
                </div>
                {notificationForm.target_type === 'individual' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Selecionar Usuário</label>
                    <select 
                      required
                      value={notificationForm.user_id}
                      onChange={(e) => setNotificationForm({...notificationForm, user_id: e.target.value})}
                      className="w-full px-4 py-2 rounded-xl border border-gray-200"
                    >
                      <option value="">Selecione um usuário...</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name} (@{u.nickname})</option>
                      ))}
                    </select>
                  </div>
                )}
                <button 
                  type="submit" 
                  disabled={sendingNotification}
                  className="w-full bg-primary text-white py-3 rounded-xl font-bold mt-4 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {sendingNotification ? 'Enviando...' : (
                    <>
                      <Send className="w-4 h-4 mr-2" /> Enviar Agora
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-primary">Histórico de Mensagens Enviadas</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {sentNotifications.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 italic">
                    Nenhuma mensagem enviada ainda.
                  </div>
                ) : (
                  sentNotifications.map((n) => (
                    <div key={n.id} className="p-6 hover:bg-gray-50 transition-colors group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          <span className={`w-2 h-2 rounded-full mr-2 ${
                            n.type === 'success' ? 'bg-green-500' : 
                            n.type === 'warning' ? 'bg-yellow-500' : 
                            (n.type === 'alert' || n.type === 'error') ? 'bg-red-500' : 'bg-blue-500'
                          }`} />
                          <h4 className="font-bold text-primary">{n.title}</h4>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-xs text-gray-400">
                            {formatDate(n.created_at, 'dd/MM/yyyy HH:mm')}
                          </span>
                          <button 
                            onClick={() => handleDeleteNotification(n.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Excluir mensagem"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{n.message}</p>
                      <div className="flex items-center text-[10px] font-bold uppercase tracking-wider">
                        <span className="text-gray-400 mr-2">Para:</span>
                        {n.target_type === 'all' ? (
                          <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded">Todos</span>
                        ) : (
                          <span className="bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
                            Individual (ID: {n.user_id})
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'financial' && (() => {
        const totalAdminFee = financials.reduce((acc, f) => acc + (f.admin_fee_collected || 0), 0);
        const totalWithdrawals = financialDetails.withdrawalsHistory.reduce((acc: number, w: any) => acc + w.amount, 0);
        const caixa = totalAdminFee - totalWithdrawals;

        return (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white p-6 rounded-3xl border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Arrecadação</p>
                  <p className="text-2xl font-bold text-primary">R$ {financials.reduce((acc, f) => acc + (f.total_collected || 0), 0).toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-green-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Valor Distribuído (75%)</p>
                  <p className="text-2xl font-bold text-primary">R$ {financials.reduce((acc, f) => acc + (f.winners_prize || 0), 0).toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
                  <Gift className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-gray-800 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Taxa Admin (20%)</p>
                  <p className="text-2xl font-bold text-primary">R$ {totalAdminFee.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-gray-50 text-gray-800 rounded-full flex items-center justify-center">
                  <Wallet className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-orange-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Caixa (Disponível)</p>
                  <p className="text-2xl font-bold text-orange-600">R$ {caixa.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-purple-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Bônus Acumulado Atual</p>
                  <p className="text-2xl font-bold text-purple-600">R$ {financialDetails.jackpotPool.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
              </div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Prizes History */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-primary">Prêmios Pagos</h3>
                <Gift className="w-5 h-5 text-green-500" />
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-4">Rodada</th>
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {financialDetails.prizesHistory.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">Nenhum prêmio registrado ainda.</td>
                      </tr>
                    ) : (
                      financialDetails.prizesHistory.map((p: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 font-bold text-primary">#{p.round_number}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{p.winner_name}</td>
                          <td className="px-6 py-4 text-sm font-bold text-green-600">R$ {p.amount.toFixed(2)}</td>
                          <td className="px-6 py-4 text-xs text-gray-500">{formatDate(p.date, 'dd/MM/yy HH:mm')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Withdrawals */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-primary">Saques Administrativos</h3>
                <button 
                  onClick={() => setShowWithdrawalForm(!showWithdrawalForm)}
                  className="text-xs bg-primary text-white px-3 py-1 rounded-full hover:bg-secondary transition-colors"
                >
                  {showWithdrawalForm ? 'Cancelar' : '+ Novo Saque'}
                </button>
              </div>
              
              {showWithdrawalForm && (
                <div className="p-6 bg-gray-50 border-b border-gray-100">
                  <form onSubmit={handleAddWithdrawal} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={newWithdrawal.amount}
                          onChange={(e) => setNewWithdrawal({...newWithdrawal, amount: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Motivo / Descrição</label>
                        <input 
                          type="text" 
                          required
                          value={newWithdrawal.reason}
                          onChange={(e) => setNewWithdrawal({...newWithdrawal, reason: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                          placeholder="Ex: Pagamento servidor"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-primary text-white font-bold py-2 rounded-xl hover:bg-secondary transition-colors shadow-md">
                      Confirmar Saque
                    </button>
                  </form>
                </div>
              )}

              <div className="overflow-x-auto flex-1 max-h-[400px]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Motivo</th>
                      <th className="px-6 py-4">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {financialDetails.withdrawalsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-8 text-center text-gray-400 italic">Nenhum saque registrado ainda.</td>
                      </tr>
                    ) : (
                      financialDetails.withdrawalsHistory.map((w: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-xs text-gray-500">{formatDate(w.date, 'dd/MM/yy HH:mm')}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{w.reason}</td>
                          <td className="px-6 py-4 text-sm font-bold text-red-600">- R$ {w.amount.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-primary">Histórico por Rodada</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                    <th className="px-6 py-4">Rodada</th>
                    <th className="px-6 py-4">Arrecadação (R$)</th>
                    <th className="px-6 py-4">Distribuído (75%)</th>
                    <th className="px-6 py-4">Taxa Admin (20%)</th>
                    <th className="px-6 py-4">Bônus (5%)</th>
                    <th className="px-6 py-4">Vencedores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {financials.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">#{f.number}</td>
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">R$ {f.total_collected?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 text-sm text-green-600 font-bold">R$ {f.winners_prize?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold">R$ {f.admin_fee_collected?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 text-sm text-purple-600 font-bold">R$ {f.jackpot_contribution?.toFixed(2) || '0.00'}</td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-[200px] truncate" title={f.winners_names}>{f.winners_names || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        );
      })()}

      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-primary">Histórico Completo de Rodadas</h3>
            <History className="w-5 h-5 text-primary" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Rodada</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Início</th>
                  <th className="px-6 py-4">Arrecadação</th>
                  <th className="px-6 py-4">Prêmio Pago</th>
                  <th className="px-6 py-4">Vencedores</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roundHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-400 italic">Nenhuma rodada encontrada.</td>
                  </tr>
                ) : (
                  roundHistory.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-primary">#{r.number}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {r.status === 'open' ? 'Aberta' : 'Finalizada'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(r.start_time, 'dd/MM/yyyy HH:mm')}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-blue-600">
                        R$ {r.total_collected?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-green-600">
                        R$ {r.winners_prize?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-[300px] truncate" title={r.winners_names}>
                        {r.winners_names || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold mb-6">Editar Usuário</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input 
                  type="text" 
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
                <input 
                  type="text" 
                  value={editingUser.nickname}
                  onChange={(e) => setEditingUser({...editingUser, nickname: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input 
                  type="tel" 
                  value={editingUser.phone || ''}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '');
                    if (value.length > 11) value = value.slice(0, 11);
                    if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
                    if (value.length > 10) value = `${value.slice(0, 10)}-${value.slice(10)}`;
                    setEditingUser({...editingUser, phone: value});
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select 
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input 
                  type="text" 
                  value={editingUser.password || ''}
                  onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200"
                  placeholder="Senha do usuário"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-2 bg-gray-100 rounded-xl">Cancelar</button>
                <button type="submit" className="flex-1 py-2 bg-primary text-white rounded-xl font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AnimatePresence>
        {viewingPrediction && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[40px] max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h3 className="text-2xl font-bold text-primary">Palpites de {viewingPrediction.user_nickname}</h3>
                  <p className="text-gray-500">Rodada #{viewingPrediction.round_number}</p>
                </div>
                <button onClick={() => setViewingPrediction(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-3">
                  {viewingPrediction.games?.map((game: any) => {
                    const item = viewingPrediction.items?.find((i: any) => i.game_id === game.id);
                    return (
                      <div key={game.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <div className="flex-1">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Jogo {game.game_order}</p>
                          <p className="font-bold text-primary">{game.team_home} vs {game.team_away}</p>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-center">
                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Palpite</p>
                            <span className="bg-primary text-white px-4 py-1 rounded-full font-bold text-sm">
                              {item?.guess === '1' ? 'Casa' : item?.guess === 'X' ? 'Empate' : 'Fora'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button 
                  onClick={() => setViewingPrediction(null)}
                  className="px-8 py-3 bg-primary text-white rounded-2xl font-bold hover:shadow-lg transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {viewingProof && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
            <motion.div 
              key="proof-modal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white p-4 rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-auto relative"
            >
              <button 
                onClick={() => setViewingProof(null)}
                className="absolute top-4 right-4 bg-gray-100 p-2 rounded-full hover:bg-gray-200"
              >
                <X className="w-6 h-6" />
              </button>
              <h4 className="text-lg font-bold mb-4">Comprovante de Pagamento</h4>
              {viewingProof.toLowerCase().endsWith('.pdf') ? (
                <iframe src={`/${viewingProof}`} className="w-full h-[70vh] rounded-xl" />
              ) : (
                <img src={`/${viewingProof}`} alt="Comprovante" className="w-full rounded-xl" />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TransparencyPage = () => {
  const { token, isAdmin } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [round, setRound] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const fetchRounds = async () => {
      const res = await fetch('/api/rounds');
      const data = await res.json();
      setRounds(data);
      if (data.length > 0) {
        setSelectedRoundId(data[0].id.toString());
      }
    };
    fetchRounds();
  }, []);

  useEffect(() => {
    if (!selectedRoundId) return;

    const fetchData = async () => {
      setLoading(true);
      
      // Check access
      const accessRes = await fetch(`/api/rounds/${selectedRoundId}/check-prediction`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const accessData = await accessRes.json();
      const userHasAccess = accessData.hasPrediction || isAdmin;
      setHasAccess(userHasAccess);

      if (userHasAccess) {
        // Fetch round details including games
        const roundRes = await fetch(`/api/rounds/${selectedRoundId}`);
        const roundData = await roundRes.json();
        setRound(roundData);

        const transRes = await fetch(`/api/rounds/${selectedRoundId}/transparency`);
        if (transRes.ok) {
          const transData = await transRes.json();
          setPredictions(transData);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedRoundId, token, rounds]);

  const downloadPDF = () => {
    if (!hasAccess) return;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text(`BOLÃO10 - Transparência Rodada #${round?.number || ''}`, 14, 20);
    
    doc.setFontSize(11);
    doc.text(`Data de Início: ${formatDate(round?.start_time, 'dd/MM/yyyy HH:mm')}`, 14, 30);
    doc.text(`Status: ${round?.status === 'open' ? 'Aberta' : round?.status === 'finished' ? 'Finalizada' : 'Fechada'}`, 14, 35);
    
    if (round?.status === 'finished') {
      doc.text(`Vencedor(es) Rodada (75%): ${round.winners_names || 'Ninguém'}`, 14, 45);
      doc.text(`Prêmio Rodada Pago: R$ ${round.winners_prize?.toFixed(2) || '0.00'}`, 14, 50);
      
      if (round.jackpot_winners_names) {
        doc.text(`Vencedor(es) Bônus 10: ${round.jackpot_winners_names}`, 14, 60);
        doc.text(`Bônus 10 Pago: R$ ${round.jackpot_prize_paid?.toFixed(2) || '0.00'}`, 14, 65);
      }
    }

    // Games Table
    doc.setFontSize(14);
    doc.text('Lista de Jogos', 14, 65);
    // Note: We might need to fetch games for the selected round if not in 'round' object
    // For now assuming we have them or can fetch them
    const gamesData = round?.games?.map((g: any, i: number) => [
      `Jogo ${i + 1}`,
      `${g.home_team} vs ${g.away_team}`,
      g.result || 'Pendente'
    ]) || [];

    autoTable(doc, {
      head: [['#', 'Confronto', 'Resultado']],
      body: gamesData,
      startY: 70,
      theme: 'grid',
      headStyles: { fillColor: [10, 45, 100] }
    });

    // Predictions Table
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    doc.setFontSize(14);
    doc.text('Palpites dos Usuários', 14, finalY + 15);

    const tableData = predictions.map(p => [
      p.user_name,
      p.score,
      (p.items || []).map((item: any) => item.guess).join(' | ')
    ]);

    autoTable(doc, {
      head: [['Usuário', 'Pontos', 'Palpites (J1-J10)']],
      body: tableData,
      startY: finalY + 20,
      theme: 'striped'
    });

    doc.save(`bolao10-transparencia-rodada-${round?.number || '?'}.pdf`);
  };

  if (loading && rounds.length === 0) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary">Transparência</h2>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-gray-500">Selecione a Rodada:</p>
            <select 
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-secondary"
            >
              {rounds.map(r => (
                <option key={r.id} value={r.id}>Rodada #{r.number}</option>
              ))}
            </select>
          </div>
        </div>
        {hasAccess && (
          <div className="flex items-center gap-4">
            <button 
              onClick={downloadPDF}
              className="flex items-center bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-200 transition-all"
            >
              <Download className="w-4 h-4 mr-2" /> Baixar PDF
            </button>
          </div>
        )}
      </div>

      {!hasAccess ? (
        <div className="bg-white p-12 rounded-[40px] border border-dashed border-gray-200 text-center">
          <ShieldCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary mb-2">Acesso Restrito</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Você só pode visualizar a transparência de rodadas em que possui palpites validados.
          </p>
        </div>
      ) : (
        <>
          {round?.status === 'finished' && (
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-green-50 border border-green-100 rounded-3xl">
                <h3 className="text-lg font-bold text-green-800 mb-2">Prêmio da Rodada (75%)</h3>
                <p className="text-green-700">
                  Vencedor(es): <span className="font-bold">{round.winners_names || 'Ninguém'}</span>
                </p>
                <p className="text-green-700">
                  Prêmio Pago: <span className="font-bold text-green-800">R$ {round.winners_prize?.toFixed(2) || '0.00'}</span>
                </p>
              </div>
              
              {round.jackpot_winners_names && (
                <div className="p-6 bg-secondary bg-opacity-10 border border-secondary border-opacity-20 rounded-3xl">
                  <h3 className="text-lg font-bold text-secondary mb-2">Bônus 10 (Jackpot)</h3>
                  <p className="text-secondary">
                    Vencedor(es): <span className="font-bold">{round.jackpot_winners_names}</span>
                  </p>
                  <p className="text-secondary">
                    Bônus Pago: <span className="font-bold">R$ {round.jackpot_prize_paid?.toFixed(2) || '0.00'}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {predictions.map((p) => (
              <div key={p.id} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-primary">{p.user_name}</h4>
                  {round?.status === 'finished' ? (
                    <span className="bg-secondary text-white px-3 py-1 rounded-full text-xs font-bold">
                      {p.score !== null && p.score !== undefined ? `${p.score} Pontos` : '0 Pontos'}
                    </span>
                  ) : (
                    <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                      Em andamento
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {(p.items || []).map((item: any, i: number) => (
                    <div key={i} className="flex flex-col items-center">
                      <span className="text-[10px] text-gray-400 mb-1">J{i+1}</span>
                      <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-xs font-bold text-primary border border-gray-100">
                        {item.guess}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {predictions.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
                <ShieldCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum palpite aprovado encontrado para esta rodada.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const AdminRoundsPage = () => {
  const { token } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRound, setEditingRound] = useState<any>(null);
  const [partialResults, setPartialResults] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [newRound, setNewRound] = useState({
    number: '',
    startTime: '',
    entryValue: '10',
    games: Array(10).fill({ home: '', away: '' })
  });

  const fetchRounds = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rounds');
      const data = await res.json();
      setRounds(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRounds();
  }, []);

  const handleCreateRound = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/rounds', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newRound)
      });
      if (res.ok) {
        alert('Rodada criada com sucesso!');
        setShowCreateForm(false);
        setNewRound({
          number: '',
          startTime: '',
          entryValue: '10',
          games: Array(10).fill({ home: '', away: '' })
        });
        fetchRounds();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao criar rodada');
      }
    } catch (err) {
      alert('Erro na conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSavePartialResults = async (roundId: number) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}/partial-results`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ results: partialResults })
      });
      if (res.ok) {
        alert('Resultados parciais salvos e ranking atualizado!');
        setEditingRound(null);
        fetchRounds();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao salvar resultados');
      }
    } catch (err) {
      alert('Erro na conexão');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinishRound = async (roundId: number, distributeJackpot: boolean) => {
    if (!confirm('Tem certeza que deseja FINALIZAR esta rodada? Esta ação é irreversível e calculará todos os prêmios.')) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}/finish`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ results: partialResults, distributeJackpot })
      });
      if (res.ok) {
        alert('Rodada finalizada com sucesso!');
        setEditingRound(null);
        fetchRounds();
      } else {
        const data = await res.json();
        alert(data.error || 'Erro ao finalizar rodada');
      }
    } catch (err) {
      alert('Erro na conexão');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && rounds.length === 0) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary">Gerenciar Rodadas</h1>
          <p className="text-gray-500">Crie, edite e finalize as rodadas do bolão.</p>
        </div>
        <button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-primary text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg transition-all flex items-center"
        >
          {showCreateForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
          {showCreateForm ? 'Cancelar' : 'Nova Rodada'}
        </button>
      </div>

      {showCreateForm && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-8 rounded-[32px] border border-gray-100 shadow-sm mb-8"
        >
          <h2 className="text-xl font-bold text-primary mb-6">Configurar Nova Rodada</h2>
          <form onSubmit={handleCreateRound} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Número da Rodada</label>
                <input 
                  type="number" 
                  required 
                  value={newRound.number}
                  onChange={(e) => setNewRound({...newRound, number: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none"
                  placeholder="Ex: 15"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Limite para Palpites</label>
                <input 
                  type="datetime-local" 
                  required 
                  value={newRound.startTime}
                  onChange={(e) => setNewRound({...newRound, startTime: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Valor de Entrada (R$)</label>
                <input 
                  type="number" 
                  required 
                  value={newRound.entryValue}
                  onChange={(e) => setNewRound({...newRound, entryValue: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-4">Jogos da Rodada (10)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {newRound.games.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <span className="text-xs font-bold text-gray-400 w-6">{i + 1}</span>
                    <input 
                      placeholder="Time Mandante" 
                      required 
                      value={g.home}
                      onChange={(e) => {
                        const games = [...newRound.games];
                        games[i] = { ...games[i], home: e.target.value };
                        setNewRound({ ...newRound, games });
                      }}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-secondary"
                    />
                    <span className="text-gray-400 font-bold">x</span>
                    <input 
                      placeholder="Time Visitante" 
                      required 
                      value={g.away}
                      onChange={(e) => {
                        const games = [...newRound.games];
                        games[i] = { ...games[i], away: e.target.value };
                        setNewRound({ ...newRound, games });
                      }}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-secondary"
                    />
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {submitting ? 'Criando...' : 'Criar Rodada e Abrir para Palpites'}
            </button>
          </form>
        </motion.div>
      )}

      <div className="space-y-6">
        {rounds.map((round) => (
          <div key={round.id} className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-xl ${round.status === 'open' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                  #{round.number}
                </div>
                <div>
                  <h3 className="font-bold text-primary text-lg">Rodada {round.number}</h3>
                  <p className="text-sm text-gray-500">
                    {round.status === 'open' ? 'Aberta para palpites' : round.status === 'closed' ? 'Em andamento' : 'Finalizada'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => {
                    if (editingRound?.id === round.id) {
                      setEditingRound(null);
                      return;
                    }
                    const res = await fetch(`/api/rounds/${round.id}`);
                    const data = await res.json();
                    setEditingRound(data);
                    const initialResults: any = {};
                    data.games.forEach((g: any) => {
                      if (g.result) initialResults[g.id] = g.result;
                    });
                    setPartialResults(initialResults);
                  }}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all"
                >
                  {editingRound?.id === round.id ? 'Fechar' : 'Gerenciar Resultados'}
                </button>
                {round.status === 'open' && (
                  <span className="bg-green-100 text-green-600 px-3 py-1 rounded-lg text-xs font-bold uppercase">Ativa</span>
                )}
              </div>
            </div>

            {editingRound?.id === round.id && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="px-6 pb-8 border-t border-gray-50 pt-6"
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-bold text-primary mb-4 flex items-center">
                      <Edit className="w-4 h-4 mr-2" /> Inserir Resultados
                    </h4>
                    <div className="space-y-3">
                      {editingRound.games.map((game: any) => (
                        <div key={game.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-sm font-bold text-primary truncate">{game.home_team} x {game.away_team}</p>
                          </div>
                          <div className="flex gap-1">
                            {['1', 'X', '2'].map(opt => (
                              <button
                                key={opt}
                                onClick={() => setPartialResults({...partialResults, [game.id]: opt})}
                                className={`w-10 h-10 rounded-xl text-sm font-bold transition-all ${partialResults[game.id] === opt ? 'bg-secondary text-white shadow-md' : 'bg-white text-gray-400 border border-gray-100 hover:border-gray-300'}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-primary mb-4">Ações da Rodada</h4>
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                          <p className="text-sm text-blue-800 font-medium mb-2">Resultados Parciais</p>
                          <p className="text-xs text-blue-600 mb-4">Salve os resultados dos jogos que já terminaram para atualizar o ranking parcial em tempo real.</p>
                          <button 
                            onClick={() => handleSavePartialResults(round.id)}
                            disabled={submitting}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50"
                          >
                            Salvar Parciais e Atualizar Ranking
                          </button>
                        </div>

                        {round.status !== 'finished' && (
                          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                            <p className="text-sm text-red-800 font-medium mb-2">Finalizar Rodada</p>
                            <p className="text-xs text-red-600 mb-4">Encerra a rodada definitivamente, calcula os prêmios e distribui os saldos para os vencedores.</p>
                            
                            <div className="flex items-center gap-2 mb-4">
                              <input 
                                type="checkbox" 
                                id={`jackpot-${round.id}`}
                                className="w-4 h-4 text-red-600"
                                onChange={(e) => (window as any).distributeJackpot = e.target.checked}
                              />
                              <label htmlFor={`jackpot-${round.id}`} className="text-xs font-bold text-red-800">Distribuir Bônus Acumulado</label>
                            </div>

                            <button 
                              onClick={() => handleFinishRound(round.id, (window as any).distributeJackpot)}
                              disabled={submitting}
                              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                              Finalizar e Pagar Prêmios
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={() => setEditingRound(null)}
                      className="mt-8 text-gray-400 hover:text-gray-600 text-sm font-bold underline"
                    >
                      Fechar Painel de Gerenciamento
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const RankingPage = () => {
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [ranking, setRanking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRounds = async () => {
      const res = await fetch('/api/rounds');
      const data = await res.json();
      setRounds(data);
      if (data.length > 0) {
        setSelectedRoundId(data[0].id.toString());
      }
    };
    fetchRounds();
  }, []);

  useEffect(() => {
    if (!selectedRoundId) return;
    const fetchRanking = async () => {
      setLoading(true);
      const res = await fetch(`/api/rounds/${selectedRoundId}/transparency`);
      if (res.ok) {
        const data = await res.json();
        // Sort by score descending
        const sorted = data.sort((a: any, b: any) => b.score - a.score);
        setRanking(sorted);
      }
      setLoading(false);
    };
    fetchRanking();
  }, [selectedRoundId]);

  if (loading && rounds.length === 0) return <div className="p-8">Carregando...</div>;

  const selectedRound = rounds.find(r => r.id.toString() === selectedRoundId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary">Ranking</h2>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-gray-500">Selecione a Rodada:</p>
            <select 
              value={selectedRoundId}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="bg-white border border-gray-200 rounded-xl px-3 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-secondary"
            >
              {rounds.map(r => (
                <option key={r.id} value={r.id}>Rodada #{r.number}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
              <th className="px-8 py-5">Posição</th>
              <th className="px-8 py-5">Usuário</th>
              <th className="px-8 py-5 text-right">Pontuação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {ranking.map((item, index) => (
              <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' : 
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' : 'text-gray-400'
                  }`}>
                    {index + 1}º
                  </div>
                </td>
                <td className="px-8 py-5 font-bold text-primary">{item.user_name}</td>
                <td className="px-8 py-5 text-right">
                  <div className="flex flex-col items-end">
                    <span className={`${selectedRound?.status === 'finished' ? 'bg-secondary text-white' : 'bg-blue-100 text-blue-700'} px-4 py-1 rounded-full font-bold`}>
                      {item.score !== null && item.score !== undefined ? `${item.score} pts` : '0 pts'}
                    </span>
                    {selectedRound?.status !== 'finished' && (
                      <span className="text-[10px] font-bold text-blue-500 uppercase mt-1">Parcial</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {ranking.length === 0 && !loading && (
              <tr>
                <td colSpan={3} className="px-8 py-20 text-center text-gray-500">
                  Nenhum resultado disponível para esta rodada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const TermsPage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-gray-100"
      >
        <h1 className="text-4xl font-bold text-primary mb-8">Termos de Uso e Regras – BOLÃO10</h1>
        
        <div className="prose prose-slate max-w-none space-y-8 text-gray-600 leading-relaxed">
          <p>
            Bem-vindo ao BOLÃO10. Esta é uma plataforma privada de entretenimento esportivo, criada para promover a interação e a competição saudável entre participantes. Ao utilizar nosso sistema, você concorda com as diretrizes descritas abaixo, que visam garantir a total transparência e justiça para todos os membros.
          </p>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">1. Dinâmica da Participação</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>A Rodada:</strong> O BOLÃO10 baseia-se em 10 partidas de futebol selecionadas do Campeonato Brasileiro.</li>
              <li><strong>O Palpite:</strong> Para cada partida, o usuário deve prognosticar um dos três resultados possíveis: Vitória do Time 1, Empate ou Vitória do Time 2.</li>
              <li><strong>Validade:</strong> A participação só será considerada ativa após a realização do pagamento via PIX (chave: admin@bolao10.com), o envio do comprovante pelo sistema e a validação manual pelo administrador.</li>
              <li><strong>Prazo:</strong> As apostas devem ser enviadas até o limite estipulado pelo sistema (geralmente 1 hora antes do início da primeira partida da rodada).</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">2. Divisão da Arrecadação (Premiação)</h2>
            <p className="mb-4">A transparência é o nosso pilar. Todo o valor arrecadado em uma rodada é dividido estritamente da seguinte forma:</p>
            <ul className="list-disc pl-5 space-y-4">
              <li>
                <strong>75% – Prêmio da Rodada:</strong> Distribuído entre o(s) participante(s) que obtiver(em) o maior número de acertos na rodada. Em caso de empate entre dois ou mais participantes, o valor é dividido igualmente entre eles.
              </li>
              <li>
                <strong>20% – Taxa de Gestão:</strong> Destinado à manutenção, custos operacionais e administração da plataforma.
              </li>
              <li>
                <strong>5% – Bônus Acumulado:</strong> Destinado a um "Pote Acumulado".
                <ul className="list-circle pl-5 mt-2 space-y-1">
                  <li>Este bônus será pago integralmente ao usuário que acertar os 10 jogos (Gabarito).</li>
                  <li>Caso mais de uma pessoa acerte os 10 jogos, o bônus é dividido entre elas.</li>
                  <li>Caso ninguém acerte os 10 jogos, o valor de 5% permanece acumulado para a rodada seguinte, crescendo o pote até que alguém consiga o feito.</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">3. Validação e Transparência</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Confirmação:</strong> A responsabilidade pelo envio do comprovante é do participante. Sem o envio e a validação do administrador, o palpite não entra no cálculo da rodada.</li>
              <li><strong>Transparência:</strong> Após o início da rodada, a lista de palpites de todos os usuários validados será publicada na área "Ranking de Transparência", permitindo que todos confiram os resultados dos demais participantes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Regras Gerais e Conduta</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Não comercialização:</strong> O BOLÃO10 não é uma casa de apostas. Trata-se de um bolão colaborativo entre amigos e conhecidos.</li>
              <li><strong>Imprevistos:</strong> Caso uma partida seja cancelada ou adiada por tempo indeterminado pela CBF, a partida será considerada "anulada" para fins de pontuação, e o cálculo da rodada será feito com base nas partidas restantes.</li>
              <li><strong>Decisão Administrativa:</strong> O Administrador do sistema possui a palavra final em casos de conflitos técnicos ou interpretação de resultados, sempre zelando pela boa-fé e transparência da comunidade.</li>
            </ul>
          </section>

          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mt-12">
            <p className="text-blue-800 font-medium">
              <strong>Importante:</strong> A participação no BOLÃO10 deve ser encarada como uma forma de entretenimento. Jogue com responsabilidade e aproveite a emoção do futebol.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [page, setPage] = useState('landing');
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (isAuthenticated && page === 'landing') setPage('dashboard');
  }, [isAuthenticated]);

  const renderPage = () => {
    switch (page) {
      case 'landing': return <LandingPage onNavigate={setPage} />;
      case 'login': return <LoginPage onNavigate={setPage} />;
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'wallet': return <WalletPage onNavigate={setPage} />;
      case 'profile': return <ProfilePage onNavigate={setPage} />;
      case 'predictions': return <PredictionsPage onNavigate={setPage} />;
      case 'admin': return isAdmin ? <AdminDashboard /> : <Dashboard onNavigate={setPage} />;
      case 'admin-rounds': return isAdmin ? <AdminRoundsPage /> : <Dashboard onNavigate={setPage} />;
      case 'transparency': return <TransparencyPage />;
      case 'ranking': return <RankingPage />;
      case 'terms': return <TermsPage />;
      default: return <LandingPage onNavigate={setPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar onNavigate={setPage} currentPage={page} />
      <main className="flex-grow">
        <AnimatePresence mode="wait">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-500">© 2026 BOLÃO10 - Entretenimento baseado em conhecimento esportivo.</p>
          <p className="text-xs text-gray-400 mt-2">Plataforma transparente e auditável entre amigos.</p>
          <div className="mt-4 flex justify-center items-center space-x-4">
            <span className="text-gray-400 text-xs font-medium">Contato:</span>
            <a href="mailto:admin@bolao10.com" className="text-gray-500 hover:text-primary transition-colors flex items-center text-sm" title="admin@bolao10.com">
              <Mail className="w-5 h-5" />
            </a>
            <a href="https://wa.me/5521989886916" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-green-600 transition-colors flex items-center text-sm" title="(21) 98988-6916">
              <MessageCircle className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
