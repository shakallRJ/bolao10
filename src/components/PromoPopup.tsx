import React, { useState, useEffect } from 'react';
import { X, Globe, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PromoPopupProps {
  onNavigate: (page: string) => void;
}

export const PromoPopup: React.FC<PromoPopupProps> = ({ onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the popup in this session
    const hasSeenPromo = sessionStorage.getItem('bolao10_promo_seen');
    if (!hasSeenPromo) {
      // Show the popup after a short delay
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem('bolao10_promo_seen', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-md bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-3xl shadow-2xl overflow-hidden border border-amber-500/30"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/20 hover:bg-black/40 text-gray-300 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content Area */}
          <div className="p-8 text-center mt-4">
            <div className="flex justify-center items-center gap-4 mb-6">
              <div className="p-4 bg-blue-500/20 rounded-full border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
                <Globe className="w-10 h-10 text-blue-400" />
              </div>
              <div className="p-4 bg-amber-500/20 rounded-full border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Trophy className="w-10 h-10 text-amber-400" />
              </div>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-6 drop-shadow-lg leading-tight uppercase">
              🔥 O PATRÃO FICOU MALUCO! O PRÊMIO DO BOLÃO 10 EXPLODIU! 🚀
            </h2>
            
            <div className="space-y-4 text-gray-300 font-medium text-sm sm:text-base leading-relaxed text-left">
              <p>
                Atenção, apostadores! Se a motivação que faltava era um empurrãozinho no prêmio, agora você tem uma <strong className="text-amber-400">AVALANCHE</strong> de motivos para mitar na rodada!
              </p>
              <p>
                O patrão abriu o cofre e adicionou <strong className="text-green-400">R$ 100,00 REAIS EXTRAS</strong> no bônus para quem cravar os 10 ACERTOS! 😱
              </p>
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 shadow-inner space-y-2">
                <p className="font-bold text-amber-400 flex items-center gap-2">
                  🏆 CONFIRA A NOVA PREMIAÇÃO DO BÔNUS 10:
                </p>
                <p className="text-white">Agora, quem gabaritar a rodada leva para casa:</p>
                <p className="flex items-start gap-2">
                  <span>💰</span> 
                  <span><strong className="text-green-400">R$ 135,00 EM DINHEIRO</strong> (Direto na sua carteira!)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span>🎮</span> 
                  <span><strong>+ 01 VÍDEO GAME STICK M15</strong> (Milhares de jogos clássicos para você se divertir!)</span>
                </p>
              </div>
            </div>
          </div>

          {/* Action Area */}
          <div className="p-6 bg-black/20 text-center border-t border-white/5">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('rounds');
              }}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all transform hover:-translate-y-1"
            >
              👉 PALPITAR AGORA E GANHAR!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
