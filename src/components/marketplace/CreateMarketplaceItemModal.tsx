import React, { useState, useRef, useEffect } from 'react';
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

export default function CreateMarketplaceItemModal({
  type, mainCategories, defaultPhone, isSubmitting, onClose, onSubmitPost, onSubmitRequest
}: CreateMarketplaceItemModalProps) {
  const [creationMode, setCreationMode] = useState<'post' | 'poll'>('post');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(type === 'request' ? 'בקשות שכנים' : 'למכירה');
  const [media, setMedia] = useState<{ file: File; type: string; preview: string } | null>(null);
  
  const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => { if (media?.preview) URL.revokeObjectURL(media.preview); };
  }, [media]);

  const handleAddOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]);
    }
  };

  const handleRemoveOption = (idToRemove: string) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter(opt => opt.id !== idToRemove));
    }
  };

  const handleOptionChange = (id: string, text: string) => {
    setPollOptions(pollOptions.map(opt => opt.id === id ? { ...opt, text } : opt));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setMedia({ file, type: file.type.startsWith('video/') ? 'video' : 'image', preview: previewUrl });
    }
  };

  const clearMedia = () => {
    setMedia(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAIEnhance = async () => {
    const baseText = title || description;
    if (!baseText.trim()) return;
    
    playSystemSound('click');
    setIsAiProcessing(true);
    
    try {
      if (creationMode === 'poll') {
        // AI מייצר כותרת יפה לסקר ואפשרויות תשובה אוטומטיות!
        const prompt = `אני מכין סקר לשכנים בבניין בנושא: "${baseText}". תחזיר לי JSON תקין עם 2 שדות: "title" (שאלת הסקר מנוסחת יפה) ו-"tags" (מערך של 3 עד 4 תשובות אפשריות להצבעה, קצרות וקולעות).`;
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt, mode: 'classify' }) });
        const data = await res.json();
        
        if (data.title) setTitle(data.title);
        if (data.tags && Array.isArray(data.tags)) {
          const newOptions = data.tags.map((t: string, i: number) => ({ id: Date.now().toString() + i, text: t }));
          setPollOptions(newOptions);
        }
      } else {
        // AI משפר את הניסוח של מודעה רגילה
        const prompt = `שפר את הניסוח של המודעה/בקשה הבאה ללוח השכנים של הבניין. שיהיה שיווקי, מזמין, חברי ועם אימוג'ים בטוב טעם. טקסט מקורי: "${baseText}"`;
        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt, mode: 'insight' }) });
        const data = await res.json();
        if (data.text) setDescription(data.text.trim());
      }
      playSystemSound('notification');
    } catch (err) {
      console.error("AI Error:", err);
    }
    
    setIsAiProcessing(false);
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'request') {
      await onSubmitRequest(title, description);
    } else {
      const isFree = ['למסירה', 'חבילות ודואר', 'השאלות כלים'].includes(category);
      const finalOptions = creationMode === 'poll' ? pollOptions.filter(o => o.text.trim() !== '') : [];
      await onSubmitPost({ 
        title, 
        description, 
        price: isFree || creationMode === 'poll' ? 0 : (parseFloat(price) || 0), 
        contact_phone: defaultPhone, 
        category: creationMode === 'poll' ? 'סקרים' : category, 
        file: media?.file || null, 
        type: media?.type || 'image',
        item_type: creationMode,
        poll_options: finalOptions
      });
    }
  };

  const isPriceHidden = ['למסירה', 'חבילות ודואר', 'השאלות כלים', 'בקשות שכנים'].includes(category) || creationMode === 'poll';
  const isPollValid = creationMode === 'post' || (creationMode === 'poll' && pollOptions.filter(o => o.text.trim() !== '').length >= 2);

  return (
    <AnimatedSheet isOpen={true} onClose={onClose}>
      <div className="flex justify-between items-center mb-5">
        <h3 className="font-black text-2xl text-slate-800 text-center w-full">
          {type === 'request' ? 'בקשת עזרה מהשכנים' : 'עדכון חדש ללוח'}
        </h3>
      </div>
      
      {type === 'post' && (
        <div className="flex bg-slate-100/80 p-1.5 rounded-[1rem] mb-6 border border-slate-200/60 shadow-inner relative">
          <div className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm transition-all duration-300 ease-out ${creationMode === 'post' ? 'right-1.5' : 'right-[calc(50%+3px)]'}`} />
          <button type="button" onClick={() => setCreationMode('post')} className={`flex-1 py-2 text-sm font-black z-10 transition-colors ${creationMode === 'post' ? 'text-[#1D4ED8]' : 'text-slate-500 hover:text-slate-700'}`}>מודעה / עדכון</button>
          <button type="button" onClick={() => setCreationMode('poll')} className={`flex-1 py-2 text-sm font-black z-10 transition-colors ${creationMode === 'poll' ? 'text-[#1D4ED8]' : 'text-slate-500 hover:text-slate-700'}`}>סקר קהילתי</button>
        </div>
      )}

      <form onSubmit={handlePostSubmit} className="space-y-4">
        
        {/* בחירת קטגוריה למודעה רגילה */}
        {type === 'post' && creationMode === 'post' && (
          <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
            {mainCategories.filter(c => !['הכל', 'שמורים', 'קהילה', 'סקרים'].includes(c)).map(c => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all shadow-sm border ${category === c ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {/* כותרת */}
        <input 
          required autoFocus 
          type="text" 
          value={title} 
          onChange={(e) => setTitle(e.target.value)} 
          className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-4 text-base font-black outline-none focus:border-[#1D4ED8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(29,78,216,0.1)] transition-all shadow-sm text-slate-800 placeholder:font-bold placeholder:text-slate-400" 
          placeholder={creationMode === 'poll' ? "מה השאלה לסקר? (לדוג': באיזה צבע נצבע?)" : "כותרת (למשל: ספה למסירה)"} 
        />

        {/* תיאור (רק בפוסט) */}
        {creationMode === 'post' && (
          <textarea 
            rows={3} 
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8] focus:bg-white focus:shadow-[0_0_0_4px_rgba(29,78,216,0.1)] resize-none shadow-sm transition-all text-slate-800 placeholder:text-slate-400" 
            placeholder={type === 'request' ? 'פרט קצת יותר, למה תזדקק?' : 'פרטים נוספים (מצב, מידות, שעות איסוף...)'} 
          />
        )}

        {/* כפתור ה-AI המטורף שלנו */}
        <div className="flex justify-end -mt-2 mb-2">
          <button type="button" onClick={handleAIEnhance} disabled={isAiProcessing || (!title.trim() && !description.trim())} className="bg-gradient-to-r from-[#1D4ED8] to-indigo-500 hover:from-blue-700 hover:to-indigo-600 text-white text-[11px] font-black px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale">
            {isAiProcessing ? (
              <><span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" /> ה-AI חושב...</>
            ) : (
              <><span>✨</span> נסח לי בעזרת AI</>
            )}
          </button>
        </div>

        {/* מחיר */}
        {type === 'post' && !isPriceHidden && (
          <div className="relative">
            <span className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 font-bold">₪</span>
            <input 
              type="number" 
              value={price} 
              onChange={(e) => setPrice(e.target.value)} 
              className="w-full h-14 bg-amber-50/50 border border-amber-200 rounded-2xl pl-4 pr-10 text-xl font-black text-amber-700 outline-none focus:border-amber-400 focus:bg-amber-50 focus:shadow-[0_0_0_4px_rgba(251,191,36,0.15)] shadow-inner transition-all text-left" 
              placeholder="0" 
              dir="ltr"
            />
          </div>
        )}

        {/* אפשרויות סקר */}
        {creationMode === 'poll' && (
          <div className="bg-[#1D4ED8]/5 p-5 rounded-[1.5rem] border border-[#1D4ED8]/10 shadow-inner mt-2 animate-in fade-in">
            <h4 className="text-xs font-black text-[#1D4ED8] mb-4 uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              אפשרויות הצבעה
            </h4>
            
            <div className="space-y-3">
              {pollOptions.map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2 animate-in slide-in-from-right-4">
                  <input 
                    type="text" 
                    value={opt.text} 
                    onChange={(e) => handleOptionChange(opt.id, e.target.value)} 
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-sm text-slate-800 transition-colors placeholder-slate-400" 
                    placeholder={`אפשרות ${idx + 1}`} 
                  />
                  {pollOptions.length > 2 && (
                    <button type="button" onClick={() => handleRemoveOption(opt.id)} className="w-11 h-11 bg-white border border-red-100 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-50 active:scale-95 transition-all shadow-sm shrink-0">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 5 && (
              <button type="button" onClick={handleAddOption} className="mt-4 h-11 w-full bg-white border border-slate-200 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-[#1D4ED8] hover:bg-blue-50/50 hover:border-blue-300 transition-all active:scale-95 shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg> 
                הוסף אפשרות נוספת
              </button>
            )}
          </div>
        )}
        
        {/* העלאת תמונה/וידאו */}
        {type === 'post' && creationMode === 'post' && (
          <div className="pt-2">
            <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            
            {media ? (
              <div className="relative inline-block group">
                <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-sm border border-slate-200 bg-slate-100">
                  {media.type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white"><svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>
                  ) : (
                    <img src={media.preview} alt="Preview" className="w-full h-full object-cover" />
                  )}
                </div>
                <button type="button" onClick={clearMedia} className="absolute -top-2 -right-2 bg-slate-800 text-white w-7 h-7 rounded-full flex items-center justify-center shadow-md hover:bg-rose-500 active:scale-90 transition-all border-2 border-white">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-14 bg-white border border-slate-200 border-dashed rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                צרוף תמונה או סרטון
              </button>
            )}
          </div>
        )}
        
        <button type="submit" disabled={isSubmitting || !title.trim() || !isPollValid} className="w-full h-14 mt-4 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] active:scale-95 transition-all disabled:opacity-50 text-lg flex items-center justify-center gap-2">
          {isSubmitting ? (
            <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> שומר במערכת...</>
          ) : (
            type === 'request' ? 'שלח בקשה' : creationMode === 'poll' ? 'פרסם סקר' : 'פרסם מודעה'
          )}
        </button>
      </form>
    </AnimatedSheet>
  );
}
