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
  ChevronUp,
  PlusCircle,
  MinusCircle,
  XCircle,
  Users,
  ArrowUpCircle,
  ArrowDownCircle,
  Landmark,
  Ticket
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download } from 'lucide-react';
import QRCode from 'react-qr-code';
import { generatePixPayload } from './utils/pix';
import { DepositModal } from './components/DepositModal';
import { PagBankCheckout } from './components/PagBankCheckout';
import { PromoPopup } from './components/PromoPopup';
import { Toaster, toast } from 'sonner';

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

export const safeJson = async (res: Response) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch (e) {
    console.error(`JSON parse error for ${res.url}. Status: ${res.status}. Text: ${text.substring(0, 200)}`);
    throw new Error(`Invalid JSON response from ${res.url}`);
  }
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
              
              // Show toast notification only for new notifications
              // We do this inside a setTimeout to avoid React state update warnings
              setTimeout(() => {
                if (newNotif.msgType === 'success') {
                  toast.success(newNotif.title || 'Sucesso', { description: newNotif.message });
                } else if (newNotif.msgType === 'error') {
                  toast.error(newNotif.title || 'Erro', { description: newNotif.message });
                } else if (newNotif.msgType === 'warning') {
                  toast.warning(newNotif.title || 'Aviso', { description: newNotif.message });
                } else {
                  toast.info(newNotif.title || 'Nova Notificação', { description: newNotif.message });
                }

                // Optional: Play a sound or show a browser notification
                if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(newNotif.title, { body: newNotif.message });
                }
              }, 0);

              return updated;
            });

            // Dispatch custom event for other components to react
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('new_notification', { detail: newNotif }));
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
    { id: 'referral', label: 'Indique e Ganhe', icon: Users, show: !!user && !isAdmin },
    { id: 'transparency', label: 'Transparência', icon: ShieldCheck, show: !!user },
    { id: 'ranking', label: 'Ranking', icon: BarChart2, show: !!user },
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
            A plataforma de palpites de futebol focada em conhecimento e transparência. Sem algoritmos, sem truques.
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
            { title: 'Bônus Acumulado', desc: 'Acerte os 10 resultados e leve o pote acumulado do Bônus 10 + 01 Game Stick M15.', icon: CheckCircle2 },
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
        
        <div className="mt-32 pt-12 border-t border-gray-100 flex flex-col items-center gap-6">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Parceiro Oficial de Pagamentos</p>
          <div className="flex items-center gap-6 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500">
            <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-8" referrerPolicy="no-referrer" />
            <div className="h-10 w-[1px] bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Ambiente</span>
              <span className="text-sm font-bold text-green-600 uppercase tracking-wider">100% Seguro</span>
            </div>
          </div>
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
  const [referralCodeInput, setReferralCodeInput] = useState(localStorage.getItem('referredBy') || '');
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
    const referralCode = isRegister ? referralCodeInput : null;
    const body = isRegister 
      ? { email, password, name, nickname, phone, referralCode } 
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        if (isRegister) {
          localStorage.removeItem('referredBy');
        }
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Código de Indicação (Opcional)</label>
                <input 
                  type="text" 
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-secondary focus:border-transparent outline-none transition-all uppercase"
                  placeholder="Ex: 50969B51"
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

        <div className="mt-8 text-center space-y-6">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-gray-500 hover:text-secondary transition-colors"
          >
            {isRegister ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
          </button>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-center gap-3 grayscale opacity-50">
            <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-4" referrerPolicy="no-referrer" />
            <div className="h-4 w-[1px] bg-gray-200"></div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ambiente Seguro</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const getTransactionIcon = (type: string, amount: number, description: string = '') => {
  if (type === 'prize_credit' && description.toLowerCase().includes('indicação')) return <Gift className="w-5 h-5" />;
  
  switch (type) {
    case 'deposit': return <ArrowDownCircle className="w-5 h-5" />;
    case 'withdrawal': return <ArrowUpCircle className="w-5 h-5" />;
    case 'bet_deduction': return <Trophy className="w-5 h-5" />;
    case 'prize_credit': return <Trophy className="w-5 h-5" />;
    case 'admin_adjustment': return <ShieldCheck className="w-5 h-5" />;
    default: return amount > 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />;
  }
};

const getTransactionColor = (type: string, amount: number, description: string = '') => {
  if (type === 'prize_credit' && description.toLowerCase().includes('indicação')) return 'bg-purple-100 text-purple-600';

  switch (type) {
    case 'deposit': return 'bg-green-100 text-green-600';
    case 'withdrawal': return 'bg-red-100 text-red-600';
    case 'bet_deduction': return 'bg-orange-100 text-orange-600';
    case 'prize_credit': return 'bg-yellow-100 text-yellow-600';
    case 'admin_adjustment': return 'bg-blue-100 text-blue-600';
    default: return amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600';
  }
};

const getTransactionLabel = (type: string, description: string = '') => {
  if (type === 'prize_credit' && description.toLowerCase().includes('indicação')) return 'Bônus de Indicação';

  switch (type) {
    case 'deposit': return 'Depósito';
    case 'withdrawal': return 'Saque';
    case 'bet_deduction': return 'Taxa de Palpite';
    case 'prize_credit': return 'Prêmio';
    case 'admin_adjustment': return 'Ajuste Admin';
    default: return 'Transação';
  }
};

const WalletPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token, user } = useAuth();
  const [walletData, setWalletData] = useState<any>(null);
  const [myPredictions, setMyPredictions] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [expandedPrediction, setExpandedPrediction] = useState<number | null>(null);
  const [filterRound, setFilterRound] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const fetchWallet = async () => {
    if (!token) return;
    try {
      // Sync pending PagBank deposits first
      try {
        await fetch('/api/pagbank/sync-pending', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } catch (e) {
        console.error('Failed to sync pending deposits');
      }

      const [walletRes, predRes, balanceRes, transRes] = await Promise.all([
        fetch('/api/my-wallet', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/my-predictions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/wallet/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/wallet/transactions', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (!walletRes.ok || !predRes.ok) throw new Error('Falha ao carregar resumo financeiro');
      
      const wData = await safeJson(walletRes);
      const pData = await safeJson(predRes);
      const bData = await safeJson(balanceRes);
      const tData = await safeJson(transRes);
      
      setWalletData(wData);
      setMyPredictions(pData);
      setBalance(bData?.balance || 0);
      setTransactions(tData || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();

    const handleNewNotification = (e: any) => {
      const notif = e.detail;
      if (notif && notif.id && (
        notif.id.startsWith('dep-app-') || 
        notif.id.startsWith('dep-paid-') || 
        notif.id.startsWith('dep-rej-') ||
        notif.id.startsWith('withdraw-app-') ||
        notif.id.startsWith('withdraw-rej-')
      )) {
        fetchWallet();
      }
    };

    window.addEventListener('new_notification', handleNewNotification);
    return () => {
      window.removeEventListener('new_notification', handleNewNotification);
    };
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

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) return toast.error('Valor inválido');
    if (amount > balance) return toast.error('Saldo insuficiente');
    if (!pixKey.trim()) return toast.error('Chave PIX é obrigatória');

    setWithdrawing(true);
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount, pixKey })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Pedido de saque enviado com sucesso!');
        setIsWithdrawModalOpen(false);
        setWithdrawAmount('');
        setPixKey('');
        fetchWallet();
      } else {
        toast.error(data.error || 'Erro ao solicitar saque');
      }
    } catch (err) {
      toast.error('Erro na conexão');
    } finally {
      setWithdrawing(false);
    }
  };

  const filteredPredictions = myPredictions.filter(p => {
    const matchRound = filterRound === 'all' || p.round_number.toString() === filterRound;
    const matchStatus = filterStatus === 'all' || p.status === filterStatus;
    return matchRound && matchStatus;
  });

  const availableRounds = [...new Set(myPredictions.map(p => Number(p.round_number)))].sort((a: number, b: number) => b - a);

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
        <div className="hidden sm:flex items-center gap-3 bg-white/10 px-4 py-1.5 rounded-full backdrop-blur-sm border border-white/10">
          <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-4 brightness-0 invert opacity-80" referrerPolicy="no-referrer" />
          <div className="h-4 w-[1px] bg-white/20"></div>
          <span className="text-[10px] font-bold text-white/80 uppercase tracking-widest">Ambiente Seguro</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 border border-gray-100 text-white shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white/80 font-medium">Saldo Disponível</h3>
                  <Wallet className="w-5 h-5 text-white" />
                </div>
                <p className="text-3xl font-bold mb-4">
                  R$ {balance.toFixed(2)}
                </p>
              </div>
              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={() => setIsDepositModalOpen(true)}
                  className="flex-1 bg-white text-primary font-bold py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Depositar
                </button>
                <button 
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="flex-1 bg-primary-dark border border-white/20 text-white font-bold py-2 rounded-xl hover:bg-white/10 transition-colors"
                >
                  Sacar
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-500 font-medium">Total Ganho</h3>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-green-600">
                  R$ {walletData?.totalWinnings?.toFixed(2) || '0.00'}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-500 font-medium">Palpites Feitos</h3>
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {walletData?.predictionsMade || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-orange-800 font-medium">Depósitos Pendentes</h3>
                  <Clock className="w-5 h-5 text-orange-500" />
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  R$ {(walletData?.pendingDeposits?.reduce((acc: number, d: any) => acc + d.amount, 0) || 0).toFixed(2)}
                </p>
                <p className="text-sm text-orange-700 mt-2">
                  {walletData?.pendingDeposits?.length || 0} solicitação(ões) em análise
                </p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-blue-800 font-medium">Saques Pendentes</h3>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  R$ {(walletData?.pendingWithdrawals?.reduce((acc: number, d: any) => acc + Math.abs(d.amount), 0) || 0).toFixed(2)}
                </p>
                <p className="text-sm text-blue-700 mt-2">
                  {walletData?.pendingWithdrawals?.length || 0} solicitação(ões) em análise
                </p>
              </div>
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
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
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

        {walletData?.pendingDeposits?.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
            <h3 className="text-xl font-bold text-orange-600 mb-6 flex items-center">
              <Clock className="w-5 h-5 mr-2" /> Depósitos em Análise
            </h3>
            <div className="space-y-4">
              {walletData.pendingDeposits.map((d: any) => (
                <div key={d.id} className="p-4 bg-orange-50 border border-orange-100 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-orange-100 text-orange-600">
                      <ArrowDownCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-orange-800">Depósito via PIX</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-orange-100 text-orange-700">Pendente</span>
                      </div>
                      <p className="text-xs text-orange-500 mt-1">Solicitado em: {formatDate(d.created_at, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-600">R$ {d.amount.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {walletData?.pendingWithdrawals?.length > 0 && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
            <h3 className="text-xl font-bold text-blue-600 mb-6 flex items-center">
              <Clock className="w-5 h-5 mr-2" /> Saques em Análise
            </h3>
            <div className="space-y-4">
              {walletData.pendingWithdrawals.map((w: any) => (
                <div key={w.id} className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-600">
                      <ArrowUpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-blue-800">Saque PIX</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-blue-100 text-blue-700">Pendente</span>
                      </div>
                      <p className="text-sm text-blue-600 mt-0.5">Chave: {w.reference_id?.replace('pending_', '')}</p>
                      <p className="text-xs text-blue-500 mt-0.5">Solicitado em: {formatDate(w.created_at, 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">R$ {Math.abs(w.amount).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 mb-8">
          <h3 className="text-xl font-bold text-primary mb-6 flex items-center">
            <History className="w-5 h-5 mr-2" /> Extrato da Carteira
          </h3>
          <div className="space-y-4">
            {transactions.length > 0 ? transactions.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-2xl bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getTransactionColor(tx.type, tx.amount, tx.description)}`}>
                    {getTransactionIcon(tx.type, tx.amount, tx.description)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900">{tx.description}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getTransactionColor(tx.type, tx.amount, tx.description)}`}>
                        {getTransactionLabel(tx.type, tx.description)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(tx.created_at, 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {tx.amount > 0 ? '+' : ''}R$ {Math.abs(tx.amount).toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">Saldo: R$ {tx.balance_after.toFixed(2)}</p>
                </div>
              </div>
            )) : (
              <p className="text-gray-500 text-center py-4">Nenhuma transação encontrada.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-bold text-primary flex items-center">
              <History className="w-5 h-5 mr-2" /> Histórico de Palpites
            </h3>
            
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Rodada:</label>
                <select 
                  value={filterRound}
                  onChange={(e) => setFilterRound(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Todas</option>
                  {availableRounds.map(r => (
                    <option key={r} value={r.toString()}>#{r}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Status:</label>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {filteredPredictions.length > 0 ? filteredPredictions.map((pred) => (
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
                                      <span className={`font-medium ${guess === '1' ? 'text-primary' : 'text-gray-600'}`}>{game.home_team}</span>
                                      <span className="text-gray-300 mx-2">x</span>
                                      <span className={`font-medium ${guess === '2' ? 'text-primary' : 'text-gray-600'}`}>{game.away_team}</span>
                                    </div>
                                  </div>
                                  <div className="ml-4 flex items-center space-x-2">
                                    <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                                      {guess === '1' ? 'Casa' : guess === '2' ? 'Fora' : 'Empate'}
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
              <p className="text-gray-500 text-center py-8">Nenhum palpite encontrado para os filtros selecionados.</p>
            )}
          </div>
        </div>
      </main>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        token={token}
        onDepositSuccess={() => {
          setIsDepositModalOpen(false);
          fetchWallet();
        }}
      />

      {isWithdrawModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Solicitar Saque</h3>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Saque (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  max={balance}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="0.00"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Saldo disponível: R$ {balance.toFixed(2)}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chave PIX</label>
                <input
                  type="text"
                  value={pixKey}
                  onChange={e => setPixKey(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={withdrawing || !withdrawAmount || !pixKey}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 mt-6"
              >
                {withdrawing ? 'Processando...' : 'Confirmar Saque'}
              </button>
            </form>
          </div>
        </div>
      )}
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
  const { token, user, logout } = useAuth();
  const [currentRound, setCurrentRound] = useState<any>(null);
  const [myPredictions, setMyPredictions] = useState<any[]>([]);
  const [luckyNumbers, setLuckyNumbers] = useState<any[]>([]);
  const [walletData, setWalletData] = useState<any>(null);
  const [balance, setBalance] = useState<number>(0);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPrediction, setExpandedPrediction] = useState<string | null>(null);

  const fetchData = async () => {
    if (!token) return;
    try {
      const [roundRes, predRes, walletRes, balanceRes, luckyRes] = await Promise.all([
        fetch('/api/rounds/current'),
        fetch('/api/my-predictions', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/my-wallet', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/wallet/balance', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/me/lucky-numbers', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (roundRes.status === 401 || predRes.status === 401 || walletRes.status === 401 || luckyRes.status === 401) {
        logout();
        return;
      }

      if (!roundRes.ok) {
        const errorData = await safeJson(roundRes).catch(() => ({}));
        throw new Error(`Erro ao carregar rodada: ${errorData?.error || roundRes.statusText}`);
      }
      if (!predRes.ok) {
        const errorData = await safeJson(predRes).catch(() => ({}));
        throw new Error(`Erro ao carregar palpites: ${errorData?.error || predRes.statusText}`);
      }
      if (!walletRes.ok) {
        const errorData = await safeJson(walletRes).catch(() => ({}));
        throw new Error(`Erro ao carregar carteira: ${errorData?.error || walletRes.statusText}`);
      }

      const roundData = await safeJson(roundRes);
      const predData = await safeJson(predRes);
      const walletData = await safeJson(walletRes);
      const balanceData = await safeJson(balanceRes).catch(() => ({ balance: 0 }));
      const luckyData = await safeJson(luckyRes).catch(() => []);
      
      setCurrentRound(roundData);
      setMyPredictions(Array.isArray(predData) ? predData : []);
      setWalletData(walletData);
      setBalance(balanceData?.balance || 0);
      setLuckyNumbers(Array.isArray(luckyData) ? luckyData : []);
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleNewNotification = (e: any) => {
      const notif = e.detail;
      if (notif && notif.id && (
        notif.id.startsWith('dep-app-') || 
        notif.id.startsWith('dep-rej-') ||
        notif.id.startsWith('withdraw-app-') ||
        notif.id.startsWith('withdraw-rej-')
      )) {
        fetchData();
      }
    };

    window.addEventListener('new_notification', handleNewNotification);
    return () => {
      window.removeEventListener('new_notification', handleNewNotification);
    };
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
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Olá, {user?.nickname || user?.name}! 👋</h1>
          <p className="text-gray-500">Bem-vindo de volta ao Bolão10.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 h-[48px]">
            <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-6" referrerPolicy="no-referrer" />
            <div className="h-8 w-[1px] bg-gray-200"></div>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Ambiente</span>
              <span className="text-xs font-bold text-green-600 uppercase tracking-wider">100% Seguro</span>
            </div>
          </div>
          <a 
            href="https://chat.whatsapp.com/LWJCq74sKbvGav8mYX6Kx7?mode=gi_t" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] text-white px-4 py-2 rounded-2xl font-bold hover:bg-[#128C7E] transition-all shadow-sm hover:shadow-md w-fit h-[48px]"
          >
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            Entrar no Grupo
          </a>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Lucky Numbers Banner */}
          {luckyNumbers.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-gradient-to-r from-primary via-blue-900 to-primary text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary opacity-10 rounded-full -ml-24 -mb-24 pointer-events-none"></div>
              
              <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                <div className="shrink-0 relative group">
                  <div className="absolute -inset-4 bg-secondary/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <img 
                    src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/Game_Stick.webp" 
                    alt="Game Stick M15" 
                    className="w-24 h-24 object-contain drop-shadow-2xl hover:scale-110 transition-transform"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute bottom-0 right-0 bg-yellow-400 text-primary font-black px-1.5 py-0.5 rounded text-[8px] border border-primary">
                    M15 PRO
                  </div>
                </div>
                
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 mb-1 justify-center sm:justify-start">
                    <Trophy className="w-4 h-4 text-yellow-400 drop-shadow-sm" />
                    <span className="text-yellow-400 font-black text-[10px] tracking-widest uppercase drop-shadow-sm">Promoção Especial</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black mb-2 leading-tight tracking-tighter italic">
                    SORTEIO DIA 19/07
                  </h2>
                  <p className="text-white/70 text-xs mb-4 max-w-sm">
                    Ganhe CUPONS para concorrer ao GAME STICK M15 a cada palpite!
                  </p>
                  <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
                    <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest mr-1">Seus Cupons:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {luckyNumbers.slice(0, 6).map((num, i) => (
                        <span key={i} className="bg-white/20 px-2 py-1 rounded-lg font-mono font-bold text-xs border border-white/10">
                          {num.number}
                        </span>
                      ))}
                      {luckyNumbers.length > 6 && (
                        <span className="text-[10px] font-bold text-secondary">
                          +{luckyNumbers.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Wallet Summary */}
          {walletData && (
            <div className="space-y-4">
              {/* Prominent Wallet Card */}
              <div className="bg-primary rounded-3xl p-6 md:p-8 text-white shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-white opacity-5 rounded-full -ml-10 -mb-10 pointer-events-none"></div>
                
                <div className="relative z-10 flex items-center gap-6 w-full md:w-auto">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                    <Wallet className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 font-medium mb-1">Saldo em Carteira</p>
                    <h2 className="text-4xl font-bold tracking-tight">R$ {balance.toFixed(2)}</h2>
                  </div>
                </div>
                
                <div className="relative z-10 flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <button
                    onClick={() => setIsDepositModalOpen(true)}
                    className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#128C7E] transition-all shadow-md hover:shadow-lg"
                  >
                    <PlusCircle className="w-5 h-5" />
                    Depositar Agora
                  </button>
                  <button
                    onClick={() => onNavigate('wallet')}
                    className="flex items-center justify-center gap-2 bg-white/10 text-white px-6 py-4 rounded-2xl font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
                  >
                    Ver Extrato
                  </button>
                </div>
              </div>

              {/* Other Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-green-100 font-medium mb-1">Total Ganho</p>
                    <p className="text-2xl font-bold">R$ {walletData.totalWinnings?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-3xl p-6 text-white shadow-md flex items-center justify-between">
                  <div>
                    <p className="text-amber-100 font-medium mb-1">Bônus 10 Acertos</p>
                    <p className="text-2xl font-bold">R$ {walletData?.jackpotPool?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-white" />
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
                          <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-gray-700">Seus Palpites</h4>
                            {pred.lucky_number && (
                              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100">
                                <Ticket className="w-4 h-4 text-primary" />
                                <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mr-1">Cupom Sorteio:</span>
                                <span className="font-mono font-bold text-primary">{pred.lucky_number}</span>
                              </div>
                            )}
                          </div>
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
                                        <span className={`font-medium ${guess === '1' ? 'text-primary' : 'text-gray-600'}`}>{game.home_team}</span>
                                        <span className="text-gray-300 mx-2">x</span>
                                        <span className={`font-medium ${guess === '2' ? 'text-primary' : 'text-gray-600'}`}>{game.away_team}</span>
                                      </div>
                                    </div>
                                    <div className="ml-4 flex items-center space-x-2">
                                      <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded text-gray-600">
                                        {guess === '1' ? 'Casa' : guess === '2' ? 'Fora' : 'Empate'}
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
              onClick={() => onNavigate('ranking')}
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
                <div>
                  <strong>Adicione Saldo:</strong> Deposite em sua carteira via PIX ou Cartão através do PagBank de forma segura.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">2</div>
                <div>
                  <strong>Palpites:</strong> Escolha os resultados. Cada palpite custa R$ {currentRound?.entry_value.toFixed(2) || '10,00'}.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">3</div>
                <div>
                  <strong>Prêmios:</strong> 75% da arrecadação vai para os vencedores. 5% vai para o pote acumulado dos 10 acertos!
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">4</div>
                <div>
                  <strong>Indique e Ganhe:</strong> Ganhe R$ 2,00 por cada amigo que depositar R$ 10,00 ou mais usando seu link.
                </div>
              </li>
              <li className="flex items-start">
                <div className="w-5 h-5 bg-secondary bg-opacity-10 text-secondary rounded-full flex items-center justify-center mr-3 mt-0.5 font-bold text-xs">5</div>
                <div>
                  <strong>Sorteio M15:</strong> Cada palpite registrado gera um cupom para o sorteio do Game Stick M15 em 19/07!
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        token={token}
        onDepositSuccess={() => {
          setIsDepositModalOpen(false);
          fetchData();
        }}
      />
    </div>
  );
};

const PredictionsPage = ({ onNavigate }: { onNavigate: (page: string) => void }) => {
  const { token, user } = useAuth();
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

  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('bolao10_predictions_list', JSON.stringify(predictionsList));
  }, [predictionsList]);

  useEffect(() => {
    localStorage.setItem('bolao10_prediction_step', step.toString());
  }, [step]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDeadlinePopup, setShowDeadlinePopup] = useState(false);
  const [luckyNumbers, setLuckyNumbers] = useState<any[]>([]);
  const [showLuckyNumberPopup, setShowLuckyNumberPopup] = useState(false);
  const [lastLuckyNumbers, setLastLuckyNumbers] = useState<string[]>([]);

  const fetchWalletBalance = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/wallet/balance', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.balance || 0);
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  useEffect(() => {
    fetchWalletBalance();

    const handleNewNotification = (e: any) => {
      const notif = e.detail;
      if (notif && notif.id && (
        notif.id.startsWith('dep-app-') || 
        notif.id.startsWith('dep-rej-') ||
        notif.id.startsWith('withdraw-app-') ||
        notif.id.startsWith('withdraw-rej-')
      )) {
        fetchWalletBalance();
      }
    };

    window.addEventListener('new_notification', handleNewNotification);
    return () => {
      window.removeEventListener('new_notification', handleNewNotification);
    };
  }, [token]);

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
          localStorage.removeItem('bolao10_predictions_list');
          localStorage.removeItem('bolao10_prediction_step');
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

  const handleAddPrediction = () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    if (Object.keys(guesses).length < 10) {
      return alert('Por favor, complete todos os 10 palpites antes de adicionar outro.');
    }
    
    setPredictionsList(prev => [...prev, guesses]);
    setGuesses({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToPayment = () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    
    if (Object.keys(guesses).length === 10) {
      setPredictionsList(prev => [...prev, guesses]);
      setGuesses({});
      setStep(2);
    } else if (predictionsList.length > 0) {
      setStep(2);
    } else {
      alert('Complete seu palpite antes de prosseguir.');
    }
  };

  const totalAmount = (predictionsList.length) * (round?.entry_value || 10);

  const handleSubmit = async () => {
    if (round && round.start_time && new Date() > (parseDate(round.start_time) || new Date(0))) {
      setShowDeadlinePopup(true);
      return;
    }
    
    if (walletBalance < totalAmount) {
      alert('Saldo insuficiente. Por favor, deposite fundos na sua carteira.');
      setIsDepositModalOpen(true);
      return;
    }

    setSubmitting(true);
    
    const formData = new FormData();
    formData.append('roundId', round.id.toString());
    formData.append('guesses', JSON.stringify(predictionsList));

    try {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setLastLuckyNumbers(data.luckyNumbers || []);
        setShowLuckyNumberPopup(true);
        localStorage.removeItem('bolao10_predictions_list');
        localStorage.removeItem('bolao10_prediction_step');
        setPredictionsList([]);
        setStep(1);
        // onNavigate('wallet'); // Don't navigate yet, show popup first
      } else {
        alert(data.error || 'Erro ao salvar palpites');
      }
    } catch (err) {
      alert('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;
  if (!round || round.status !== 'open') return <div className="text-center py-20">Nenhuma rodada aberta no momento.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold text-primary">Rodada #{round.number}</h2>
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm w-fit">
          <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-4" referrerPolicy="no-referrer" />
          <div className="h-4 w-[1px] bg-gray-200"></div>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ambiente Seguro</span>
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
                    localStorage.removeItem('bolao10_predictions_list');
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
            <h3 className="text-xl font-bold text-primary mb-4">Confirmar Palpites</h3>
            <p className="text-gray-600 mb-6">
              Você está prestes a validar {predictionsList.length} palpite(s). O valor total de <span className="font-bold text-primary">R$ {totalAmount.toFixed(2)}</span> será debitado da sua carteira.
            </p>

            <div className="bg-gray-50 p-6 rounded-2xl mb-8 max-w-md mx-auto border border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Saldo Atual:</span>
                <span className="font-bold text-lg text-gray-900">R$ {walletBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600">Valor a Pagar:</span>
                <span className="font-bold text-lg text-red-600">- R$ {totalAmount.toFixed(2)}</span>
              </div>
              <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                <span className="text-gray-900 font-medium">Saldo Final:</span>
                <span className={`font-bold text-xl ${walletBalance >= totalAmount ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {(walletBalance - totalAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {walletBalance < totalAmount && (
              <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-start text-left">
                <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1">Saldo Insuficiente</p>
                  <p className="text-sm">Você precisa adicionar fundos à sua carteira para confirmar estes palpites.</p>
                  <button 
                    onClick={() => setIsDepositModalOpen(true)}
                    className="mt-3 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                  >
                    Depositar Agora
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-4 max-w-md mx-auto">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                Voltar
              </button>
              <button
                disabled={submitting || walletBalance < totalAmount}
                onClick={handleSubmit}
                className="flex-[2] bg-secondary text-white py-4 rounded-2xl font-bold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center"
              >
                {submitting ? 'Processando...' : 'Confirmar e Pagar'}
              </button>
            </div>
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

      <LuckyNumberPopup 
        isOpen={showLuckyNumberPopup}
        onClose={() => {
          setShowLuckyNumberPopup(false);
          onNavigate('wallet');
        }}
        numbers={lastLuckyNumbers}
        userName={user?.name || user?.nickname}
      />

      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        token={token}
        onDepositSuccess={() => {
          setIsDepositModalOpen(false);
          fetchWalletBalance();
        }}
      />
    </div>
  );
};

const ReferralPage = () => {
  const { token, user } = useAuth();
  const [referralInfo, setReferralInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReferralInfo = async () => {
    try {
      const res = await fetch('/api/user/referral-info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReferralInfo(await res.json());
      }
    } catch (err) {
      console.error('Error fetching referral info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralInfo();
  }, [token]);

  const referralLink = `${window.location.origin}/?ref=${referralInfo?.referral_code}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    toast.success('Link de indicação copiado!');
  };

  if (loading) return <div className="flex justify-center items-center h-64">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="text-center">
          <h2 className="text-4xl font-bold text-primary mb-4">Indique e Ganhe</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Convide seus amigos para o Bolão 10 e ganhe <span className="font-bold text-secondary">R$ 2,00</span> por cada amigo que fizer o primeiro depósito de pelo menos R$ 10,00.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
            <Users className="w-8 h-8 text-blue-500 mx-auto mb-4" />
            <div className="text-2xl font-bold text-gray-900">{referralInfo?.total_referred || 0}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-bold">Amigos Indicados</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-4" />
            <div className="text-2xl font-bold text-gray-900">{referralInfo?.paid_referrals || 0}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-bold">Indicações Pagas</div>
          </div>
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm text-center">
            <Wallet className="w-8 h-8 text-secondary mx-auto mb-4" />
            <div className="text-2xl font-bold text-gray-900">R$ {(referralInfo?.total_bonus || 0).toFixed(2)}</div>
            <div className="text-sm text-gray-500 uppercase tracking-wider font-bold">Bônus Recebido</div>
          </div>
        </div>

        <div className="bg-primary text-white p-8 rounded-3xl shadow-xl relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-bold mb-4">Seu Link de Indicação</h3>
            <p className="text-white/80 mb-6">Compartilhe este link com seus amigos para começar a ganhar.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 font-mono text-sm break-all">
                {referralLink}
              </div>
              <button 
                onClick={copyToClipboard}
                className="bg-secondary text-white px-8 py-4 rounded-2xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <Copy className="w-5 h-5" />
                Copiar Link
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
            <Gift className="w-6 h-6 text-secondary" />
            Como funciona?
          </h3>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <h4 className="font-bold text-gray-900">Compartilhe seu link</h4>
                <p className="text-gray-600 text-sm">Envie seu link exclusivo para seus amigos via WhatsApp, Redes Sociais ou E-mail.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <h4 className="font-bold text-gray-900">Amigo se cadastra</h4>
                <p className="text-gray-600 text-sm">Seu amigo deve se cadastrar usando seu link exclusivo.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <h4 className="font-bold text-gray-900">Primeiro depósito de R$ 10+</h4>
                <p className="text-gray-600 text-sm">Assim que seu amigo fizer o primeiro depósito de no mínimo R$ 10,00 e ele for aprovado, você ganha o bônus.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <h4 className="font-bold text-gray-900">Bônus na carteira!</h4>
                <p className="text-gray-600 text-sm">O valor de R$ 2,00 será creditado automaticamente na sua carteira para você usar como quiser.</p>
              </div>
            </div>
          </div>
        </div>

        {referralInfo?.referrals?.length > 0 && (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <h3 className="text-xl font-bold text-primary mb-6">Suas Indicações</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Amigo</th>
                    <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Data</th>
                    <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {referralInfo.referrals.map((ref: any) => (
                    <tr key={ref.id}>
                      <td className="py-4">
                        <div className="font-bold text-gray-900">{ref.referred_name}</div>
                        <div className="text-xs text-gray-500">{ref.referred_nickname}</div>
                      </td>
                      <td className="py-4 text-sm text-gray-600">
                        {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-4 text-center">
                        {ref.bonus_paid ? (
                          <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Pago</span>
                        ) : (
                          <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const AdminDashboard = () => {
  const { token } = useAuth();
  const [pendingDeposits, setPendingDeposits] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userWallets, setUserWallets] = useState<any[]>([]);
  const [financials, setFinancials] = useState<any[]>([]);
  const [financialDetails, setFinancialDetails] = useState<any>({ jackpotPool: 0, prizesHistory: [], withdrawalsHistory: [] });
  const [newWithdrawal, setNewWithdrawal] = useState({ amount: '', reason: '' });
  const [showWithdrawalForm, setShowWithdrawalForm] = useState(false);
  const [newJackpotInjection, setNewJackpotInjection] = useState({ amount: '', description: '' });
  const [showJackpotForm, setShowJackpotForm] = useState(false);
  const [adminNotifications, setAdminNotifications] = useState<any[]>([]);
  const [sentNotifications, setSentNotifications] = useState<any[]>([]);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [allLuckyNumbers, setAllLuckyNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'users' | 'financial' | 'user-wallets' | 'history' | 'notifications' | 'messages' | 'referrals' | 'lucky-numbers'>('withdrawals');
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
  const [manualDepositForm, setManualDepositForm] = useState({ userId: '', amount: '', description: '' });
  const [showManualDepositModal, setShowManualDepositModal] = useState(false);
  const [walletSearch, setWalletSearch] = useState('');
  const [viewingWalletHistory, setViewingWalletHistory] = useState<any>(null);

  const fetchPendingDeposits = async () => {
    const res = await fetch('/api/admin/deposits', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setPendingDeposits(data);
    }
  };

  const fetchPendingWithdrawals = async () => {
    const res = await fetch('/api/admin/pending-withdrawals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setPendingWithdrawals(data);
    }
  };

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUsers(data);
  };

  const fetchUserWallets = async () => {
    const res = await fetch('/api/admin/user-wallets', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUserWallets(data);
    }
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

  const handleInjectJackpot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/jackpot/inject', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newJackpotInjection)
    });
    if (res.ok) {
      alert('Bônus injetado com sucesso!');
      setNewJackpotInjection({ amount: '', description: '' });
      setShowJackpotForm(false);
      fetchFinancialDetails();
    }
  };

  const handleManualDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualDepositForm.userId || !manualDepositForm.amount) return;

    try {
      const res = await fetch('/api/admin/wallets/deposit', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(manualDepositForm)
      });

      if (res.ok) {
        toast.success('Depósito realizado com sucesso!');
        setManualDepositForm({ userId: '', amount: '', description: '' });
        setShowManualDepositModal(false);
        fetchUserWallets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao realizar depósito');
      }
    } catch (err) {
      console.error('Manual deposit error:', err);
      toast.error('Erro de conexão ao realizar depósito');
    }
  };

  const [showManualWithdrawModal, setShowManualWithdrawModal] = useState(false);
  const [manualWithdrawForm, setManualWithdrawForm] = useState({ userId: '', amount: '', description: '' });

  const handleManualWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualWithdrawForm.userId || !manualWithdrawForm.amount) return;

    try {
      const res = await fetch('/api/admin/wallets/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(manualWithdrawForm)
      });

      if (res.ok) {
        toast.success('Retirada realizada com sucesso!');
        setManualWithdrawForm({ userId: '', amount: '', description: '' });
        setShowManualWithdrawModal(false);
        fetchUserWallets();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao realizar retirada');
      }
    } catch (err) {
      console.error('Manual withdraw error:', err);
      toast.error('Erro de conexão ao realizar retirada');
    }
  };

  const [allDeposits, setAllDeposits] = useState<any[]>([]);
  const fetchAllDeposits = async () => {
    const res = await fetch('/api/admin/deposits/all', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setAllDeposits(await res.json());
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

  const fetchReferrals = async () => {
    const res = await fetch('/api/admin/referrals', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setReferrals(await res.json());
  };

  const fetchAllLuckyNumbers = async () => {
    const res = await fetch('/api/admin/lucky-numbers', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setAllLuckyNumbers(await res.json());
  };

  useEffect(() => { 
    setLoading(true);
    const promises = [];
    if (activeTab === 'withdrawals') promises.push(fetchPendingWithdrawals());
    if (activeTab === 'users' || activeTab === 'messages') promises.push(fetchUsers());
    if (activeTab === 'notifications') promises.push(fetchNotifications());
    if (activeTab === 'messages') promises.push(fetchSentNotifications());
    if (activeTab === 'referrals') promises.push(fetchReferrals());
    if (activeTab === 'lucky-numbers') promises.push(fetchAllLuckyNumbers());
    if (activeTab === 'financial') {
      promises.push(fetchFinancials());
      promises.push(fetchFinancialDetails());
    }
    if (activeTab === 'user-wallets') {
      promises.push(fetchUserWallets());
      promises.push(fetchPendingDeposits());
      promises.push(fetchAllDeposits());
    }
    if (activeTab === 'history') promises.push(fetchRoundHistory());
    Promise.all(promises).finally(() => setLoading(false));

    const handleNewNotification = (e: any) => {
      const notif = e.detail;
      if (notif && notif.id) {
        if ((notif.id.startsWith('dep-req-') || notif.id.startsWith('dep-proof-') || notif.id.startsWith('dep-upd-')) && activeTab === 'user-wallets') fetchPendingDeposits();
        if (notif.id.startsWith('withdraw-req-') && activeTab === 'withdrawals') fetchPendingWithdrawals();
      }
    };

    window.addEventListener('new_notification', handleNewNotification);
    return () => {
      window.removeEventListener('new_notification', handleNewNotification);
    };
  }, [token, activeTab]);

  const handleValidateDeposit = async (id: number, status: 'approved' | 'rejected') => {
    const res = await fetch(`/api/admin/deposits/${id}/approve`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (res.ok) fetchPendingDeposits();
  };

  const handleValidateWithdrawal = async (id: number, action: 'approve' | 'reject') => {
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        toast.success(`Saque ${action === 'approve' ? 'aprovado' : 'rejeitado'} com sucesso!`);
        fetchPendingWithdrawals();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao processar saque');
      }
    } catch (err) {
      toast.error('Erro na conexão');
    }
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
            { id: 'withdrawals', label: 'Saques' },
            { id: 'users', label: 'Usuários' },
            { id: 'financial', label: 'Financeiro' },
            { id: 'user-wallets', label: 'Carteiras' },
            { id: 'history', label: 'Histórico' },
            { id: 'referrals', label: 'Indicações' },
            { id: 'lucky-numbers', label: '🏆 Sorteio' },
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
      
      {activeTab === 'withdrawals' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-primary">Saques Pendentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Data Solicitação</th>
                  <th className="px-6 py-4">Valor</th>
                  <th className="px-6 py-4">Chave PIX</th>
                  <th className="px-6 py-4">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pendingWithdrawals.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary">{w.user_name} ({w.user_nickname})</p>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(w.created_at).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      R$ {Math.abs(w.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 font-mono text-sm text-gray-600">
                      {w.pix_key || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleValidateWithdrawal(w.id, 'approve')}
                          className="bg-green-100 text-green-700 px-3 py-1 rounded-lg font-bold hover:bg-green-200 transition-colors flex items-center"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprovar
                        </button>
                        <button
                          onClick={() => handleValidateWithdrawal(w.id, 'reject')}
                          className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold hover:bg-red-200 transition-colors flex items-center"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Rejeitar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {pendingWithdrawals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      Nenhum saque pendente.
                    </td>
                  </tr>
                )}
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

      {activeTab === 'referrals' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-bold text-primary mb-6">Monitoramento de Indicações</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Indicador</th>
                  <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Indicado</th>
                  <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider">Data</th>
                  <th className="pb-4 font-bold text-gray-500 uppercase text-xs tracking-wider text-center">Bônus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {referrals.map((ref: any) => (
                  <tr key={ref.id}>
                    <td className="py-4">
                      <div className="font-bold text-gray-900">{ref.referrer_name}</div>
                      <div className="text-xs text-gray-500">{ref.referrer_email}</div>
                    </td>
                    <td className="py-4">
                      <div className="font-bold text-gray-900">{ref.referred_name}</div>
                      <div className="text-xs text-gray-500">{ref.referred_email}</div>
                    </td>
                    <td className="py-4 text-sm text-gray-600">
                      {new Date(ref.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-4 text-center">
                      {ref.bonus_paid ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold">Pago (R$ {ref.bonus_amount.toFixed(2)})</span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">Pendente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === 'lucky-numbers' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
            <h3 className="font-bold text-primary">Controle de Números da Sorte (Sorteio M15)</h3>
            <div className="bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-bold">
              Total Gerado: {allLuckyNumbers.length}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Usuário</th>
                  <th className="px-6 py-4">Número da Sorte</th>
                  <th className="px-6 py-4">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allLuckyNumbers.map((num) => (
                  <tr key={num.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-5 h-5" />
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-primary">{num.users?.name || 'Usuário Deletado'}</p>
                      <p className="text-xs text-gray-500">@{num.users?.nickname}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-primary text-white px-3 py-1 rounded-lg font-mono font-bold text-lg">
                        {num.number}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(num.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
                {allLuckyNumbers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic">
                      Nenhum número da sorte gerado ainda.
                    </td>
                  </tr>
                )}
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
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        n.type === 'forgot_password' ? 'bg-orange-100 text-orange-600' : 
                        n.type === 'withdrawal_request' ? 'bg-red-100 text-red-600' :
                        (n.type === 'deposit_request' || n.type === 'deposit_pending') ? 'bg-green-100 text-green-600' :
                        'bg-blue-100 text-blue-600'
                      }`}>
                        {n.type === 'forgot_password' ? <AlertCircle className="w-5 h-5" /> : 
                         n.type === 'withdrawal_request' ? <ArrowUpCircle className="w-5 h-5" /> :
                         (n.type === 'deposit_request' || n.type === 'deposit_pending') ? <ArrowDownCircle className="w-5 h-5" /> :
                         <Bell className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{n.title || n.message}</p>
                        {n.title && <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(n.created_at || n.date, 'dd/MM/yyyy HH:mm')}
                        </p>
                        
                        <div className="mt-4 flex flex-wrap gap-2">
                          {n.type === 'forgot_password' && (
                            <>
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
                            </>
                          )}

                          {n.type === 'withdrawal_request' && (
                            <button 
                              onClick={() => setActiveTab('withdrawals')}
                              className="bg-red-50 text-red-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors flex items-center"
                            >
                              <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" /> Ver Pedidos de Saque
                            </button>
                          )}

                          {n.type === 'deposit_request' && (
                            <button 
                              onClick={() => setActiveTab('user-wallets')}
                              className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors flex items-center"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" /> Validar Depósitos
                            </button>
                          )}

                          {n.type === 'deposit_pending' && (
                            <button 
                              onClick={() => setActiveTab('user-wallets')}
                              className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors flex items-center"
                            >
                              <ArrowDownCircle className="w-3.5 h-3.5 mr-1.5" /> Ver Carteiras
                            </button>
                          )}

                          {(n.type === 'withdrawal_request' || n.type === 'deposit_request' || n.type === 'deposit_pending') && n.user_phone && (
                            <a 
                              href={`https://wa.me/55${n.user_phone.replace(/\D/g, '')}?text=Olá ${n.user_name}, sobre seu pedido de ${n.type === 'withdrawal_request' ? 'saque' : 'depósito'} no Bolão10...`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-green-50 text-green-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors flex items-center"
                            >
                              <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> Contatar Usuário
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        try {
                          const res = await fetch(`/api/admin/notifications/${n.id}`, {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                          if (res.ok) fetchNotifications();
                        } catch (err) {
                          console.error('Error deleting notification:', err);
                        }
                      }}
                      className="text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Remover alerta"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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

      {activeTab === 'user-wallets' && (() => {
        const totalBalance = userWallets.reduce((acc, uw) => acc + (uw.balance || 0), 0);
        const totalDeposited = userWallets.reduce((acc, uw) => acc + (uw.totalDeposited || 0), 0);
        const totalWinnings = userWallets.reduce((acc, uw) => acc + (uw.totalWinnings || 0), 0);
        const totalWithdrawn = userWallets.reduce((acc, uw) => acc + (uw.totalWithdrawn || 0), 0);
        const activeUsersCount = userWallets.filter(uw => uw.balance > 0).length;

        return (
          <div className="space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              <div className="bg-white p-6 rounded-3xl border-l-4 border-primary shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">BANCO Bolão 10 (Total em Carteiras)</p>
                  <p className="text-2xl font-bold text-primary">R$ {totalBalance.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-primary rounded-full flex items-center justify-center">
                  <Landmark className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-blue-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Depositado</p>
                  <p className="text-2xl font-bold text-primary">R$ {totalDeposited.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-purple-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total de Prêmios</p>
                  <p className="text-2xl font-bold text-primary">R$ {totalWinnings.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center">
                  <Gift className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-red-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total Sacado</p>
                  <p className="text-2xl font-bold text-red-600">R$ {totalWithdrawn.toFixed(2)}</p>
                </div>
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border-l-4 border-orange-500 shadow-sm flex justify-between items-center">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase mb-1">Usuários com Saldo</p>
                  <p className="text-2xl font-bold text-orange-600">{activeUsersCount}</p>
                </div>
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <Clock className="w-5 h-5 text-yellow-500" />
                  Validação de Depósitos
                </h3>
                <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-bold">
                  {pendingDeposits.length} Pendentes
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Comprovante</th>
                      <th className="px-6 py-4">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Nenhum depósito pendente de validação.</td>
                      </tr>
                    ) : (
                      pendingDeposits.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-primary">{d.user_name} ({d.user_nickname})</p>
                            <p className="text-xs text-gray-500">{d.user_email}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {new Date(d.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 font-bold text-green-600">
                            R$ {d.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            {d.proof_url ? (
                              <button 
                                onClick={() => setViewingProof(d.proof_url)}
                                className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-sm font-bold"
                              >
                                <Eye className="w-4 h-4" /> Ver Comprovante
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs italic">Sem comprovante</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handleValidateDeposit(d.id, 'approved')}
                                className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                                title="Aprovar"
                              >
                                <CheckCircle className="w-5 h-5" />
                              </button>
                              <button 
                                onClick={() => handleValidateDeposit(d.id, 'rejected')}
                                className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                title="Rejeitar"
                              >
                                <XCircle className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-gray-100">
              <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-blue-500" />
                  Carteiras dos Usuários
                </h3>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative flex-grow sm:flex-grow-0">
                    <input 
                      type="text" 
                      placeholder="Buscar por nome ou email..." 
                      value={walletSearch}
                      onChange={(e) => setWalletSearch(e.target.value)}
                      className="w-full sm:w-64 pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary outline-none"
                    />
                    <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <button onClick={() => { fetchUserWallets(); fetchAllDeposits(); }} className="text-sm text-blue-500 hover:underline shrink-0">
                    Atualizar
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Usuário</th>
                      <th className="px-6 py-4 font-semibold">Saldo Atual</th>
                      <th className="px-6 py-4 font-semibold">Total Depositado</th>
                      <th className="px-6 py-4 font-semibold">Total Ganho</th>
                      <th className="px-6 py-4 font-semibold">Saques</th>
                      <th className="px-6 py-4 font-semibold">Histórico</th>
                      <th className="px-6 py-4 font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(() => {
                      const filtered = userWallets.filter((uw: any) => 
                        uw.user.name.toLowerCase().includes(walletSearch.toLowerCase()) ||
                        uw.user.email.toLowerCase().includes(walletSearch.toLowerCase())
                      );
                      
                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-gray-400">Nenhum usuário encontrado.</td>
                          </tr>
                        );
                      }

                      return filtered.map((uw: any) => (
                        <tr key={uw.user.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-primary">{uw.user.name}</p>
                            <p className="text-xs text-gray-500">{uw.user.email}</p>
                            {uw.user.nickname && <p className="text-xs text-blue-500">@{uw.user.nickname}</p>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold ${uw.balance > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                              R$ {uw.balance.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-600">R$ {uw.totalDeposited.toFixed(2)}</td>
                          <td className="px-6 py-4 text-blue-600">R$ {uw.totalWinnings.toFixed(2)}</td>
                          <td className="px-6 py-4 text-red-500">R$ {uw.totalWithdrawn.toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => setViewingWalletHistory(uw)}
                              className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-primary transition-colors bg-gray-100 px-3 py-1.5 rounded-lg"
                            >
                              <History className="w-3.5 h-3.5" />
                              Ver Extrato ({uw.deposits.length})
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <button 
                                onClick={() => {
                                  setManualDepositForm({ ...manualDepositForm, userId: uw.user.id });
                                  setShowManualDepositModal(true);
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors"
                                title="Depósito Manual"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Depósito
                              </button>
                              <button 
                                onClick={() => {
                                  setManualWithdrawForm({ ...manualWithdrawForm, userId: uw.user.id });
                                  setShowManualWithdrawModal(true);
                                }}
                                className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                                title="Retirada Manual"
                              >
                                <MinusCircle className="w-3.5 h-3.5" />
                                Retirada
                              </button>
                            </div>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <History className="w-5 h-5 text-purple-500" />
                  Histórico Recente de Depósitos (PIX / Manual)
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4">Método</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {allDeposits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-400 italic">Nenhum depósito encontrado.</td>
                      </tr>
                    ) : (
                      allDeposits.slice(0, 50).map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-bold text-primary">{d.user_name} ({d.user_nickname})</p>
                            <p className="text-xs text-gray-500">{d.user_email}</p>
                          </td>
                          <td className="px-6 py-4 text-gray-600 text-sm">
                            {new Date(d.created_at).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-6 py-4 font-bold text-gray-900 text-sm">
                            R$ {d.amount.toFixed(2)}
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-medium text-gray-500 uppercase">
                              {d.payment_method === 'pix' ? 'PIX' : d.payment_method === 'credit_card' ? 'Cartão' : 'Manual'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              d.status === 'approved' ? 'bg-green-100 text-green-700' : 
                              d.status === 'rejected' ? 'bg-red-100 text-red-700' : 
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {d.status === 'approved' ? 'Aprovado' : d.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

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

            {/* Jackpot Injection Form */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-500" />
                  Injetar Patrocínio no Bônus (Jackpot)
                </h3>
                <button 
                  onClick={() => setShowJackpotForm(!showJackpotForm)}
                  className="text-xs bg-purple-600 text-white px-4 py-1.5 rounded-full hover:bg-purple-700 transition-colors font-bold shadow-sm"
                >
                  {showJackpotForm ? 'Cancelar' : '+ Injetar Bônus'}
                </button>
              </div>
              
              {showJackpotForm && (
                <div className="p-6 bg-purple-50 border-b border-gray-100">
                  <form onSubmit={handleInjectJackpot} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Valor do Patrocínio (R$)</label>
                        <input 
                          type="number" 
                          step="0.01"
                          required
                          value={newJackpotInjection.amount}
                          onChange={(e) => setNewJackpotInjection({...newJackpotInjection, amount: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Ex: 100.00"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Descrição / Patrocinador</label>
                        <input 
                          type="text" 
                          required
                          value={newJackpotInjection.description}
                          onChange={(e) => setNewJackpotInjection({...newJackpotInjection, description: e.target.value})}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                          placeholder="Ex: Patrocínio NavalTech"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-purple-600 text-white font-bold py-2.5 rounded-xl hover:bg-purple-700 transition-colors shadow-md flex items-center justify-center gap-2">
                      <TrendingUp className="w-4 h-4" /> Confirmar Injeção de Bônus
                    </button>
                  </form>
                </div>
              )}
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

      {/* Manual Deposit Modal */}
      {showManualDepositModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
              <PlusCircle className="w-6 h-6 text-green-500" />
              Depósito Manual
            </h3>
            <form onSubmit={handleManualDeposit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={manualDepositForm.amount}
                  onChange={(e) => setManualDepositForm({...manualDepositForm, amount: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descrição</label>
                <input 
                  type="text" 
                  required
                  value={manualDepositForm.description}
                  onChange={(e) => setManualDepositForm({...manualDepositForm, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary outline-none"
                  placeholder="Ex: Pagamento via PIX direto"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowManualDepositModal(false)} 
                  className="flex-1 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors shadow-md"
                >
                  Confirmar Depósito
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Withdrawal Modal */}
      {showManualWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full">
            <div className="flex items-center gap-2 mb-2">
              <MinusCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-xl font-bold">Retirada Manual de Saldo</h3>
            </div>
            <p className="text-xs text-red-600 mb-6 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
              Atenção: O valor inserido será subtraído do saldo disponível do usuário.
            </p>
            <form onSubmit={handleManualWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={manualWithdrawForm.amount}
                  onChange={(e) => setManualWithdrawForm({...manualWithdrawForm, amount: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descrição</label>
                <input 
                  type="text" 
                  required
                  value={manualWithdrawForm.description}
                  onChange={(e) => setManualWithdrawForm({...manualWithdrawForm, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ex: Correção de erro / Estorno"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowManualWithdrawModal(false)} 
                  className="flex-1 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-md"
                >
                  Confirmar Retirada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Withdrawal Modal */}
      {showManualWithdrawModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <MinusCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-xl font-bold">Retirada Manual</h3>
            </div>
            <p className="text-xs text-red-600 mb-6 font-medium bg-red-50 p-3 rounded-xl border border-red-100">
              Atenção: O valor inserido será subtraído do saldo disponível do usuário.
            </p>
            <form onSubmit={handleManualWithdraw} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={manualWithdrawForm.amount}
                  onChange={(e) => setManualWithdrawForm({...manualWithdrawForm, amount: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo / Descrição</label>
                <input 
                  type="text" 
                  required
                  value={manualWithdrawForm.description}
                  onChange={(e) => setManualWithdrawForm({...manualWithdrawForm, description: e.target.value})}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="Ex: Correção de erro / Estorno"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowManualWithdrawModal(false)} 
                  className="flex-1 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-md"
                >
                  Confirmar Retirada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Wallet History Modal */}
      {viewingWalletHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-primary flex items-center gap-2">
                  <History className="w-6 h-6 text-blue-500" />
                  Extrato de Depósitos
                </h3>
                <p className="text-sm text-gray-500">{viewingWalletHistory.user.name} ({viewingWalletHistory.user.email})</p>
              </div>
              <button 
                onClick={() => setViewingWalletHistory(null)}
                className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
              {viewingWalletHistory.deposits.length === 0 ? (
                <div className="py-12 text-center text-gray-400 italic">
                  Nenhum depósito registrado para este usuário.
                </div>
              ) : (
                <div className="space-y-3">
                  {viewingWalletHistory.deposits.map((d: any) => (
                    <div key={d.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          d.status === 'approved' ? 'bg-green-100 text-green-600' :
                          d.status === 'rejected' ? 'bg-red-100 text-red-600' :
                          'bg-yellow-100 text-yellow-600'
                        }`}>
                          {d.status === 'approved' ? <CheckCircle className="w-5 h-5" /> : 
                           d.status === 'rejected' ? <XCircle className="w-5 h-5" /> : 
                           <Clock className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">R$ {d.amount.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{formatDate(d.created_at, "dd 'de' MMMM 'de' yyyy 'às' HH:mm")}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          d.status === 'approved' ? 'bg-green-100 text-green-700' :
                          d.status === 'rejected' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {d.status === 'approved' ? 'Aprovado' : d.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                        </span>
                        {d.proof_url && (
                          <button 
                            onClick={() => setViewingProof(d.proof_url)}
                            className="block mt-2 text-[10px] text-blue-500 hover:underline font-bold"
                          >
                            Ver Comprovante
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold">Saldo Atual</p>
                <p className="text-xl font-bold text-green-600">R$ {viewingWalletHistory.balance.toFixed(2)}</p>
              </div>
              <button 
                onClick={() => {
                  setManualDepositForm({ ...manualDepositForm, userId: viewingWalletHistory.user.id });
                  setViewingWalletHistory(null);
                  setShowManualDepositModal(true);
                }}
                className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-secondary transition-all shadow-md flex items-center gap-2"
              >
                <PlusCircle className="w-5 h-5" />
                Novo Depósito
              </button>
            </div>
          </div>
        </div>
      )}

      <AnimatePresence>
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
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchData = async () => {
    if (!selectedRoundId) return;
    setLoading(true);
    
    // Check access
    const accessRes = await fetch(`/api/rounds/${selectedRoundId}/check-prediction`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const accessData = await safeJson(accessRes);
    const userHasAccess = accessData?.hasPrediction || isAdmin;
    setHasAccess(userHasAccess);

    if (userHasAccess) {
      // Fetch round details including games
      const roundRes = await fetch(`/api/rounds/${selectedRoundId}`);
      const roundData = await safeJson(roundRes);
      setRound(roundData);

      const transRes = await fetch(`/api/rounds/${selectedRoundId}/transparency`);
      if (transRes.ok) {
        const transData = await safeJson(transRes);
        setPredictions(transData || []);
      }
    }
    setLoading(false);
  };

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
    fetchData();
  }, [selectedRoundId, token, rounds, isAdmin]);

  const handleDeletePrediction = async (id: number) => {
    if (!confirm('Tem certeza que deseja EXCLUIR este palpite? Esta ação é irreversível.')) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/predictions/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Palpite excluído com sucesso!');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao excluir palpite');
      }
    } catch (err) {
      toast.error('Erro na conexão');
    } finally {
      setDeletingId(null);
    }
  };

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
                  <div className="flex flex-col">
                    <h4 className="font-bold text-primary leading-tight">{p.user_name}</h4>
                    <span className="text-[10px] text-gray-400">@{p.user_nickname}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {round?.status === 'finished' ? (
                      <span className="bg-secondary text-white px-3 py-1 rounded-full text-xs font-bold">
                        {p.score !== null && p.score !== undefined ? `${p.score} Pontos` : '0 Pontos'}
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-xs font-bold">
                        Em andamento
                      </span>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeletePrediction(p.id)}
                        disabled={deletingId === p.id}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                        {deletingId === p.id ? 'Excluindo...' : 'Excluir'}
                      </button>
                    )}
                  </div>
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

const Podium = ({ top3, roundStatus }: { top3: any[], roundStatus?: string }) => {
  if (!top3 || top3.length === 0) return null;

  // Reorder to 2, 1, 3 for podium look
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], pos: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], pos: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], pos: 3 });

  return (
    <div className="flex items-end justify-center gap-2 md:gap-6 mb-12 mt-8 px-2">
      {podiumOrder.map((item) => (
        <div key={item.id} className={`flex flex-col items-center transition-all duration-700 ${item.pos === 1 ? 'z-10 scale-110 md:scale-125' : 'z-0'}`}>
          <div className="mb-3 text-center px-1">
            <p className="text-[9px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-1">
              {item.pos === 1 ? '🏆 Campeão' : item.pos === 2 ? '🥈 2º Lugar' : '🥉 3º Lugar'}
            </p>
            <p className="text-[10px] md:text-xs font-black text-primary truncate max-w-[70px] md:max-w-[100px]">
              {item.user_name}
            </p>
          </div>
          
          <div className={`relative flex flex-col items-center justify-end rounded-t-[20px] md:rounded-t-[32px] shadow-xl border-x border-t border-white/20 ${
            item.pos === 1 
              ? 'w-24 md:w-32 h-32 md:h-40 bg-gradient-to-b from-yellow-400 via-yellow-500 to-yellow-600' 
              : item.pos === 2 
                ? 'w-20 md:w-28 h-24 md:h-32 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-400' 
                : 'w-20 md:w-28 h-20 md:h-24 bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500'
          }`}>
            <div className="absolute -top-4 md:-top-6 bg-white rounded-full p-2 md:p-3 shadow-xl border-2 border-gray-50">
              {item.pos === 1 ? <Trophy className="w-5 h-5 md:w-8 md:h-8 text-yellow-500" /> : 
               item.pos === 2 ? <Trophy className="w-4 h-4 md:w-6 md:h-6 text-gray-400" /> : 
               <Trophy className="w-4 h-4 md:w-6 md:h-6 text-orange-500" />}
            </div>
            
            <div className="pb-4 md:pb-6 text-center text-white">
              <p className="text-lg md:text-2xl font-black leading-none">{item.score}</p>
              <p className="text-[8px] md:text-[10px] font-bold opacity-70 uppercase tracking-widest mt-1">
                Pontos
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const RankingPage = () => {
  const { token, isAdmin } = useAuth();
  const [rounds, setRounds] = useState<any[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [ranking, setRanking] = useState<any[]>([]);
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
      const accessData = await safeJson(accessRes);
      const userHasAccess = accessData?.hasPrediction || isAdmin;
      setHasAccess(userHasAccess);

      if (userHasAccess) {
        const res = await fetch(`/api/rounds/${selectedRoundId}/transparency`);
        if (res.ok) {
          const data = await res.json();
          // Sort by score descending
          const sorted = data.sort((a: any, b: any) => b.score - a.score);
          setRanking(sorted);
        }
      }
      setLoading(false);
    };
    fetchData();
  }, [selectedRoundId, token, isAdmin]);

  if (loading && rounds.length === 0) return <div className="p-8">Carregando...</div>;

  const selectedRound = rounds.find(r => r.id.toString() === selectedRoundId);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end mb-8 gap-6 text-center md:text-left">
        <div className="w-full">
          <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <Trophy className="w-6 h-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-primary tracking-tight">Ranking</h2>
          </div>
          
          <div className="flex flex-col md:flex-row items-center gap-3 bg-gray-50 p-4 rounded-3xl border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Selecione a Rodada</p>
            <div className="flex flex-wrap justify-center gap-2">
              {rounds.slice(0, 5).map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoundId(r.id.toString())}
                  className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                    selectedRoundId === r.id.toString()
                      ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-105'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-primary/30'
                  }`}
                >
                  #{r.number}
                </button>
              ))}
              {rounds.length > 5 && (
                <select 
                  value={selectedRoundId}
                  onChange={(e) => setSelectedRoundId(e.target.value)}
                  className="bg-white border border-gray-200 rounded-2xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="" disabled>Outras...</option>
                  {rounds.slice(5).map(r => (
                    <option key={r.id} value={r.id}>Rodada #{r.number}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {!hasAccess ? (
        <div className="bg-white p-8 md:p-12 rounded-[32px] md:rounded-[40px] border border-dashed border-gray-200 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-primary mb-2">Acesso Restrito</h3>
          <p className="text-gray-500 max-w-md mx-auto text-sm md:text-base">
            Você só pode visualizar o ranking de rodadas em que possui palpites validados.
          </p>
        </div>
      ) : (
        <>
          {ranking.length > 0 && <Podium top3={ranking.slice(0, 3)} roundStatus={selectedRound?.status} />}

          <div className="bg-white rounded-[32px] md:rounded-[40px] border border-gray-100 shadow-xl shadow-primary/5 overflow-hidden">
            {/* Header for Desktop */}
            <div className="hidden md:grid grid-cols-12 bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 px-8 py-4">
              <div className="col-span-2">Posição</div>
              <div className="col-span-7">Participante</div>
              <div className="col-span-3 text-right">Pontuação</div>
            </div>

            <div className="divide-y divide-gray-100">
              {ranking.map((item, index) => (
                <div 
                  key={item.id} 
                  className={`group hover:bg-gray-50 transition-all px-4 md:px-8 py-4 md:py-5 grid grid-cols-12 items-center gap-3 ${
                    index < 3 ? 'bg-primary/[0.02]' : ''
                  }`}
                >
                  {/* Position */}
                  <div className="col-span-2 md:col-span-2">
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-black text-xs md:text-sm transition-transform group-hover:scale-110 ${
                      index === 0 ? 'bg-yellow-100 text-yellow-700 border-2 border-yellow-200' : 
                      index === 1 ? 'bg-gray-100 text-gray-600 border-2 border-gray-200' :
                      index === 2 ? 'bg-orange-100 text-orange-700 border-2 border-orange-200' : 
                      'bg-white text-gray-400 border border-gray-100'
                    }`}>
                      {index + 1}º
                    </div>
                  </div>

                  {/* User Name */}
                  <div className="col-span-7 md:col-span-7">
                    <div className="flex flex-col">
                      <p className="font-bold text-primary text-sm md:text-base truncate">
                        {item.user_name}
                      </p>
                      {index < 3 && (
                        <span className="text-[8px] md:text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                          {index === 0 ? '🥇 Líder da Rodada' : index === 1 ? '🥈 Vice-Líder' : '🥉 3º Colocado'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="col-span-3 md:col-span-3 text-right">
                    <div className="flex flex-col items-end">
                      <div className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-2xl font-black text-xs md:text-sm shadow-sm transition-all group-hover:translate-x-[-4px] ${
                        selectedRound?.status === 'finished' 
                          ? 'bg-secondary text-white shadow-secondary/20' 
                          : 'bg-white text-blue-600 border border-blue-100 shadow-blue-100/50'
                      }`}>
                        <span>{item.score || 0}</span>
                        <span className="text-[8px] md:text-[10px] opacity-70 uppercase">pts</span>
                      </div>
                      {selectedRound?.status !== 'finished' && (
                        <span className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase mt-1 tracking-tighter">Parcial</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {ranking.length === 0 && !loading && (
                <div className="px-8 py-20 text-center">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-8 h-8 text-gray-200" />
                  </div>
                  <p className="text-gray-400 font-medium">Nenhum resultado disponível para esta rodada.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const LuckyNumberPopup = ({ isOpen, onClose, numbers, userName }: { isOpen: boolean, onClose: () => void, numbers: string[], userName?: string }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white rounded-[40px] shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative scrollbar-hide"
          >
            {/* Header with Image Background or Gradient */}
            <div className="h-40 sm:h-48 bg-gradient-to-br from-primary to-blue-900 flex flex-col items-center justify-center text-center p-6 relative shrink-0">
              <div className="absolute top-4 right-4">
                <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <img 
                src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/Game_Stick.webp" 
                alt="Game Stick M15" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-2 drop-shadow-lg"
                referrerPolicy="no-referrer"
              />
              <h3 className="text-xl sm:text-2xl font-bold text-white drop-shadow-md">Parabéns! No Jogo!</h3>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-10 text-center">
              <div className="mb-6 sm:mb-8">
                <h4 className="text-lg sm:text-xl font-bold text-primary mb-2">Olá, {userName || 'Amigo'}!</h4>
                <p className="text-sm sm:text-base text-gray-600 mb-6 leading-relaxed">
                  Seu palpite foi registrado com sucesso em nosso sistema! 🚀<br /><br />
                  Ficamos muito felizes em ter você conosco. Como forma de agradecimento, você acaba de receber seus <strong>Números da Sorte</strong> para o sorteio do <strong>GAME STICK M15</strong>!
                </p>
                
                <div className="flex flex-wrap justify-center gap-4">
                  {numbers.map((num, i) => (
                    <div 
                      key={i}
                      className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 min-w-[120px] shadow-sm animate-pulse"
                    >
                      <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">CUPOM</span>
                      <span className="text-3xl font-black text-primary tracking-tighter">{num}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                <div className="flex items-center gap-3 mb-3 justify-center">
                  <Clock className="w-5 h-5 text-secondary" />
                  <span className="font-bold text-primary">Sorteio: 19 de Julho de 2026</span>
                </div>
                <p className="text-[11px] text-gray-500 uppercase font-bold tracking-wider italic">
                  Dia da Final da Copa do Mundo FIFA 2026
                </p>
              </div>

              <button 
                onClick={onClose}
                className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                Continuar para minha Carteira
              </button>
              
              <p className="text-xs text-gray-400 mt-6">
                Você pode consultar seus números a qualquer momento no seu perfil.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
              <li><strong>Carteira Virtual:</strong> O sistema utiliza uma carteira virtual. Você deve depositar saldo em sua conta para poder realizar palpites.</li>
              <li><strong>Custo do Palpite:</strong> Cada palpite realizado debita automaticamente o valor da inscrição do seu saldo disponível na carteira.</li>
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
            <h2 className="text-2xl font-bold text-primary mb-4">3. Carteira, Depósitos e Saques</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Depósitos:</strong> Os depósitos são processados via PagBank, oferecendo opções de PIX e Cartão de Crédito. O saldo é creditado automaticamente em sua carteira virtual assim que a confirmação for recebida pelo gateway.</li>
              <li><strong>Premiação:</strong> Os prêmios conquistados são creditados diretamente em sua carteira virtual após a finalização e auditoria da rodada.</li>
              <li><strong>Saques:</strong> Você pode solicitar o saque do seu saldo disponível a partir do valor mínimo estipulado. O processamento é realizado via PIX para a chave cadastrada em seu perfil.</li>
              <li><strong>Transparência:</strong> Garantimos a integridade do jogo. Após o início da rodada, os palpites de todos os participantes ficam disponíveis para consulta pública no Ranking de Transparência.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Sistema de Indicações (Afiliados)</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>O Bônus:</strong> O usuário ganha R$ 2,00 de bônus por cada novo usuário indicado que realizar seu primeiro depósito (mínimo R$ 10,00).</li>
              <li><strong>Uso do Link:</strong> A indicação só é válida se o novo usuário se cadastrar utilizando o link exclusivo do indicador.</li>
              <li><strong>Limites:</strong> O bônus é creditado automaticamente na carteira virtual e pode ser usado para novos palpites.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">5. Sorteios e Promoções</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Elegibilidade:</strong> Cada palpite (aposta) realizado e pago garante ao usuário um "Número da Sorte" (Cupom) gerado aleatoriamente ou deterministicamente pelo sistema.</li>
              <li><strong>O Prêmio:</strong> O sorteio atual refere-se a um GAME STICK M15 PRO.</li>
              <li><strong>Data do Sorteio:</strong> O sorteio será realizado no dia 19 de Julho de 2026, coincidindo com a final da Copa do Mundo FIFA 2026.</li>
              <li><strong>Divulgação:</strong> O ganhador será anunciado na plataforma e contatado via e-mail/telefone cadastrado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">6. Regras Gerais e Conduta</h2>
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

const PrivacyPage = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-[40px] shadow-sm border border-gray-100"
      >
        <h1 className="text-4xl font-bold text-primary mb-8">POLÍTICA DE PRIVACIDADE – BOLÃO10</h1>
        
        <div className="prose prose-slate max-w-none space-y-8 text-gray-600 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">1. Introdução</h2>
            <p>
              A plataforma Bolão10 valoriza a privacidade de seus usuários. Esta Política de Privacidade descreve como coletamos, usamos e protegemos suas informações pessoais ao utilizar nosso site.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">2. Coleta de Dados</h2>
            <p className="mb-4">Para o funcionamento da plataforma e processamento de pagamentos, coletamos:</p>
            <ul className="list-disc pl-5 space-y-4">
              <li>
                <strong>Dados de Identificação:</strong> Nome completo, e-mail e CPF (necessário para emissão de pagamentos e segurança).
              </li>
              <li>
                <strong>Dados de Pagamento:</strong> As transações são processadas pelo gateway PagBank. O Bolão10 não armazena dados sensíveis de cartões de crédito em seus servidores, utilizando apenas tokens de transação seguros.
              </li>
              <li>
                <strong>Dados de Uso:</strong> Registros de palpites, histórico de depósitos e movimentações de saldo dentro da plataforma.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">3. Finalidade dos Dados</h2>
            <p className="mb-4">Os dados coletados são utilizados exclusivamente para:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Gerenciar sua conta e garantir o acesso aos bolões.</li>
              <li>Processar depósitos e resgates de prêmios.</li>
              <li>Garantir a integridade e transparência das rodadas.</li>
              <li>Prevenir fraudes e garantir a conformidade com as normas financeiras.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">4. Compartilhamento de Informações</h2>
            <p className="mb-4">O Bolão10 não vende ou aluga dados de usuários. O compartilhamento ocorre apenas com:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>PagBank:</strong> Para o processamento das transações financeiras.</li>
              <li><strong>Autoridades Legais:</strong> Caso seja exigido por lei ou ordem judicial.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">5. Segurança</h2>
            <p>
              Utilizamos certificados SSL para criptografia de dados e o banco de dados Supabase para garantir o armazenamento seguro das informações. Adotamos as melhores práticas de desenvolvimento para proteger o ambiente contra acessos não autorizados.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">6. Seus Direitos</h2>
            <p>
              O usuário tem o direito de solicitar a correção, atualização ou exclusão de seus dados pessoais, bem como o encerramento de sua conta a qualquer momento, desde que não haja pendências financeiras.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-primary mb-4">7. Contato</h2>
            <p>
              Para dúvidas sobre esta política, entre em contato através do e-mail: <a href="mailto:admin@bolao10.com" className="text-primary hover:underline font-bold">admin@bolao10.com</a>
            </p>
          </section>
        </div>
      </motion.div>
    </div>
  );
};

export default function App() {
  const [page, setPage] = useState('landing');
  const { isAuthenticated, isAdmin, token } = useAuth();

  // Push Notifications Setup
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const registerPush = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('Push notifications not supported');
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const permission = await Notification.requestPermission();
        
        if (permission === 'granted') {
          const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!vapidPublicKey) return;

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });

          await fetch('/api/push-subscriptions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription })
          });
        }
      } catch (err) {
        console.error('Error registering push:', err);
      }
    };

    registerPush();
  }, [isAuthenticated, token]);

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referredBy', ref);
      // Clean up URL
      const newUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && page === 'landing') setPage('dashboard');
  }, [isAuthenticated]);

  const renderPage = () => {
    switch (page) {
      case 'landing': return <LandingPage onNavigate={setPage} />;
      case 'login': return <LoginPage onNavigate={setPage} />;
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'wallet': return <WalletPage onNavigate={setPage} />;
      case 'referral': return <ReferralPage />;
      case 'profile': return <ProfilePage onNavigate={setPage} />;
      case 'predictions': return <PredictionsPage onNavigate={setPage} />;
      case 'admin': return isAdmin ? <AdminDashboard /> : <Dashboard onNavigate={setPage} />;
      case 'admin-rounds': return isAdmin ? <AdminRoundsPage /> : <Dashboard onNavigate={setPage} />;
      case 'transparency': return <TransparencyPage />;
      case 'ranking': return <RankingPage />;
      case 'terms': return <TermsPage />;
      case 'privacy': return <PrivacyPage />;
      default: return <LandingPage onNavigate={setPage} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Toaster position="top-right" richColors />
      <Navbar onNavigate={setPage} currentPage={page} />
      <PromoPopup onNavigate={setPage} />
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
          <div className="mb-4 flex justify-center space-x-6">
            <button 
              onClick={() => setPage('terms')}
              className="text-xs font-bold text-gray-500 hover:text-primary uppercase tracking-wider transition-colors"
            >
              Termos de Uso
            </button>
            <button 
              onClick={() => setPage('privacy')}
              className="text-xs font-bold text-gray-500 hover:text-primary uppercase tracking-wider transition-colors"
            >
              Política de Privacidade
            </button>
          </div>
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
