'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import AnimatedSheet from '../../../components/ui/AnimatedSheet';
import { DeleteIcon, WhatsAppIcon } from '../../../components/ui/ActionIcons';

interface DocumentRecord { id: string; building_id: string; uploaded_by: string; title: string; description: string; file_url: string; file_type: string; category: string; created_at: string; profiles?: { full_name: string; avatar_url: string; }; }

// טאבים קצרים, נקיים ומרווחים!
const categories = ['הכל', 'חוזים', 'חשבוניות', 'תקנונים', 'שונות'];

const fetcher = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Unauthorized');
  
  const { data: prof } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (!prof) throw new Error('Profile missing');

  const { data: docs } = await supabase.from('building_documents').select('*, profiles(full_name, avatar_url)').eq('building_id', prof.building_id).order('created_at', { ascending: false });

  return { profile: prof, documents: docs || [] };
};

export default function DocumentsPage() {
  const { data, error, mutate } = useSWR('/api/documents/fetch', fetcher, { revalidateOnFocus: true });
  const profile = data?.profile;
  const documents: DocumentRecord[] = data?.documents || [];

  const [activeTab, setActiveTab] = useState('הכל');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('חשבוניות');
  
  const [media, setMedia] = useState<{ file: File; type: string; preview: string } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null);
  const [mounted, setMounted] = useState(false);

  const isAdmin = profile?.role === 'admin';

  useEffect(() => { setMounted(true); }, []);
  
  useEffect(() => {
    return () => { if (media?.preview) URL.revokeObjectURL(media.preview); };
  }, [media]);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channel = supabase.channel(`documents_${profile.building_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'building_documents', filter: `building_id=eq.${profile.building_id}` }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, mutate]);

  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      // תמיכה בחיפוש חכם גם לקטגוריות הישנות אם יש במסד הנתונים
      const normalizedCat = doc.category.includes('חשב') ? 'חשבוניות' : doc.category.includes('חוז') ? 'חוזים' : doc.category.includes('תקנ') ? 'תקנונים' : doc.category;
      const matchesTab = activeTab === 'הכל' || normalizedCat === activeTab;
      const matchesSearch = !searchQuery || doc.title.includes(searchQuery) || doc.description?.includes(searchQuery);
      return matchesTab && matchesSearch;
    });
  }, [documents, activeTab, searchQuery]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (media?.preview) URL.revokeObjectURL(media.preview);
      setMedia({ file, type: file.type.includes('pdf') ? 'pdf' : 'image', preview: URL.createObjectURL(file) });
    }
    if (e.target) e.target.value = '';
  };
  
  const clearMedia = useCallback(() => {
    if (media?.preview) URL.revokeObjectURL(media.preview);
    setMedia(null);
  }, [media]);

  const handleSmartAI = async () => {
    if (!media || media.type !== 'image') {
      setCustomAlert({ title: 'לא נתמך', message: 'פענוח AI פועל כרגע על תמונות (JPG/PNG) בלבד, לא על קובצי PDF.', type: 'info' });
      return;
    }
    playSystemSound('click');
    setIsAiProcessing(true);

    const reader = new FileReader();
    reader.readAsDataURL(media.file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        let width = img.width; let height = img.height;
        if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        try {
          const prompt = `אני מנהל ועד בית. מצורפת תמונה של מסמך/חשבונית. חלץ ממנה פרטים והחזר JSON חוקי עם: "title" (שם העסק או מהות המסמך, נקי מאימוג'ים), "description" (תקציר המסמך, סכומים תאריכים אם יש, ענייני ומקצועי), ו-"category" (חובה לבחור רק מתוך: "חוזים", "חשבוניות", "תקנונים", "שונות").`;
          const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image: compressedBase64, description: prompt, mode: 'vision' }) });
          const data = await res.json();
          if (data.title) setTitle(data.title.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/gu, '').trim());
          if (data.description) setDescription(data.description);
          if (data.category && categories.includes(data.category)) setCategory(data.category);
          playSystemSound('notification');
        } catch (err) {
          setCustomAlert({ title: 'שגיאת פענוח', message: 'ה-AI לא הצליח לקרוא את המסמך.', type: 'error' });
        } finally { setIsAiProcessing(false); }
      };
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !media || !title.trim()) return;
    setIsSubmitting(true);
    
    const fileExt = media.file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    const { data: uploadData, error: uploadError } = await supabase.storage.from('documents').upload(fileName, media.file);
    
    if (uploadData) {
      const fileUrl = supabase.storage.from('documents').getPublicUrl(fileName).data.publicUrl;
      const { error } = await supabase.from('building_documents').insert([{ 
        building_id: profile.building_id, uploaded_by: profile.id, title, description, file_url: fileUrl, file_type: media.type, category 
      }]);
      
      if (!error) {
        setCustomAlert({ title: 'המסמך נשמר!', message: 'הקובץ עלה בהצלחה לארכיון הבניין.', type: 'success' });
        setTitle(''); setDescription(''); setCategory('חשבוניות'); clearMedia(); setIsModalOpen(false); playSystemSound('success'); mutate();
      } else { setCustomAlert({ title: 'שגיאה', message: 'העלאת נתונים נכשלה.', type: 'error' }); }
    } else { setCustomAlert({ title: 'שגיאה', message: 'העלאת הקובץ נכשלה.', type: 'error' }); }
    
    setIsSubmitting(false);
  };

  const handleDelete = (id: string) => {
    playSystemSound('click');
    setCustomConfirm({
      title: 'מחיקת מסמך', message: 'האם אתה בטוח שברצונך למחוק מסמך זה לצמיתות?', 
      onConfirm: async () => {
        await supabase.from('building_documents').delete().eq('id', id);
        mutate(); setCustomConfirm(null); playSystemSound('click');
      }
    });
  };

  const handleShareWhatsApp = (doc: DocumentRecord) => {
    playSystemSound('click');
    const text = encodeURIComponent(`📄 *${doc.title}*\n${doc.description ? doc.description + '\n' : ''}\nלצפייה במסמך: ${doc.file_url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const timeFormat = (dateStr: string) => new Date(dateStr).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });

  if (!data && !error) return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 relative bg-transparent min-h-[100dvh]" dir="rtl">
      {mounted && customAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)}>
          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] text-white font-bold rounded-xl active:scale-95 transition text-lg">סגירה</button>
          </div>
        </div>, document.body
      )}

      {mounted && customConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-rose-50 text-rose-500 shadow-sm"><svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg></div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-base text-slate-500 mb-6 font-medium">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200 transition text-lg">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 h-14 text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-lg flex items-center justify-center bg-rose-500 hover:bg-rose-600">מחק</button>
            </div>
          </div>
        </div>, document.body
      )}

      {/* תצוגת מסמך במסך מלא */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in cursor-pointer" onClick={() => setFullScreenImage(null)}>
          <button className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center text-white bg-white/10 hover:bg-white/20 rounded-full transition z-10 border border-white/20">✕</button>
          <img src={fullScreenImage} alt="Fullscreen" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}

      <div className="px-4 mt-6 mb-5"><h2 className="text-2xl font-black text-slate-800 tracking-tight">ארכיון מסמכים</h2></div>

      <div className="px-4 mb-4">
        <div className="relative">
          <input type="text" placeholder="חיפוש מסמך לפי שם או תיאור..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-white border border-[#1D4ED8]/20 rounded-[1.2rem] py-3.5 pr-4 pl-12 text-xs font-bold shadow-sm outline-none text-slate-800 focus:border-[#1D4ED8] transition" />
        </div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 overflow-x-auto hide-scrollbar gap-1.5">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)} className={`px-4 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold whitespace-nowrap shrink-0 ${activeTab === cat ? 'text-[#1D4ED8] bg-blue-50 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 bg-white/50 border border-transparent'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4 relative z-10 animate-in fade-in duration-300">
        {filteredDocs.length === 0 ? (
          <div className="text-center py-16 bg-white/60 backdrop-blur-md rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm">
            <div className="w-16 h-16 bg-[#1D4ED8]/5 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner text-[#1D4ED8]"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div>
            <p className="text-slate-500 font-bold text-sm">התיקייה ריקה כרגע ✨</p>
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.id} className="bg-white/90 backdrop-blur-xl rounded-[1.5rem] p-4 border border-[#1D4ED8]/10 shadow-[0_4px_20px_rgba(29,78,216,0.03)] flex items-start gap-4 group transition-all hover:shadow-[0_8px_30px_rgba(29,78,216,0.08)]">
              
              <div 
                onClick={() => doc.file_type === 'pdf' ? window.open(doc.file_url, '_blank') : setFullScreenImage(doc.file_url)}
                className={`w-14 h-14 rounded-2xl flex flex-col items-center justify-center shrink-0 shadow-sm transition active:scale-95 cursor-pointer ${doc.file_type === 'pdf' ? 'bg-rose-50 text-rose-500 border border-rose-100' : 'bg-blue-50 text-[#1D4ED8] border border-blue-100 overflow-hidden'}`}>
                {doc.file_type === 'pdf' ? (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <span className="text-[9px] font-black uppercase mt-0.5">PDF</span>
                  </>
                ) : (
                  <img src={doc.file_url} className="w-full h-full object-cover" alt="thumbnail" />
                )}
              </div>
              
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex justify-between items-start">
                  <h3 className="text-[15px] font-black text-slate-800 truncate pl-2">{doc.title}</h3>
                  <div className="flex gap-1 -mt-1 -ml-1">
                    <button onClick={() => handleShareWhatsApp(doc)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-[#25D366] hover:bg-[#25D366]/10 rounded-full transition">
                      <WhatsAppIcon className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => handleDelete(doc.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition">
                        <DeleteIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
                {doc.description && <p className="text-[11px] font-bold text-slate-500 mt-1 line-clamp-2 leading-snug">{doc.description}</p>}
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-1.5">
                    <img src={doc.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${doc.profiles?.full_name}`} className="w-5 h-5 rounded-full border border-slate-200" alt="uploader" />
                    <span className="text-[9px] font-bold text-slate-400">הועלה ע"י {doc.profiles?.full_name} • {timeFormat(doc.created_at)}</span>
                  </div>
                  <span className="text-[9px] font-black text-[#1D4ED8] bg-[#1D4ED8]/5 px-2 py-0.5 rounded-lg border border-[#1D4ED8]/10">{doc.category}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdmin && (
        <button onClick={() => { playSystemSound('click'); setIsModalOpen(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_8px_30px_rgba(29,78,216,0.15)] hover:scale-105 active:scale-95 transition flex items-center gap-2 group flex-row-reverse">
          <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md text-xl font-black">＋</div>
          <span className="font-black text-xs text-[#1D4ED8]">מסמך חדש</span>
        </button>
      )}

      {/* העלאת מסמך מודרנית */}
      <AnimatedSheet isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="flex justify-between items-center mb-6"><h2 className="text-2xl font-black text-slate-800 text-center w-full">העלאת מסמך לארכיון</h2></div>
        
        <form onSubmit={handleSubmit} className="flex flex-col relative min-h-[300px]">
          <div className="flex-1 overflow-y-auto hide-scrollbar pb-24">
            
            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
              {categories.filter(c => c !== 'הכל').map(c => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={`px-4 py-2 rounded-full text-xs font-bold shrink-0 transition-all shadow-sm border ${category === c ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>{c}</button>
              ))}
            </div>

            <div className="w-full bg-[#F8FAFC] border border-slate-200 rounded-[1.5rem] p-4 focus-within:border-[#1D4ED8] focus-within:shadow-[0_0_0_4px_rgba(29,78,216,0.1)] transition-all shadow-inner relative flex flex-col">
              <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="שם המסמך (למשל: חשבון חשמל אפריל)" className="w-full bg-transparent text-lg font-black text-slate-800 placeholder-slate-300 outline-none mb-2 tracking-tight" />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="תיאור קצר, סכומים או תאריכים..." className={`w-full bg-transparent text-sm font-bold outline-none resize-none min-h-[60px] text-slate-600 transition-all ${isAiProcessing ? 'placeholder-[#1D4ED8] animate-pulse' : 'placeholder-slate-400'}`} />
              
              {media?.preview && (
                <div className="relative inline-block mt-3 mb-1 group animate-in zoom-in-95 w-24 h-24">
                  <div className="w-full h-full rounded-2xl overflow-hidden shadow-sm border border-[#1D4ED8]/20 bg-slate-50 flex items-center justify-center relative">
                    {media.type === 'pdf' ? <span className="text-[#1D4ED8] font-black text-xs">PDF נטען</span> : <img src={media.preview} className="w-full h-full object-cover" alt="תצוגה" />}
                    {isAiProcessing && <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center"><span className="w-6 h-6 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div>}
                  </div>
                  {!isAiProcessing && (
                    <button type="button" onClick={clearMedia} className="absolute -top-2 -left-2 w-7 h-7 bg-white backdrop-blur-md text-slate-800 rounded-full flex items-center justify-center shadow-md hover:text-rose-600 transition active:scale-90 border border-slate-200 z-20"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg></button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 pt-4 bg-gradient-to-t from-white via-white to-transparent flex items-center justify-between border-t border-slate-100">
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*,application/pdf" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-slate-50 text-slate-500 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center justify-center transition active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>

              {media?.type === 'image' && (
                <button type="button" onClick={handleSmartAI} disabled={isAiProcessing} className="w-12 h-12 rounded-full bg-[#1D4ED8]/10 hover:bg-[#1D4ED8]/20 text-[#1D4ED8] flex items-center justify-center transition-all active:scale-95 shadow-sm border border-[#1D4ED8]/20 disabled:opacity-50 relative group">
                  {isAiProcessing ? <span className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none"><path d="M12 2L14.4 7.6L20 10L14.4 12.4L12 18L9.6 12.4L4 10L9.6 7.6L12 2Z" fill="#1D4ED8"/><path opacity="0.5" d="M18 16L19 18.5L21.5 19.5L19 20.5L18 23L17 20.5L14.5 19.5L17 18.5L18 16Z" fill="#1D4ED8"/><path opacity="0.5" d="M6 14L6.6 15.5L8.1 16.1L6.6 16.7L6 18.2L5.4 16.7L3.9 16.1L5.4 15.5L6 14Z" fill="#1D4ED8"/></svg>}
                  <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all text-[10px] font-bold text-white bg-slate-800 px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl pointer-events-none">פענח מסמך</span>
                </button>
              )}
            </div>

            <button type="submit" disabled={isSubmitting || !title.trim() || !media || isAiProcessing} className="w-14 h-14 rounded-full bg-[#1D4ED8] text-white flex items-center justify-center shadow-lg hover:bg-blue-700 active:scale-90 transition disabled:opacity-50 disabled:scale-100">
              {isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-6 h-6 transform -rotate-45 translate-x-px" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
            </button>
          </div>
        </form>
      </AnimatedSheet>
    </div>
  );
}
