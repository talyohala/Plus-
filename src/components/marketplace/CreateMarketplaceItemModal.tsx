import React, { useState, useRef, useCallback, memo } from 'react';
import AnimatedSheet from '../ui/AnimatedSheet';
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

// קומפוננטה מבודדת (memo) לתמונה כדי למנוע רינדור מחדש והבהובים בזמן הקלדה
const MediaPreview = memo(({ previewUrl, type, onClear }: { previewUrl: string | null; type: string | undefined; onClear: () => void }) => {
  if (!previewUrl) return null;

  return (
    <div className="relative inline-block mt-6 group">
      <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-50 flex items-center justify-center">
        {type === 'video' ? (
          <div className="w-full h-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">וידאו צורף</div>
        ) : (
          <img src={previewUrl} className="w-full h-full object-cover" alt="תצוגה מקדימה" />
        )}
      </div>
      <button 
        type="button" 
        onClick={onClear} 
        className="absolute top-2 left-2 w-7 h-7 bg-white/80 backdrop-blur-md text-slate-800 rounded-full flex items-center justify-center shadow-md hover:bg-white hover:text-rose-600 transition active:scale-90 border border-slate-100 z-20">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
});

export default function CreateMarketplaceItemModal({
  defaultPhone, isSubmitting, onClose, onSubmitPost, onSubmitRequest, type
}: CreateMarketplaceItemModalProps) {
  const [mode, setMode] = useState<'post' | 'request' | 'poll'>('post');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [showPrice, setShowPrice] = useState(false);
  const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  
  const [media, setMedia] = useState<{ file: File; type: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAutoCategory = () => {
    if (mode === 'request') return 'בקשות שכנים';
    if (mode === 'poll') return 'סקרים';
    const p = parseFloat(price);
    if (p > 0) return 'למכירה';
    const text = (title + ' ' + description).toLowerCase();
    if (text.includes('למסירה') || text.includes('חינם')) return 'למסירה';
    if (text.includes('חבילה') || text.includes('דואר') || text.includes('שליח')) return 'חבילות ודואר';
    if (text.includes('מקדחה') || text.includes('כבלים') || text.includes('סולם')) return 'השאלות כלים';
    return 'קהילה';
  };

  const stripEmojis = (str: string) => {
    return str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '').trim();
  };

  const handleSmartAI = async () => {
    const rawText = title + ' ' + description;
    if (!rawText.trim()) return;
    
    playSystemSound('click');
    setIsAiProcessing(true);

    const lower = rawText.toLowerCase();
    let detectedMode = mode;
    if (/(מחפש|צריך|מישהו יכול|למישהו יש|להשאיל|עזרה)/.test(lower)) detectedMode = 'request';
    else if (/(סקר|מה דעתכם|מה אומרים|הצבעה|איזה)/.test(lower)) detectedMode = 'poll';
    else detectedMode = 'post';
    
    setMode(detectedMode);
    if (/(מוכר|למכירה|₪|שקל)/.test(lower)) setShowPrice(true);

    try {
      if (detectedMode === 'poll') {
        const prompt = `אני מכין סקר לשכנים בנושא: "${rawText}". תחזיר JSON עם "title" (שאלת הסקר - חובה ללא אימוג'ים בכלל!) ו-"tags" (3 עד 4 תשובות אפשריות להצבעה, מנוסחות עניינית ללא אימוג'ים).`;
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt, mode: 'classify' }) });
        const data = await res.json();
        if (data.title) setTitle(stripEmojis(data.title));
        if (data.tags) setPollOptions(data.tags.map((t: string, i: number) => ({ id: Date.now().toString() + i, text: stripEmojis(t) })));
      } else {
        const prompt = `שפר את המודעה ללוח השכנים. 
        הנחיות חובה:
        1. השורה הראשונה תהיה כותרת קצרה ומושכת - *ללא אימוג'ים בכלל!*
        2. שאר השורות יהיו תיאור חברי (מותר לשלב מקסימום אימוג'י 1 או 2 בכל התיאור, לא יותר מזה).
        טקסט מקורי: "${rawText}"`;
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt, mode: 'insight' }) });
        const data = await res.json();
        if (data.text) {
          const split = data.text.split('\n');
          setTitle(stripEmojis(split[0].replace(/[*#]/g, '').trim()));
          setDescription(split.slice(1).join('\n').trim());
        }
      }
      playSystemSound('notification');
    } catch (err) {
      console.error(err);
    }
    
    setIsAiProcessing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'request') {
      await onSubmitRequest(title, description);
      return;
    }
    const finalCategory = getAutoCategory();
    const finalPrice = finalCategory === 'למכירה' ? (parseFloat(price) || 0) : 0;
    const finalOptions = mode === 'poll' ? pollOptions.filter(o => o.text.trim() !== '') : [];
    
    await onSubmitPost({ 
      title, description, price: finalPrice, contact_phone: defaultPhone, category: finalCategory, 
      file: media?.file || null, type: media?.type || 'image', item_type: mode === 'request' ? 'post' : mode, poll_options: finalOptions
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const newUrl = URL.createObjectURL(file);
      setPreviewUrl(newUrl);
      setMedia({ file, type: file.type.startsWith('video/') ? 'video' : 'image' });
    }
    if (e.target) e.target.value = '';
  };
  
  const clearMedia = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMedia(null);
  }, [previewUrl]);

  const handleOptionChange = (id: string, text: string) => setPollOptions(pollOptions.map(opt => opt.id === id ? { ...opt, text } : opt));
  const removeOption = (id: string) => setPollOptions(pollOptions.filter(opt => opt.id !== id));
  const addOption = () => { if (pollOptions.length < 5) setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]); };

  const isFormValid = title.trim() && (mode !== 'poll' || pollOptions.filter(o => o.text.trim()).length >= 2);

  const tabsStyle = mode === 'post' ? "right-1.5 bg-white border border-[#1D4ED8]/10" : mode === 'request' ? "right-[calc(33.33%+1.5px)] bg-white border border-[#10B981]/10" : "right-[calc(66.66%+1.5px)] bg-white border border-[#8B5CF6]/10";

  return (
    <AnimatedSheet isOpen={true} onClose={onClose}>
      {type === 'post' && (
        <div className="flex bg-slate-100/80 p-1.5 rounded-[1.2rem] mb-6 border border-slate-200/50 shadow-inner relative">
          <div className={`absolute top-1.5 bottom-1.5 w-[calc(33.33%-4px)] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-300 ease-out ${tabsStyle}`} />
          <button type="button" onClick={() => setMode('post')} className={`flex-1 py-3 text-[15px] font-black z-10 transition-colors ${mode === 'post' ? 'text-[#1D4ED8]' : 'text-slate-500 hover:text-slate-700'}`}>מודעה</button>
          <button type="button" onClick={() => setMode('request')} className={`flex-1 py-3 text-[15px] font-black z-10 transition-colors ${mode === 'request' ? 'text-[#10B981]' : 'text-slate-500 hover:text-slate-700'}`}>בקשת עזרה</button>
          <button type="button" onClick={() => setMode('poll')} className={`flex-1 py-3 text-[15px] font-black z-10 transition-colors ${mode === 'poll' ? 'text-[#8B5CF6]' : 'text-slate-500 hover:text-slate-700'}`}>סקר קהילתי</button>
        </div>
      )}

      {type === 'request' && (
        <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">בקשת עזרה מהשכנים</h3>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col relative min-h-[300px]">
        <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
          <input 
            autoFocus 
            type="text" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            placeholder={mode === 'poll' ? "שאלת הסקר..." : "כותרת קצרה..."} 
            className="w-full bg-transparent text-2xl font-black text-slate-800 placeholder-slate-300 outline-none mb-3 tracking-tight" 
          />
          
          {mode !== 'poll' && (
            <textarea 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="פרט כאן כל מה שרלוונטי (אפשר לכתוב קצר ולתת ל-AI להרחיב ✨)..." 
              className="w-full bg-transparent text-sm font-medium text-slate-600 placeholder-slate-400 outline-none resize-none leading-relaxed min-h-[100px] max-h-[180px] overflow-y-auto hide-scrollbar" 
            />
          )}

          {mode === 'poll' && (
            <div className="space-y-3 mt-4 pl-2 border-r-2 border-[#8B5CF6]/30 pr-4">
              {pollOptions.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 text-[10px] font-black shrink-0">{idx + 1}</span>
                  <input type="text" value={opt.text} onChange={(e) => handleOptionChange(opt.id, e.target.value)} className="flex-1 bg-transparent border-b border-dashed border-slate-300 py-2 text-sm font-bold text-slate-800 outline-none focus:border-[#8B5CF6] transition-colors placeholder-slate-300" placeholder="הקלד אפשרות..." />
                  {pollOptions.length > 2 && <button type="button" onClick={() => removeOption(opt.id)} className="text-slate-300 hover:text-red-500 transition px-2">✕</button>}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button type="button" onClick={addOption} className="text-[12px] font-black text-[#8B5CF6] bg-[#8B5CF6]/5 hover:bg-[#8B5CF6]/10 px-4 py-2.5 rounded-xl transition mt-2">+ הוסף עוד אפשרות</button>
              )}
            </div>
          )}

          {mode === 'post' && showPrice && (
            <div className="flex items-center gap-3 mt-6 bg-amber-50/50 p-2 rounded-2xl border border-amber-100/50 w-max">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center font-black text-amber-500 shadow-sm">₪</div>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" dir="ltr" className="w-24 bg-transparent text-xl font-black text-amber-700 outline-none text-left placeholder-amber-200" />
            </div>
          )}

          <MediaPreview previewUrl={previewUrl} type={media?.type} onClear={clearMedia} />
        </div>

        <div className="absolute bottom-0 left-0 right-0 pt-4 bg-gradient-to-t from-white via-white to-transparent flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-2">
            
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition active:scale-95 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>

            {mode === 'post' && !showPrice && (
              <button type="button" onClick={() => setShowPrice(true)} className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50 border border-slate-200 flex items-center justify-center transition active:scale-95 shadow-sm font-black">
                ₪
              </button>
            )}

            <button type="button" onClick={handleSmartAI} disabled={isAiProcessing || (!title && !description)} className="w-12 h-12 rounded-full bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20 text-[#1D4ED8] flex items-center justify-center transition-all active:scale-95 shadow-sm border border-[#1D4ED8]/20 disabled:opacity-50 disabled:grayscale relative group">
              {isAiProcessing ? (
                <span className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" fill="#1D4ED8"/><path opacity="0.5" d="M18 16L19 18.5L21.5 19.5L19 20.5L18 23L17 20.5L14.5 19.5L17 18.5L18 16Z" fill="#1D4ED8"/><path opacity="0.5" d="M6 14L6.6 15.5L8.1 16.1L6.6 16.7L6 18.2L5.4 16.7L3.9 16.1L5.4 15.5L6 14Z" fill="#1D4ED8"/></svg>
              )}
            </button>

          </div>

          <button type="submit" disabled={isSubmitting || !isFormValid} className="w-14 h-14 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-90 transition disabled:opacity-50 disabled:scale-100">
            {isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
          </button>
        </div>
      </form>
    </AnimatedSheet>
  );
}
