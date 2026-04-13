import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Upload, AlertCircle, MessageCircle, CreditCard, ShieldCheck } from 'lucide-react';
import { generatePixPayload } from '../utils/pix';
import QRCode from 'react-qr-code';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { PagBankCheckout } from './PagBankCheckout';

export const DepositModal = ({ isOpen, onClose, token, onDepositSuccess }: any) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState<string>('');
  const [step, setStep] = useState<number>(1);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [depositId, setDepositId] = useState<number | null>(null);
  const [paymentMode, setPaymentMode] = useState<'manual' | 'pagbank' | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setAmount('');
      setProofFile(null);
      setDepositId(null);
      setError(null);
      setPaymentMode(null);
    }
  }, [isOpen]);

  const pixPayload = useMemo(() => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) return '';
    return generatePixPayload(
      'admin@bolao10.com', // Replace with dynamic if needed
      'BOLAO10',
      'SAO PAULO',
      numAmount
    );
  }, [amount]);

  const copyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNext = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Digite um valor válido maior que zero.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const endpoint = depositId ? `/api/wallet/deposit/update-amount` : '/api/wallet/deposit/initiate';
      const body = depositId ? { depositId, amount: numAmount } : { amount: numAmount };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar depósito');

      if (!depositId) setDepositId(data.deposit.id);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!proofFile) {
      // If no proof file, we just close because the deposit was already initiated
      onDepositSuccess();
      onClose();
      setStep(1);
      setAmount('');
      setDepositId(null);
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('depositId', depositId?.toString() || '');
    formData.append('proof', proofFile);

    try {
      const res = await fetch('/api/wallet/deposit/attach-proof', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao anexar comprovante');

      onDepositSuccess();
      onClose();
      setStep(1);
      setAmount('');
      setProofFile(null);
      setDepositId(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

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

          {!paymentMode && step === 1 && (
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

              <div className="space-y-3 pt-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Escolha o método de pagamento</p>
                <button
                  onClick={() => {
                    if (parseFloat(amount) > 0) setPaymentMode('pagbank');
                    else setError('Digite um valor válido.');
                  }}
                  className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-secondary transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <CreditCard className="w-5 h-5" />
                  PagBank (PIX ou Cartão)
                </button>
                <button
                  onClick={() => {
                    if (parseFloat(amount) > 0) setPaymentMode('manual');
                    else setError('Digite um valor válido.');
                  }}
                  className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-5 h-5" />
                  Depósito Manual (PIX Direto)
                </button>
              </div>
              
              <div className="flex items-center justify-center gap-2 pt-4 opacity-50">
                <ShieldCheck className="w-4 h-4 text-green-600" />
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pagamento 100% Seguro</span>
              </div>
            </div>
          )}

          {paymentMode === 'pagbank' && (
            <div className="flex justify-center">
              <PagBankCheckout 
                amount={amount} 
                token={token} 
                onSuccess={() => {
                  onDepositSuccess();
                  onClose();
                }}
                onCancel={() => setPaymentMode(null)}
              />
            </div>
          )}

          {paymentMode === 'manual' && step === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mb-4">
                <p className="text-sm text-blue-800 font-medium">Você escolheu o depósito manual de <span className="font-bold text-blue-900">R$ {parseFloat(amount).toFixed(2)}</span>. Clique em continuar para gerar os dados.</p>
              </div>
              <button
                onClick={handleNext}
                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors"
              >
                Continuar
              </button>
              <button
                onClick={() => setPaymentMode(null)}
                className="w-full text-gray-400 font-medium hover:text-gray-600 transition-colors"
              >
                Voltar
              </button>
            </div>
          )}

          {paymentMode === 'manual' && step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-gray-600 mb-4">Escaneie o QR Code ou copie a chave PIX para depositar <span className="font-bold text-primary">R$ {parseFloat(amount).toFixed(2)}</span></p>
                <div className="flex justify-center mb-4">
                  <div className="p-4 bg-white border-2 border-gray-100 rounded-2xl shadow-sm inline-block">
                    <QRCode value={pixPayload} size={180} />
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl flex items-center justify-between border border-gray-200">
                  <span className="font-mono text-xs text-gray-500 truncate mr-2">{pixPayload}</span>
                  <button onClick={copyPix} className="p-2 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <label className="block text-sm font-bold text-gray-700 mb-2">Comprovante de Pagamento (Opcional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600 justify-center">
                      <label htmlFor="proof-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none">
                        <span>Fazer upload do arquivo</span>
                        <input id="proof-upload" name="proof-upload" type="file" className="sr-only" accept="image/*" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    <p className="text-xs text-gray-500">PNG, JPG, GIF até 10MB</p>
                  </div>
                </div>
                {proofFile && (
                  <p className="mt-2 text-sm text-green-600 font-medium flex items-center">
                    <Check className="w-4 h-4 mr-1" /> Arquivo selecionado: {proofFile.name}
                  </p>
                )}
                {!proofFile && (
                  <p className="mt-2 text-xs text-gray-400 italic">Você pode confirmar o depósito agora e o administrador validará manualmente.</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 bg-gray-100 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Enviando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
