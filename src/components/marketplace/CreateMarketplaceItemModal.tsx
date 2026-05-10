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
  // Post States
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [phone, setPhone] = useState(defaultPhone);
  const [category, setCategory] = useState('למכירה');
  const [media, setMedia] = useState<{ file: File; preview: string; type: string } | null>(null);

  // Request States
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
    const parsedPrice = category === 'למסירה' ? 0 : parseFloat(price) || 0;
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

  if (type === 'request') {
    return (
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" dir="rtl">
        <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-black text-xl text-slate-800 flex items-center gap-2">
              <span className="text-2xl">🙏</span> מה חסר לך?
            </h3>
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full text-slate-500 hover:bg-gray-100 hover:text-slate-800 transition active:scale-95">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleRequestSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                required
                value={reqTitle}
                onChange={(e) => setReqTitle(e.target.value)}
                className="w-full bg-white border border-emerald-100 rounded-xl px-4 py-4 outline-none focus:border-emerald-500 transition text-slate-800 font-bold shadow-sm"
                placeholder="לדוג׳: למישהו יש קצת חלב? / כבלים מרים?"
              />
            </div>
            <div>
              <input
                type="text"
                value={reqDesc}
                onChange={(e) => setReqDesc(e.target.value)}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 outline-none focus:border-emerald-500 transition text-slate-800 text-sm shadow-sm"
                placeholder="אפשר לפרט כאן (מספר דירה וכד')..."
              />
            </div>

            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl flex items-start gap-3 shadow-sm mt-2">
              <svg className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm text-emerald-700 font-bold leading-relaxed">
                ברגע שתלחץ, התראה קופצת (פוש) תשלח לכל השכנים בבניין כדי שיעזרו כמה שיותר מהר.
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-emerald-500 text-white font-bold rounded-xl shadow-md mt-4 active:scale-95 transition disabled:opacity-50 text-lg flex items-center justify-center"
            >
              {isSubmitting ? 'שולח בקשה...' : 'שלח לכל השכנים!'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex justify-center items-end" dir="rtl">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 max-h-[90vh] overflow-y-auto border-t border-white/50">
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-xl text-slate-800">הוספת מודעה</h3>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-full text-slate-500 hover:bg-gray-100 hover:text-slate-800 transition active:scale-95 shadow-sm border border-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handlePostSubmit} className="space-y-4">
          <div>
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            {!media ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full aspect-video bg-purple-50 border-2 border-dashed border-purple-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-purple-100 transition shadow-sm"
              >
                <svg className="w-10 h-10 text-purple-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-base font-bold text-purple-600">הוסף תמונה או סרטון</span>
              </div>
            ) : (
              <div className="w-full aspect-video relative rounded-2xl overflow-hidden shadow-sm">
                {media.type === 'image' ? (
                  <img src={media.preview} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <video src={media.preview} className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => setMedia(null)}
                  className="absolute top-3 right-3 w-12 h-12 flex items-center justify-center bg-black/50 backdrop-blur-md text-white rounded-full hover:bg-red-500 transition active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
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
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-purple-400 transition shadow-sm text-slate-800"
              placeholder="כותרת (לדוג': מוכר כיסא תינוק)"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-[52px] bg-white border border-gray-100 rounded-xl px-4 text-sm font-bold outline-none focus:border-purple-400 transition shadow-sm text-slate-800"
              >
                {mainCategories.filter((c) => c !== 'הכל').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            {category !== 'למסירה' && (
              <div className="flex-1">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full h-[52px] bg-white border border-gray-100 rounded-xl px-4 text-sm font-bold outline-none focus:border-purple-400 transition shadow-sm text-slate-800"
                  placeholder="מחיר ב-₪"
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
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-purple-400 transition text-left shadow-sm text-slate-800"
              dir="ltr"
              placeholder="050-0000000"
            />
          </div>

          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-xl px-4 py-4 text-sm font-medium outline-none focus:border-purple-400 transition min-h-[100px] shadow-sm text-slate-800"
              placeholder="תיאור ופרטים נוספים..."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 bg-purple-600 text-white font-bold rounded-xl shadow-[0_8px_20px_rgba(147,51,234,0.3)] mt-4 active:scale-95 transition disabled:opacity-50 text-lg flex items-center justify-center"
          >
            {isSubmitting ? 'מפרסם...' : 'פרסם מודעה'}
          </button>
        </form>
      </div>
    </div>
  );
}
