import React, { useState, useRef } from 'react';

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
  type,
  mainCategories,
  defaultPhone,
  isSubmitting,
  onClose,
  onSubmitPost,
  onSubmitRequest,
}: CreateMarketplaceItemModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState(defaultPhone);
  const [category, setCategory] = useState('חבילות ודואר');
  const [media, setMedia] = useState<{ file: File; preview: string; type: string } | null>(null);

  const [reqTitle, setReqTitle] = useState('');
  const [reqDesc, setReqDesc] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

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
      title: title.trim(),
      description: description.trim(),
      price: parsedPrice,
      contact_phone: phone.trim(),
      category,
      file: media?.file || null,
      type: media?.type || 'image',
    });
  };

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;
    await onSubmitRequest(reqTitle.trim(), reqDesc.trim());
  };

  const applyPreset = (presetCategory: string, presetTitle: string, presetDesc: string) => {
    setCategory(presetCategory);
    setTitle(presetTitle);
    setDescription(presetDesc);
  };

  if (type === 'request') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" dir="rtl">
        <div className="bg-emerald-50/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-emerald-500/20">
          <div className="w-12 h-1.5 bg-emerald-500/20 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-black text-xl text-emerald-950">עזרה מהשכנים</h3>
            <button onClick={onClose} className="p-2 bg-emerald-500/10 rounded-full text-emerald-700 hover:bg-emerald-500/20 transition">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                required
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                className="w-full bg-white/80 border border-emerald-500/20 rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-600 transition text-slate-800 font-bold text-xs shadow-xs placeholder-emerald-800/40"
                placeholder="לדוג׳: למישהו יש כבלים להתנעת רכב?"
              />
            </div>
            <div>
              <input
                type="text"
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                className="w-full bg-white/80 border border-emerald-500/20 rounded-2xl px-4 py-3.5 outline-none focus:border-emerald-600 transition text-slate-800 text-xs shadow-xs placeholder-emerald-800/40"
                placeholder="פירוט (מספר דירה וכד')..."
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-emerald-600 text-white font-bold rounded-2xl shadow-md mt-2 active:scale-95 transition disabled:opacity-50 text-xs flex items-center justify-center"
            >
              {isSubmitting ? 'שולח התראה...' : 'שלח בקשה לשכנים'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" dir="rtl">
      <div className="bg-blue-50/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border-t border-[#1D4ED8]/20">
        <div className="w-12 h-1.5 bg-[#1D4ED8]/20 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-2">
            <span className="text-[#1D4ED8] font-black text-lg">📢</span>
            <h3 className="font-black text-xl text-blue-950">עדכון לקהילה</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-[#1D4ED8]/10 rounded-full text-[#1D4ED8] hover:bg-[#1D4ED8]/20 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex gap-2.5 mb-5 overflow-x-auto hide-scrollbar pb-1">
          <button type="button" onClick={() => applyPreset('חבילות ודואר', 'יש חבילה בלובי', 'ראיתי חבילה מונחת בלובי ליד המעלית.')} className="bg-white/80 text-[#1D4ED8] border border-[#1D4ED8]/15 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 active:scale-95 transition shadow-xs">חבילה בלובי</button>
          <button type="button" onClick={() => applyPreset('השאלות כלים', 'משאיל כלי עבודה', 'מוזמנים להשאיל באהבה.')} className="bg-white/80 text-[#1D4ED8] border border-[#1D4ED8]/15 px-3.5 py-2 rounded-2xl text-xs font-bold shrink-0 active:scale-95 transition shadow-xs">השאלת כלים</button>
        </div>

        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div>
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            {!media ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video bg-white/80 border border-dashed border-[#1D4ED8]/20 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-white transition shadow-xs"
              >
                <span className="text-xs font-bold text-[#1D4ED8]">הוספת תמונה או סרטון</span>
              </div>
            ) : (
              <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-xs border border-blue-100">
                {media.type === 'image' ? (
                  <img src={media.preview} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <video src={media.preview} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setMedia(null)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition active:scale-95 text-xs"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800 placeholder-blue-900/40"
              placeholder="כותרת העדכון"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-12 bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-3 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800"
              >
                {mainCategories.filter(c => c !== 'הכל').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {category !== 'חבילות ודואר' && category !== 'השאלות כלים' && category !== 'למסירה' && (
              <div className="flex-1">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full h-12 bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-3 text-xs font-bold outline-none focus:border-[#1D4ED8] transition shadow-xs text-slate-800 placeholder-blue-900/40"
                  placeholder="מחיר (₪)"
                />
              </div>
            )}
          </div>

          <div>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:border-[#1D4ED8] transition text-left shadow-xs text-slate-800 font-mono placeholder-blue-900/40"
              dir="ltr"
              placeholder="050-0000000"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white/80 border border-[#1D4ED8]/15 rounded-2xl px-4 py-3.5 text-xs font-medium outline-none focus:border-[#1D4ED8] transition min-h-[70px] shadow-xs text-slate-800 resize-none placeholder-blue-900/40"
              placeholder="פרטים נוספים..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-12 bg-[#1D4ED8] text-white font-bold rounded-2xl shadow-md mt-2 active:scale-95 transition disabled:opacity-50 text-xs flex items-center justify-center"
          >
            {isSubmitting ? 'מעדכן...' : 'פרסום ללוח'}
          </button>
        </form>
      </div>
    </div>
  );
}
