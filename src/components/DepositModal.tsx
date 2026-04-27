import React, { useState, useMemo } from 'react';
import { X, AlertCircle, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PagBankCheckout } from './PagBankCheckout';

export const DepositModal = ({ isOpen, onClose, token, onDepositSuccess }: any) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'pix' | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setAmount('');
      setError(null);
      setPaymentMode(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-primary text-white">
          <h2 className="text-xl font-bold">Depositar na Carteira</h2>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 flex items-start text-sm border border-red-100">
              <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {!paymentMode ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Valor do Depósito (R$)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Ex: 50.00"
                  className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-lg font-bold"
                />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[10, 20, 50, 100, 200].map(val => (
                  <button
                    key={val}
                    onClick={() => setAmount(val.toString())}
                    className="py-2 border border-gray-200 rounded-xl text-gray-600 font-bold hover:bg-primary/5 hover:border-primary hover:text-primary transition-colors"
                  >
                    R$ {val}
                  </button>
                ))}
              </div>

              <div className="pt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (parseFloat(amount) >= 1) setPaymentMode('pix');
                    else setError('O valor mínimo para depósito é R$ 1,00');
                  }}
                  className="w-full bg-[#00BFA5] text-white font-bold py-4 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCard className="w-5 h-5" />
                  PIX
                </button>
                <button
                  onClick={() => {
                    if (parseFloat(amount) >= 1) setPaymentMode('credit_card');
                    else setError('O valor mínimo para depósito é R$ 1,00');
                  }}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCard className="w-5 h-5" />
                  Cartão
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <PagBankCheckout 
                amount={amount} 
                token={token}
                initialMethod={paymentMode === 'pix' ? 'pix' : 'credit_card'}
                onSuccess={() => {
                  onDepositSuccess();
                  onClose();
                }}
                onCancel={() => setPaymentMode(null)}
              />
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-6 border-t border-gray-100 mt-8">
            <img src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/PagBank.jpg" alt="PagBank" className="h-4 grayscale opacity-70" referrerPolicy="no-referrer" />
            <div className="h-4 w-[1px] bg-gray-200"></div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ambiente Seguro</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
