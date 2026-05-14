import React, { useState, useRef, useEffect } from 'react';
import { playSystemSound } from '../providers/AppManager';

interface CreateMarketplaceItemModalProps {
  type: 'post' | 'request';
  mainCategories: string[];
  defaultPhone: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitPost: (data: any) => Promise<void>;
  onSubmitRequest: (title: string, description: string) => Promise<void>;
}

export default function CreateMarketplaceItemModal({
  type, mainCategories, defaultPhone, isSubmitting, onClose, onSubmitPost, onSubmitRequest
}: CreateMarketplaceItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('למכירה');
  const [media, setMedia] = useState<{ file: File; preview: string; type: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmitPost({ title, description, price: parseFloat(price) || 0, contact_phone: defaultPhone, category, file: media?.file || null, type: media?.type || 'image' });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" onClick={onClose} dir="rtl">
      <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
        <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">עדכון חדש</h3>
        
        <form onSubmit={handlePostSubmit} className="space-y-4">
          <textarea autoFocus rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#1D4ED8] resize-none" placeholder="כתוב כאן מה תרצה לפרסם..." />
          
          <div className="flex gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
               <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm font-bold" placeholder="כותרת" />
          </div>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-14 bg-amber-50 border border-amber-200 rounded-2xl px-4 text-2xl font-black text-center" placeholder="₪0" />
          
          <button type="submit" className="w-full h-14 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg">פרסם בלוח</button>
        </form>
      </div>
    </div>
  );
}
