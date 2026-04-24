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
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        onClick={() => setIsOpen(false)}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-[90vw] sm:max-w-md bg-transparent rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(245,158,11,0.2)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 z-20 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-all border border-white/20 hover:scale-110 active:scale-95"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Promotional Image */}
          <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl">
            <img 
              src="https://zxnsubmxqoplohcngntu.supabase.co/storage/v1/object/public/imagem/Gemini_Generated_Image_t8zv2wt8zv2wt8zv.png" 
              alt="Promoção Especial" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            
            {/* Visual enhancement overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
