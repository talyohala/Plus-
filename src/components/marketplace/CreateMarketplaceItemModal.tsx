import React, { useState, useRef, useEffect } from 'react';
import { playSystemSound } from '../providers/AppManager';

interface CreateMarketplaceItemModalProps {
  type: 'post' | 'request';
  mainCategories: string[];
  defaultPhone: string;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmitPost: (data: { title: string; description: string; price: number; contact_phone: string; category: string; file: File | null; type: string }) => Promise<void>;
  onSubmitRequest: (title: string, description: string) => Promise<void>;
}

export default function CreateMarketplaceItemModal({
  type, mainCategories, defaultPhone, isSubmitting, onClose, onSubmitPost, onSubmitRequest
}: CreateMarketplaceItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState(defaultPhone);
  const [category, setCategory] = useState('למכירה');
  const [media, setMedia] = useState<{ file: File; preview: string; type: string } | null>(null);

  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, []);

  const onTouchStartHandler = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientY);
  const onTouchMoveHandler = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const diff = e.targetTouches[0].clientY - touchStart;
    if (diff > 0) setTranslateY(diff);
  };
  const onTouchEndHandler = () => {
    if (translateY > 150) onClose();
    setTranslateY(0);
    setTouchStart(null);
  };

  const handleAIEnhance = async (formType: 'post' | 'request') => {
    const currentDesc = formType === 'post' ? description : reqDesc;
    if (!currentDesc) return;
    playSystemSound('click');
    setIsAiProcessing(true);
    try {
      const prompt = `שפר את הניסוח של מודעת הלוח הבאה לשכנים בבניין. הפוך אותה למזמינה, מנומסת וקצרה. הוסף אימוג'י רלוונטי. הטקסט המקורי: "${currentDesc}"`;
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: prompt, mode: 'insight' })
      });
      const data = await res.json();
      if (data.text) {
         playSystemSound('notification');
         if (formType === 'post') {
           setDescription(data.text.trim());
           if (data.text.includes('למסירה') || data.text.includes('חינם')) setCategory('למסירה');
         } else {
           setReqDesc(data.text.trim());
         }
      }
    } catch (err) {
      console.error(err);
    }
    setIsAiProcessing(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mType = file.type.startsWith('video/') ? 'video' : 'image';
    setMedia({ file, preview: URL.createObjectURL(file), type: mType });
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !phone.trim()) return;
    const parsedPrice = category === 'למסירה' || category === 'חבילות ודואר' || category === 'השאלות כלים' ? 0 : parseFloat(price) || 0;
    await onSubmitPost({
      title: title.trim(), description: description.trim(), price: parsedPrice, contact_phone: phone.trim(),
      category, file: media?.file || null, type: media?.type || 'image',
    });
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    await onSubmitRequest(reqTitle.trim(), reqDesc.trim());
  };

  if (type === 'request') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end touch-none overscroll-none" onTouchStart={onTouchStartHandler} onTouchMove={onTouchMoveHandler} onTouchEnd={onTouchEndHandler} onClick={(e) => { if(e.target === e.currentTarget) onClose(); }} dir="rtl">
        <div style={{ transform: `translateY(${translateY}px)` }} className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-12 shadow-2xl transition-transform duration-75 ease-out relative border-t border-emerald-500/20" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing" />
          <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">עזרה מהשכנים</h3>
          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <input type="text" required value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 text-sm font-bold outline-none focus:border-emerald-500 transition shadow-inner" placeholder="נושא (לדוג׳: מישהו ראה חבילה שלי?)" />
            <div className="relative group">
              <textarea required rows={4} value={reqDesc} onChange={(e) => setReqDesc(e.target.value)} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 py-4 pb-12 text-sm font-bold outline-none focus:border-emerald-500 resize-none shadow-inner transition min-h-[140px]" placeholder="פירוט הבקשה..." />
              <button type="button" onClick={() => handleAIEnhance('request')} disabled={isAiProcessing || !reqDesc} className="absolute bottom-3 left-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50">
                {isAiProcessing ? 'מנסח...' : '✨ נסח מנומס'}
              </button>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full h-14 bg-emerald-600 text-white font-black rounded-[1.5rem] shadow-lg mt-4 active:scale-95 transition disabled:opacity-50 text-lg">
              {isSubmitting ? 'שולח...' : 'שלח בקשה לשכנים'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end touch-none overscroll-none" onTouchStart={onTouchStartHandler} onTouchMove={onTouchMoveHandler} onTouchEnd={onTouchEndHandler} onClick={(e) => { if(e.target === e.currentTarget) onClose(); }} dir="rtl">
      <div style={{ transform: `translateY(${translateY}px)` }} className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-12 shadow-2xl transition-transform duration-75 ease-out max-h-[90vh] overflow-y-auto border-t border-[#1D4ED8]/20" onClick={e => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 cursor-grab active:cursor-grabbing" />
        <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">עדכון ללוח הקהילתי</h3>
        
        <form onSubmit={handlePostSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-black text-slate-500 mb-2 px-1">קטגוריה</label>
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 pt-1 px-1">
              {mainCategories.filter(c => c !== 'הכל' && c !== 'שמורים').map(cat => (
                <button type="button" key={cat} onClick={() => setCategory(cat)} className={`shrink-0 px-5 py-2.5 rounded-full text-xs font-black transition-all ${category === cat ? 'bg-[#1D4ED8] text-white shadow-md scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner transition" placeholder="כותרת (למשל: סולם להשאלה)" />
          
          <div className="relative group">
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 py-4 pb-14 text-sm font-bold outline-none focus:border-[#1D4ED8] resize-none shadow-inner transition min-h-[120px]" placeholder="ספר לשכנים על זה..." />
            <button type="button" onClick={() => handleAIEnhance('post')} disabled={isAiProcessing || !description} className="absolute bottom-3 left-3 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50">
              {isAiProcessing ? 'מנסח...' : '✨ נסח עם AI'}
            </button>
          </div>

          {category === 'למכירה' && (
            <input required type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner transition" dir="ltr" placeholder="מחיר (₪)" />
          )}

          <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] px-4 text-sm font-bold text-left outline-none focus:border-[#1D4ED8] shadow-inner transition font-mono" dir="ltr" placeholder="050-0000000" />

          <div>
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            {!media ? (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-14 bg-[#F8FAFC] border border-dashed border-[#1D4ED8]/30 rounded-[1.5rem] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition shadow-inner">
                <span className="text-sm font-bold text-[#1D4ED8]">הוספת תמונה או סרטון 📷</span>
              </div>
            ) : (
              <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-sm border border-slate-200 mt-2">
                {media.type === 'image' ? <img src={media.preview} className="w-full h-full object-cover" alt="preview" /> : <video src={media.preview} className="w-full h-full object-cover" />}
                <button type="button" onClick={() => setMedia(null)} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition active:scale-95 text-xs">✕</button>
              </div>
            )}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full h-14 flex items-center justify-center bg-[#1D4ED8] hover:bg-blue-700 text-white font-black rounded-[1.5rem] shadow-lg active:scale-[0.98] transition-all mt-4 text-lg">
            {isSubmitting ? 'מעלה עדכון...' : 'פרסם בלוח'}
          </button>
        </form>
      </div>
    </div>
  );
}
