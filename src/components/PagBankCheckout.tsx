import React, { useState } from 'react';
import { CreditCard, QrCode, CheckCircle, AlertCircle, Loader2, Copy, Check, Info } from 'lucide-react';
import { toast } from 'sonner';
import QRCode from 'react-qr-code';
import { generatePixPayload } from '../utils/pix';

declare const PagSeguro: any;

interface PagBankCheckoutProps {
  amount: string;
  token: string;
  initialMethod?: 'pix' | 'credit_card';
  onSuccess: () => void;
  onCancel: () => void;
}

export const PagBankCheckout: React.FC<PagBankCheckoutProps> = ({ amount, token, initialMethod = 'pix', onSuccess, onCancel }) => {
  const [method, setMethod] = useState<'pix' | 'credit_card'>(initialMethod);
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrcode: string; text: string; depositId: string; manual?: boolean } | null>(null);
  const [hasAutoTriggered, setHasAutoTriggered] = useState(false);

  React.useEffect(() => {
    if (initialMethod === 'pix' && !hasAutoTriggered && !pixData) {
      setHasAutoTriggered(true);
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      handlePayment(fakeEvent);
    }
  }, [initialMethod]);
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });
  const [copied, setCopied] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let cardHash = null;

      if (method === 'credit_card') {
        // 1. Get Public Key from our backend
        const pkRes = await fetch('/api/pagbank/public-key', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!pkRes.ok) throw new Error('Falha ao obter chave de criptografia');
        const pkData = await pkRes.json();
        const publicKey = pkData.public_key;

        // 2. Encrypt card using PagBank SDK
        if (typeof PagSeguro === 'undefined') {
          throw new Error('SDK do PagBank não carregado. Verifique sua conexão.');
        }

        const card = PagSeguro.encryptCard({
          publicKey,
          holder: cardData.name,
          number: cardData.number.replace(/\s/g, ''),
          expMonth: cardData.expiry.split('/')[0],
          expYear: '20' + cardData.expiry.split('/')[1],
          securityCode: cardData.cvv
        });

        if (card.hasErrors) {
          const errorMap: any = {
            'INVALID_NUMBER': 'Número do cartão inválido',
            'INVALID_HOLDER': 'Nome do titular inválido',
            'INVALID_EXPIRATION_MONTH': 'Mês de expiração inválido',
            'INVALID_EXPIRATION_YEAR': 'Ano de expiração inválido',
            'INVALID_SECURITY_CODE': 'CVV inválido'
          };
          const firstError = Object.keys(card.errors)[0];
          throw new Error(errorMap[firstError] || 'Dados do cartão inválidos');
        }

        cardHash = card.encryptedCard;
      }

      const res = await fetch('/api/pagbank/create-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          method,
          cardHash
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao processar pagamento');

      if (method === 'pix') {
        let finalPixData = null;
        
        if (data.pix.manualKey || !data.pix.qrcode) {
          // Force manual payload with requested key
          const pixKey = 'admin@bolao10.com';
          const payload = generatePixPayload(
            pixKey,
            'Bolão 10',
            'Nova Iguacu',
            parseFloat(amount),
            `DEP${data.depositId}`
          );
          finalPixData = { qrcode: '', text: payload, depositId: data.depositId, manual: true };
        } else {
          finalPixData = { ...data.pix, depositId: data.depositId };
        }

        if (finalPixData) {
          setPixData(finalPixData);
          toast.success('PIX gerado com sucesso!');
        } else {
          throw new Error('Não foi possível gerar o PIX. Tente novamente mais tarde.');
        }
      } else {
        if (data.status === 'PAID') {
          toast.success('Pagamento com cartão aprovado!');
          onSuccess();
        } else if (data.status === 'IN_ANALYSIS') {
          toast.info('Pagamento em análise. O saldo será creditado em breve.');
          onSuccess();
        } else if (data.status === 'DECLINED') {
          toast.error('Pagamento recusado pelo cartão.');
        } else {
          toast.success('Pagamento com cartão processado!');
          onSuccess();
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (pixData) {
      navigator.clipboard.writeText(pixData.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Código PIX copiado!');
    }
  };

  if (loading && !pixData && initialMethod === 'pix') {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
          <p className="text-gray-500 font-medium">Gerando seu QR Code PIX...</p>
        </div>
      </div>
    );
  }

  if (pixData) {
    return (
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
          <QrCode className="w-8 h-8" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-primary">Pagamento PIX</h3>
          <p className="text-gray-500">Escaneie o código abaixo para concluir seu depósito de <span className="font-bold text-primary">R$ {parseFloat(amount).toFixed(2)}</span></p>
        </div>

        <div className="bg-white p-4 border-2 border-gray-100 rounded-2xl inline-block shadow-sm">
          {pixData.manual ? (
            <div className="p-2 bg-white">
              <QRCode value={pixData.text} size={192} />
            </div>
          ) : (
            <img src={pixData.qrcode} alt="QR Code PIX" className="w-48 h-48 mx-auto" referrerPolicy="no-referrer" />
          )}
        </div>

        {pixData.manual && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-start gap-3 text-left">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Aviso:</strong> O processamento deste PIX é manual. Após o pagamento, nosso administrador irá conferir e creditar seu saldo em alguns minutos.
            </p>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Ou copie o código abaixo</p>
          <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
            <code className="text-[10px] text-gray-600 truncate flex-grow text-left">{pixData.text}</code>
            <button onClick={copyPix} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-400" />}
            </button>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <button 
            onClick={async () => {
              try {
                setLoading(true);
                const res = await fetch(`/api/pagbank/check-status/${pixData.depositId || ''}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.status === 'PAID') {
                  toast.success('Pagamento confirmado!');
                  onSuccess();
                } else {
                  toast.info('Pagamento ainda não detectado. Se você já pagou, aguarde alguns instantes.');
                }
              } catch (e) {
                toast.error('Erro ao verificar status');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all shadow-lg flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Já realizei o pagamento'}
          </button>
          <button 
            onClick={onCancel}
            className="w-full text-gray-400 font-medium hover:text-gray-600 transition-colors"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-2xl font-bold text-primary">Concluir Depósito</h3>
        <span className="text-primary font-bold text-lg">R$ {parseFloat(amount).toFixed(2)}</span>
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4 mb-8">
        <QrCode className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
        <div className="space-y-1">
          <p className="font-bold text-blue-900">Depósito via PIX</p>
          <p className="text-sm text-blue-700 leading-relaxed">
            Ao clicar no botão abaixo, geraremos um código PIX para você realizar o pagamento. O saldo é creditado automaticamente.
          </p>
        </div>
      </div>

      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full bg-[#00BFA5] text-white font-bold py-5 rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-100 disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
          <>
            <QrCode className="w-6 h-6" />
            Gerar QR Code PIX
          </>
        )}
      </button>

      <button 
        onClick={onCancel}
        disabled={loading}
        className="w-full mt-4 text-gray-400 font-medium hover:text-gray-600 transition-colors"
      >
        Cancelar
      </button>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 grayscale opacity-50">
        <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-4" referrerPolicy="no-referrer" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ambiente Seguro</span>
      </div>
    </div>
  );
};
