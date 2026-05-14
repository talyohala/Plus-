import React, { useState, useRef } from 'react';
import AnimatedSheet from '../ui/AnimatedSheet';

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
  const [media, setMedia] = useState<{ file: File; type: string } | null>(null);
  
  // Poll specific
  const [pollOptions, setPollOptions] = useState([{ id: '1', text: '' }, { id: '2', text: '' }]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, { id: Date.now().toString(), text: '' }]);
    }
  };

  const handleOptionChange = (id: string, text: string) => {
    setPollOptions(pollOptions.map(opt => opt.id === id ? { ...opt, text } : opt));
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setMedia({ file, type: file.type.startsWith('video/') ? 'video' : 'image' });
  };

  const isPriceHidden = ['למסירה', 'חבילות ודואר', 'השאלות כלים', 'בקשות שכנים'].includes(category) || creationMode === 'poll';
  const isPollValid = creationMode === 'post' || (creationMode === 'poll' && pollOptions.filter(o => o.text.trim() !== '').length >= 2);

  return (
    <AnimatedSheet isOpen={true} onClose={onClose}>
      <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">{type === 'request' ? 'בקשת עזרה מהשכנים' : 'עדכון חדש ללוח'}</h3>
      
      {type === 'post' && (
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200 shadow-inner">
          <button onClick={() => setCreationMode('post')} className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${creationMode === 'post' ? 'bg-white text-[#1D4ED8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>מודעה / עדכון</button>
          <button onClick={() => setCreationMode('poll')} className={`flex-1 py-2 text-sm font-black rounded-xl transition-all ${creationMode === 'poll' ? 'bg-white text-[#1D4ED8] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>סקר הצבעה</button>
        </div>
      )}

      <form onSubmit={handlePostSubmit} className="space-y-4">
        {type === 'post' && creationMode === 'post' && (
          <div className="flex gap-2 mb-2 overflow-x-auto hide-scrollbar pb-1">
            {mainCategories.filter(c => !['הכל', 'שמורים', 'קהילה', 'סקרים'].includes(c)).map(c => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={`px-4 py-1.5 rounded-full text-xs font-bold shrink-0 transition shadow-sm ${category === c ? 'bg-[#1D4ED8] text-white' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        {creationMode === 'post' && (
          <textarea autoFocus rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-[#F8FAFC] border border-slate-200 rounded-2xl p-4 text-sm font-bold outline-none focus:border-[#1D4ED8] resize-none shadow-inner text-slate-800" placeholder={type === 'request' ? 'איזו עזרה תצטרך?' : 'כתוב כאן מה תרצה לפרסם...'} />
        )}

        {creationMode === 'poll' && (
          <div className="space-y-3 bg-[#1D4ED8]/5 p-4 rounded-2xl border border-[#1D4ED8]/10">
            <h4 className="text-xs font-black text-[#1D4ED8] mb-2 uppercase tracking-wide">אפשרויות הצבעה</h4>
            {pollOptions.map((opt, idx) => (
              <input key={opt.id} type="text" value={opt.text} onChange={(e) => handleOptionChange(opt.id, e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-sm text-slate-800" placeholder={`אפשרות ${idx + 1}`} />
            ))}
            {pollOptions.length < 5 && (
              <button type="button" onClick={handleAddOption} className="text-xs font-bold text-[#1D4ED8] hover:underline flex items-center gap-1 mt-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg> הוסף אפשרות
              </button>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          {type === 'post' && creationMode === 'post' && (
            <button type="button" onClick={() => fileInputRef.current?.click()} className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-slate-200 transition ${media ? 'bg-emerald-50 text-emerald-500 border-emerald-200' : 'bg-slate-50 text-slate-400'}`}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            </button>
          )}
          <input type="file" accept="image/*,video/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
          <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner text-slate-800" placeholder={creationMode === 'poll' ? "מה השאלה לסקר? (לדוג': באיזה צבע נצבע את הלובי?)" : "כותרת"} />
        </div>

        {type === 'post' && !isPriceHidden && (
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full h-14 bg-amber-50 border border-amber-200 rounded-2xl px-4 text-xl font-black text-center text-amber-700 outline-none focus:border-amber-400 shadow-inner transition" placeholder="₪0" />
        )}
        
        <button type="submit" disabled={isSubmitting || !title.trim() || !isPollValid} className="w-full h-14 mt-2 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-95 transition disabled:opacity-50 text-lg">
          {isSubmitting ? 'משדר ללוח...' : 'פרסם בלוח'}
        </button>
      </form>
    </AnimatedSheet>
  );
}
