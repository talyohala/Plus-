import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnimatedSheet({ isOpen, onClose, children }: { isOpen: boolean, onClose: () => void, children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990]" />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y" dragConstraints={{ top: 0 }} dragElastic={0.2} onDragEnd={(e, { offset, velocity }) => { if (offset.y > 100 || velocity.y > 20) onClose(); }}
            className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white rounded-t-[2.5rem] p-6 pb-12 shadow-2xl z-[9999] border-t border-white/20 touch-none"
            dir="rtl"
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing" />
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
