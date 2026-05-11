import React, { useState, useRef, useEffect } from 'react';
import { Vendor } from './TicketCard';
import { supabase } from '../../lib/supabase';
import { playSystemSound } from '../providers/AppManager';

interface VendorBookProps {
  vendors: Vendor[];
  globalVendors?: Vendor[];
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
  vendors, globalVendors = [], isAdmin, currentUserId, toastId, onClose, onAddVendor, onUpdateVendor, onDeleteVendor, onShowToast, formatWhatsApp
}: VendorBookProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [activeMenuVendor, setActiveMenuVendor] = useState<Vendor | null>(null);
  const [vendorTab, setVendorTab] = useState<'ספקי הבניין' | 'מומלצים'>('ספקי הבניין');
  const [vendorSearch, setVendorSearch] = useState('');

  // ניהול דירוגים חכם ואמין (מבוסס על מאגר ארצי של כלל המשתמשים)
  const [vendorRatings, setVendorRatings] = useState<Record<string, { avg: string; count: number; userVote?: number }>>({});
  const [isRatingProcessing, setIsRatingProcessing] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({ name: '', profession: '', phone: '', rating: 5, isFixed: false });
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  const getDisplayedVendors = () => {
    let list = vendorTab === 'ספקי הבניין' 
      ? vendors.filter(v => v.is_fixed) 
      : [...vendors.filter(v => !v.is_fixed), ...globalVendors];
    
    // סינון כפילויות למקרה שיש ספקים מקומיים שגם במאגר הגלובלי (זיהוי לפי טלפון)
    list = Array.from(new Map(list.map(item => [item.phone, item])).values());

    return list.filter(v => !vendorSearch || v.name.includes(vendorSearch) || v.profession.includes(vendorSearch));
  };

  const displayedVendors = getDisplayedVendors();

  // טעינת שקלול הדירוגים הארצי מכל הבניינים בעת פתיחת המסך
  useEffect(() => {
    const fetchGlobalRatings = async () => {
      if (displayedVendors.length === 0 || !currentUserId) return;
      
      const phones = displayedVendors.map(v => v.phone);
      
      try {
        // שליפה מרוכזת של כל הדירוגים מהמאגר הגלובלי המאומת
        const { data: ratingsData } = await supabase
          .from('vendor_ratings')
          .select('vendor_phone, rating, user_id')
          .in('vendor_phone', phones);

        if (ratingsData) {
          const map: Record<string, { total: number; count: number; userVote?: number }> = {};
          
          ratingsData.forEach(r => {
            if (!map[r.vendor_phone]) map[r.vendor_phone] = { total: 0, count: 0 };
            map[r.vendor_phone].total += r.rating;
            map[r.vendor_phone].count += 1;
            
            // זיהוי אם המשתמש הנוכחי כבר דירג כדי למנוע הצבעות כפולות
            if (r.user_id === currentUserId) {
              map[r.vendor_phone].userVote = r.rating;
            }
          });

          const finalRatings: Record<string, { avg: string; count: number; userVote?: number }> = {};
          displayedVendors.forEach(v => {
            const stats = map[v.phone];
            if (stats && stats.count > 0) {
              finalRatings[v.id] = {
                avg: (stats.total / stats.count).toFixed(1),
                count: stats.count,
                userVote: stats.userVote
              };
            } else {
              // ברירת מחדל אם טרם דורג במאגר הארצי
              finalRatings[v.id] = { avg: Number(v.rating_avg || v.rating || 5).toFixed(1), count: 1 };
            }
          });

          setVendorRatings(finalRatings);
        }
      } catch (err) {
        console.error("Failed to load global verified ratings", err);
      }
    };

    fetchGlobalRatings();
  }, [vendorTab, vendorSearch, currentUserId]);

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

  // מנגנון הצבעה סופר-חכם, ארצי ומאומת למניעת זיופים
  const handleTenantRate = async (vendor: Vendor, newRating: number) => {
    if (!currentUserId || isRatingProcessing[vendor.id]) return;
    
    playSystemSound('click');
    setIsRatingProcessing(prev => ({ ...prev, [vendor.id]: true }));

    try {
      // עדכון אופטימי ב-UI לחוויה מיידית
      setVendorRatings(prev => {
        const current = prev[vendor.id] || { avg: '5.0', count: 0 };
        const oldVote = current.userVote;
        let newCount = current.count;
        let newTotal = parseFloat(current.avg) * current.count;

        if (oldVote) {
          newTotal = newTotal - oldVote + newRating;
        } else {
          newCount += 1;
          newTotal += newRating;
        }

        return {
          ...prev,
          [vendor.id]: {
            avg: (newTotal / newCount).toFixed(1),
            count: newCount,
            userVote: newRating
          }
        };
      });

      // Upsert מאובטח למסד הנתונים הארצי (מבוסס על מזהה משתמש + פלאפון הספק)
      await supabase
        .from('vendor_ratings')
        .upsert({ 
          vendor_phone: vendor.phone, 
          user_id: currentUserId, 
          rating: newRating,
          updated_at: new Date().toISOString()
        }, { onConflict: 'vendor_phone,user_id' });

    } catch (err) {
      console.error("Verification error during global rating submission", err);
    } finally {
      setIsRatingProcessing(prev => ({ ...prev, [vendor.id]: false }));
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
      {/* כותרת שחורה אחידה, בלי כפתור חזור */}
      <div className="px-5 pt-12 pb-4 flex items-center justify-between z-20 bg-[#F8FAFC] sticky top-0 border-b border-[#1D4ED8]/10">
        <h2 className="text-2xl font-black text-slate-800">{isAdding ? 'הוספת ספק' : editingVendor ? 'עריכת ספק' : 'אנשי מקצוע'}</h2>
        <button onClick={onClose} className="text-xs font-bold text-slate-400 hover:text-slate-600 transition px-2 py-1 bg-slate-100 rounded-lg">סגירה</button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-32">
        {(isAdding || editingVendor) ? (
          <form onSubmit={handleSubmit} className="bg-white border border-[#1D4ED8]/20 p-5 rounded-[1.5rem] space-y-4 mt-4 animate-in zoom-in-95 shadow-sm">
            <input type="text" placeholder="שם מלא / עסק" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-[#1D4ED8]/5 border border-[#1D4ED8]/10 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8] transition" required />
            <input type="text" placeholder="תחום עיסוק (למשל: חשמלאי)" value={formData.profession} onChange={e => setFormData({...formData, profession: e.target.value})} className="w-full p-4 bg-[#1D4ED8]/5 border border-[#1D4ED8]/10 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8] transition" required />
            <input type="tel" placeholder="טלפון נייד" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-4 bg-[#1D4ED8]/5 border border-[#1D4ED8]/10 rounded-xl outline-none text-sm font-bold text-left focus:border-[#1D4ED8] transition" dir="ltr" required />
            
            {isAdmin && (
              <label className="flex items-center gap-2 bg-[#1D4ED8]/10 p-4 rounded-xl cursor-pointer border border-[#1D4ED8]/20">
                <input type="checkbox" checked={formData.isFixed} onChange={e => setFormData({...formData, isFixed: e.target.checked})} className="w-5 h-5 text-[#1D4ED8] rounded border-gray-300" />
                <span className="text-sm font-black text-[#1D4ED8]">הגדר כספק הבית הקבוע</span>
              </label>
            )}

            <button type="submit" className="w-full h-14 flex items-center justify-center bg-[#1D4ED8] text-white text-lg font-bold rounded-xl shadow-[0_4px_15px_rgba(29,78,216,0.3)] active:scale-95 transition mt-2">שמור במאגר</button>
          </form>
        ) : (
          <>
            <div className="relative mb-5 mt-4">
              <input type="text" placeholder="חיפוש איש מקצוע..." value={vendorSearch} onChange={e => setVendorSearch(e.target.value)} className="w-full bg-white border border-[#1D4ED8]/20 rounded-[1.2rem] py-3.5 px-4 pr-11 outline-none text-sm font-bold focus:border-[#1D4ED8] shadow-sm text-slate-800" />
              <svg className="w-5 h-5 absolute right-4 top-3.5 text-[#1D4ED8]/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="mb-6 bg-white/80 backdrop-blur-md rounded-full p-1.5 flex gap-1 border border-[#1D4ED8]/10 shadow-sm">
              {['ספקי הבניין', 'מומלצים'].map(tab => (
                <button key={tab} onClick={() => setVendorTab(tab as any)} className={`flex-1 py-3 rounded-full text-sm transition-all flex items-center justify-center ${vendorTab === tab ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' : 'font-bold text-slate-500 hover:text-[#1D4ED8]/70'}`}>
                  {tab}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {displayedVendors.length === 0 ? (
                <div className="text-center py-10 bg-white/50 rounded-[1.5rem] border border-[#1D4ED8]/10">
                  <p className="text-[#1D4ED8]/60 font-bold text-sm">לא נמצאו ספקים בקטגוריה זו</p>
                </div>
              ) : (
                displayedVendors.map(v => {
                  const ratingObj = vendorRatings[v.id] || { avg: Number(v.rating_avg || v.rating || 5).toFixed(1), count: 1, userVote: undefined };
                  
                  return (
                    <div key={v.id} className={`relative ${toastId === v.id ? 'z-50' : 'z-0'}`}>
                      {toastId === v.id && <div className="absolute -top-10 left-2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none">לחיצה ארוכה לניהול</div>}

                      <div 
                        onTouchStart={() => handlePressStart(v)}
                        onTouchEnd={handlePressEnd}
                        onTouchMove={handlePressEnd}
                        onContextMenu={(e) => { e.preventDefault(); handlePressStart(v); }}
                        onClick={() => { if (isAdmin || currentUserId === v.recommender_id) onShowToast(v.id); }}
                        className="bg-white/80 backdrop-blur-sm border border-[#1D4ED8]/10 shadow-sm p-4 rounded-[1.5rem] relative overflow-hidden active:scale-[0.98] transition-transform select-none flex flex-col gap-3"
                      >
                        {v.is_fixed && <div className="absolute top-0 right-0 bg-[#1D4ED8] text-white text-[9px] font-black px-3 py-0.5 rounded-bl-lg z-10 shadow-sm">ספק הבית</div>}
                        {('is_global' in v) && <div className="absolute top-0 right-0 bg-amber-500 text-white text-[9px] font-black px-3 py-0.5 rounded-bl-lg z-10 shadow-sm">מאגר מומלצים</div>}
                        
                        <div className="flex items-center justify-between pointer-events-none">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center font-black shadow-sm bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20">
                              {v.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-base leading-tight">{v.name}</h4>
                              <p className="text-xs font-bold text-[#1D4ED8]/80 mt-0.5">{v.profession}</p>
                              
                              {/* תצוגת שקלול הדירוג הארצי המשודרגת (Gett/Uber Style) */}
                              <p className="text-[10px] font-bold text-slate-500 mt-1 flex items-center gap-1">
                                <span className="text-amber-500 font-black text-xs">⭐ {ratingObj.avg}</span> 
                                <span>(מבוסס על {ratingObj.count} {ratingObj.count === 1 ? 'המלצה' : 'חוות דעת'})</span>
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 pointer-events-auto shrink-0">
                            <a href={`tel:${v.phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#1D4ED8] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                            </a>
                            
                            <a href={formatWhatsApp(v.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.94 5.86L3 22l4.28-.93c1.62 1.07 3.55 1.7 5.66 1.7 5.52 0 10-4.48 10-10S17.52 2 12 2zm-.4 17.57c-1.74 0-3.41-.48-4.86-1.37l-.35-.2-2.91.63.64-2.81-.22-.36C3.01 13.9 2.5 12.21 2.5 10.43c0-4.69 3.81-8.5 8.5-8.5s8.5 3.81 8.5 8.5-3.81 8.5-8.5 8.5zm4.56-6.14c-.25-.13-1.48-.73-1.71-.82-.23-.08-.4-.13-.57.12-.17.25-.65.82-.8 1-.15.17-.3.2-.55.07-.25-.13-1.06-.39-2.02-1.11-.75-.56-1.25-1.26-1.4-1.51-.15-.25-.02-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.33-.02-.45-.06-.13-.57-1.38-.78-1.89-.2-.5-.41-.43-.57-.44-.15-.01-.32-.01-.49-.01-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1 0 1.24.9 2.44 1.03 2.61.13.17 1.78 2.71 4.31 3.8 1.48.64 2.06.77 2.78.65.6-.1 1.48-.6 1.69-1.19.21-.59.21-1.1.15-1.19-.06-.1-.23-.15-.48-.28z"/>
                              </svg>
                            </a>
                          </div>
                        </div>

                        {/* מודול דירוג אינטראקטיבי המחובר לענן הגלובלי */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between pointer-events-auto">
                          <span className="text-xs font-bold text-slate-500">
                            {ratingObj.userVote ? 'הדירוג שנשמר:' : 'דרג ספק זה:'}
                          </span>
                          <div className="flex items-center gap-1" dir="ltr">
                            {[1, 2, 3, 4, 5].map(star => {
                              const isChecked = ratingObj.userVote ? star <= ratingObj.userVote : false;
                              return (
                                <button 
                                  key={star}
                                  type="button"
                                  disabled={isRatingProcessing[v.id]}
                                  onClick={(e) => { e.stopPropagation(); handleTenantRate(v, star); }}
                                  className={`p-1 transition-transform active:scale-125 disabled:opacity-50 ${isChecked ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'}`}
                                >
                                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {activeMenuVendor && !('is_global' in activeMenuVendor) && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setActiveMenuVendor(null)}>
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-full relative border-t border-[#1D4ED8]/30" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            
            <button onClick={() => setActiveMenuVendor(null)} className="absolute top-5 left-5 w-12 h-12 flex items-center justify-center text-slate-400 hover:text-slate-600 transition active:scale-95 bg-gray-50 rounded-full" title="סגירה">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-black text-[#1D4ED8] text-center mb-8 px-10 truncate">{activeMenuVendor.name}</h3>
            
            <div className="flex justify-center gap-8 pt-2">
              <button onClick={() => handleEdit(activeMenuVendor)} className="flex flex-col items-center gap-2 active:scale-95 transition group">
                <div className="w-16 h-16 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center border border-[#1D4ED8]/20 shadow-sm group-hover:bg-[#1D4ED8]/20 transition"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></div>
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
        <button onClick={() => { playSystemSound('click'); setIsAdding(true); }} className="fixed bottom-8 left-6 bg-white border border-blue-100 shadow-[0_8px_30px_rgba(29,78,216,0.15)] rounded-[2rem] flex items-center pl-1 pr-5 py-1.5 gap-4 active:scale-95 transition-transform z-50">
          <span className="font-black text-[#1D4ED8] text-[15px]">ספק חדש</span>
          <div className="w-12 h-12 bg-[#1D4ED8] text-white rounded-full flex items-center justify-center shadow-md"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></div>
        </button>
      )}
    </div>
  );
}
