import React, { useState, useRef } from 'react';
import { Vendor } from './TicketCard';
import { playSystemSound } from '../providers/AppManager';

interface VendorBookProps {
  vendors: Vendor[];
  isAdmin: boolean;
  currentUserId?: string;
  toastId: string | null;
  onClose: () => void;
  onAddVendor: (vendorData: any) => Promise<void>;
  onUpdateVendor: (id: string, updates: any) => Promise<void>;
  onDeleteVendor: (id: string) => Promise<void>;
  onShowToast: (id: string) => void;
  formatWhatsApp: (phone: string) => string;
}

export default function VendorBook({
  vendors, isAdmin, currentUserId, toastId, onClose, onAddVendor, onUpdateVendor, onDeleteVendor, onShowToast, formatWhatsApp
}: VendorBookProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [activeMenuVendor, setActiveMenuVendor] = useState<Vendor | null>(null);
  const [vendorTab, setVendorTab] = useState<'קבועים' | 'המלצות'>('קבועים');
  const [vendorSearch, setVendorSearch] = useState('');

  const [formData, setFormData] = useState({ name: '', profession: '', phone: '', rating: 5, isFixed: false });
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const displayedVendors = (vendorTab === 'קבועים' ? vendors.filter(v => v.is_fixed) : vendors.filter(v => !v.is_fixed))
    .filter(v => !vendorSearch || v.name.includes(vendorSearch) || v.profession.includes(vendorSearch));

  const handlePressStart = (v: Vendor) => {
    const timer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      setActiveMenuVendor(v);
      playSystemSound('click');
    }, 400);
    pressTimer.current = timer;
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleEdit = (v: Vendor) => {
    setEditingVendor(v);
    setFormData({ name: v.name, profession: v.profession, phone: v.phone, rating: v.rating || 5, isFixed: v.is_fixed });
    setActiveMenuVendor(null);
  };

  const handleDelete = (id: string) => {
    if (confirm('האם למחוק ספק זה מהרשימה?')) {
      onDeleteVendor(id);
      setActiveMenuVendor(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingVendor) {
      await onUpdateVendor(editingVendor.id, { 
        name: formData.name, profession: formData.profession, 
        phone: formData.phone, rating: formData.rating, is_fixed: formData.isFixed 
      });
      setEditingVendor(null);
    } else {
      await onAddVendor({ 
        name: formData.name, profession: formData.profession, 
        phone: formData.phone, rating: formData.rating, is_fixed: isAdmin ? formData.isFixed : false 
      });
      setIsAdding(false);
    }
    setFormData({ name: '', profession: '', phone: '', rating: 5, isFixed: false });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom-10" dir="rtl">
      <div className="px-5 pt-12 pb-4 flex items-center justify-between z-20 bg-[#F8FAFC] sticky top-0 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <button onClick={() => { if (isAdding || editingVendor) { setIsAdding(false); setEditingVendor(null); } else onClose(); }} className="p-2 -mr-2 text-slate-500 active:scale-95">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
          </button>
          <h2 className="text-2xl font-black text-slate-800">{isAdding ? 'הוספת ספק' : editingVendor ? 'עריכת ספק' : 'ספקים'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-32">
        {(isAdding || editingVendor) ? (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 p-5 rounded-[1.5rem] space-y-4 mt-4 animate-in zoom-in-95">
            <input type="text" placeholder="שם ספק" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm font-bold" required />
            <input type="text" placeholder="מקצוע" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm font-bold" required />
            <input type="tel" placeholder="טלפון" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-slate-50 rounded-xl outline-none text-sm font-bold text-left" dir="ltr" required />
            
            {isAdmin && (
              <label className="flex items-center gap-2 bg-blue-50 p-3 rounded-xl cursor-pointer">
                <input type="checkbox" checked={formData.isFixed} onChange={e => setFormData({...formData, isFixed: e.target.checked})} className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-slate-700">ספק קבוע של הבניין</span>
              </label>
            )}

            <button type="submit" className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-lg active:scale-95 transition">שמור שינויים</button>
          </form>
        ) : (
          <>
            <div className="relative mb-5 mt-4">
              <input type="text" placeholder="חיפוש איש מקצוע..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.2rem] py-3.5 px-4 pr-11 outline-none text-sm font-medium focus:border-[#1D4ED8]" />
              <svg className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="mb-6 bg-white/60 backdrop-blur-md rounded-full p-1.5 flex gap-1 border border-white shadow-sm">
              {['קבועים', 'המלצות'].map(tab => (
                <button key={tab} onClick={() => setVendorTab(tab as any)} className={`flex-1 py-2.5 rounded-full text-sm transition-all ${vendorTab === tab ? 'font-black bg-orange-500 text-white shadow-md' : 'font-bold text-slate-500'}`}>{tab === 'קבועים' ? 'ספקי הבית' : 'המלצות'}</button>
              ))}
            </div>

            <div className="space-y-4">
              {displayedVendors.map(v => (
                <div key={v.id} className={`relative ${toastId === v.id ? 'z-50' : 'z-0'}`}>
                  {toastId === v.id && <div className="absolute -top-10 left-2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none">לחיצה ארוכה לניהול</div>}

                  <div 
                    onTouchStart={() => handlePressStart(v)}
                    onTouchEnd={handlePressEnd}
                    onTouchMove={handlePressEnd}
                    onContextMenu={(e) => { e.preventDefault(); handlePressStart(v); }}
                    onClick={() => { if (isAdmin || currentUserId === v.recommender_id) onShowToast(v.id); }}
                    className="bg-white border border-slate-100 shadow-sm p-4 rounded-[1.5rem] relative overflow-hidden active:scale-[0.98] transition-transform select-none"
                  >
                    {v.is_fixed && <div className="absolute top-0 right-0 bg-[#E3F2FD] text-[#1D4ED8] text-[9px] font-black px-3 py-0.5 rounded-bl-lg z-10">ספק הבית</div>}
                    
                    <div className="flex items-center justify-between pointer-events-none">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-[#1D4ED8] font-black border border-slate-100">{v.name.charAt(0)}</div>
                        <div>
                          <h4 className="font-black text-slate-800 text-base">{v.name}</h4>
                          <p className="text-xs font-bold text-slate-500">{v.profession}</p>
                        </div>
                      </div>
                      
                      {/* התיקון: החזרת אייקוני הרקע המלאים והיוקרתיים לטלפון ולוואטסאפ */}
                      <div className="flex gap-2 pointer-events-auto">
                        <a href={`tel:${v.phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </a>
                        <a href={formatWhatsApp(v.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.94 5.83L3 22l4.25-.93A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.42 14.08c-.24.68-1.37 1.3-1.9 1.4-.53.1-.98.17-1.48-.03-2.96-1.2-4.86-4.3-5.01-4.5-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .58.01.18 0 .44-.07.68.5.26.6.83 2.03.9 2.18.08.15.13.32.03.52-.1.2-.16.33-.31.51-.15.18-.33.42-.46.56-.16.16-.33.34-.14.63.19.3.8 1.32 1.72 2.14 1.19 1.06 2.19 1.39 2.5 1.54.3.15.48.13.65-.07.18-.22.81-.94 1.03-1.27.22-.33.43-.28.71-.18.28.1 1.8.85 2.11 1.01.31.16.52.23.6.36.08.13.08.78-.16 1.46z"/>
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* תפריט פעולות תואם (Bottom Sheet) עם כפתור איקס נקי בצד שמאל למעלה */}
      {activeMenuVendor && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setActiveMenuVendor(null)}>
          <div className="bg-white w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full relative" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            
            {/* כפתור איקס נקי למעלה בצד שמאל */}
            <button onClick={() => setActiveMenuVendor(null)} className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-600 transition active:scale-95" title="סגירה">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-black text-slate-800 text-center mb-8 px-8 truncate">{activeMenuVendor.name}</h3>
            
            <div className="flex justify-center gap-8 pt-2">
              <button onClick={() => handleEdit(activeMenuVendor)} className="flex flex-col items-center gap-2 active:scale-95 transition group">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm group-hover:bg-blue-100 transition"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
                <span className="text-xs font-black text-slate-600">עריכה</span>
              </button>
              
              {isAdmin && (
                <button onClick={() => handleDelete(activeMenuVendor.id)} className="flex flex-col items-center gap-2 active:scale-95 transition group">
                  <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shadow-sm group-hover:bg-red-100 transition"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
                  <span className="text-xs font-black text-red-600">מחיקה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {!isAdding && !editingVendor && (
        <button onClick={() => { playSystemSound('click'); setIsAdding(true); }} className="fixed bottom-8 left-6 bg-white border border-blue-100 shadow-xl rounded-[2rem] flex items-center pl-1 pr-5 py-1.5 gap-4 active:scale-95 transition-transform z-50">
          <span className="font-black text-[#1D4ED8] text-[15px]">ספק חדש</span>
          <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></div>
        </button>
      )}
    </div>
  );
}
