import React, { useState } from 'react';
import { CreditCard, QrCode, CheckCircle, AlertCircle, Loader2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PagBankCheckoutProps {
  amount: string;
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const PagBankCheckout: React.FC<PagBankCheckoutProps> = ({ amount, token, onSuccess, onCancel }) => {
  const [method, setMethod] = useState<'pix' | 'credit_card'>('pix');
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<{ qrcode: string; text: string } | null>(null);
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
      // In a real scenario, you'd use PagBank's JS SDK to encrypt the card
      // Here we simulate the cardHash for the example
      const cardHash = method === 'credit_card' ? 'simulated_encrypted_card_hash' : null;

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
        setPixData(data.pix);
        toast.success('QR Code PIX gerado com sucesso!');
      } else {
        toast.success('Pagamento com cartão processado!');
        onSuccess();
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
          <img src={pixData.qrcode} alt="QR Code PIX" className="w-48 h-48 mx-auto" referrerPolicy="no-referrer" />
        </div>

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
            onClick={onSuccess}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all shadow-lg"
          >
            Já realizei o pagamento
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
        <h3 className="text-2xl font-bold text-primary">Checkout PagBank</h3>
        <span className="text-primary font-bold text-lg">R$ {parseFloat(amount).toFixed(2)}</span>
      </div>

      <div className="flex p-1 bg-gray-100 rounded-2xl mb-8">
        <button
          onClick={() => setMethod('pix')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${method === 'pix' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <QrCode className="w-5 h-5" />
          PIX
        </button>
        <button
          onClick={() => setMethod('credit_card')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${method === 'credit_card' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <CreditCard className="w-5 h-5" />
          Cartão
        </button>
      </div>

      <form onSubmit={handlePayment} className="space-y-6">
        {method === 'credit_card' ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Número do Cartão</label>
              <input
                type="text"
                placeholder="0000 0000 0000 0000"
                value={cardData.number}
                onChange={e => setCardData({...cardData, number: e.target.value})}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Nome no Cartão</label>
              <input
                type="text"
                placeholder="Como está no cartão"
                value={cardData.name}
                onChange={e => setCardData({...cardData, name: e.target.value})}
                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Validade</label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={cardData.expiry}
                  onChange={e => setCardData({...cardData, expiry: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1 ml-1">CVV</label>
                <input
                  type="text"
                  placeholder="123"
                  value={cardData.cvv}
                  onChange={e => setCardData({...cardData, cvv: e.target.value})}
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary outline-none transition-all"
                  required
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900 mb-1">Pagamento Instantâneo</p>
              <p className="text-xs text-blue-700 leading-relaxed">O saldo será creditado automaticamente na sua conta assim que o PIX for confirmado.</p>
            </div>
          </div>
        )}

        <div className="pt-4 space-y-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando...
              </>
            ) : (
              `Pagar R$ ${parseFloat(amount).toFixed(2)}`
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full text-gray-400 font-medium hover:text-gray-600 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 grayscale opacity-50">
        <img src="https://logodownload.org/wp-content/uploads/2014/10/pagseguro-logo-1.png" alt="PagSeguro" className="h-4" referrerPolicy="no-referrer" />
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ambiente Seguro</span>
      </div>
    </div>
  );
};
