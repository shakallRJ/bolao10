import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
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
          className="relative w-full max-w-lg bg-gradient-to-b from-[#0f172a] to-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-md"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image Container */}
          <div className="relative w-full bg-black">
            <img
              src="/promo-image.jpg"
              alt="Promoção Bônus 10 Acertos - Game Stick"
              className="w-full h-auto object-contain"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Action Area */}
          <div className="p-6 bg-[#1e293b] text-center">
            <button
              onClick={() => {
                setIsOpen(false);
                onNavigate('predictions');
              }}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
            >
              JOGUE AGORA E CONCORRA!
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
