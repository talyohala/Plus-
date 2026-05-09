import React, { useState } from 'react';
import { Vendor } from './TicketCard';

interface VendorBookProps {
  vendors: Vendor[];
  isAdmin: boolean;
  currentUserId?: string;
  toastId: string | null;
  onClose: () => void;
  onAddVendor: (vendorData: { name: string; profession: string; phone: string; isFixed: boolean; rating: number }) => Promise<void>;
  onVendorPressStart: (vendor: Vendor) => void;
  onVendorPressEnd: () => void;
  onShowToast: (id: string) => void;
  formatWhatsApp: (phone: string, text?: string) => string;
}

export default function VendorBook({
  vendors,
  isAdmin,
  currentUserId,
  toastId,
  onClose,
  onAddVendor,
  onVendorPressStart,
  onVendorPressEnd,
  onShowToast,
  formatWhatsApp,
}: VendorBookProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [vendorTab, setVendorTab] = useState<'קבועים' | 'המלצות'>('קבועים');
  const [vendorSearch, setVendorSearch] = useState('');

  // Form states
  const [newName, setNewName] = useState('');
  const [newProfession, setNewProfession] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRating, setNewRating] = useState(5);
  const [isFixed, setIsFixed] = useState(false);

  const fixedVendors = vendors.filter((v) => v.is_fixed);
  const recommendedVendors = vendors.filter((v) => !v.is_fixed);

  const displayedVendors = (vendorTab === 'קבועים' ? fixedVendors : recommendedVendors).filter(
    (v) => !vendorSearch || v.name.includes(vendorSearch) || v.profession.includes(vendorSearch)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    await onAddVendor({
      name: newName,
      profession: newProfession,
      phone: newPhone,
      isFixed: isAdmin ? isFixed : false,
      rating: isAdmin && isFixed ? 5 : newRating,
    });
    setNewName('');
    setNewProfession('');
    setNewPhone('');
    setNewRating(5);
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom-10 fade-in duration-300" dir="rtl">
      <div className="px-5 pt-12 pb-4 flex items-center justify-between shrink-0 z-20 bg-[#F8FAFC] sticky top-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (isAdding) setIsAdding(false);
              else onClose();
            }}
            className="p-2 -mr-2 text-slate-500 hover:text-slate-800 transition active:scale-95"
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <h2 className="text-2xl font-black text-slate-800">{isAdding ? 'הוספת ספק' : 'פנקס ספקים'}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-32 relative z-10">
        {isAdding ? (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 rounded-[1.5rem] space-y-4 animate-in zoom-in-95">
            <input
              type="text"
              placeholder="שם (לדוג': יצחק החשמלאי)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8]/30 transition"
              required
            />
            <input
              type="text"
              placeholder="מקצוע (לדוג': חשמלאי)"
              value={newProfession}
              onChange={(e) => setNewProfession(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8]/30 transition"
              required
            />
            <input
              type="tel"
              placeholder="טלפון נייד"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold text-left focus:border-[#1D4ED8]/30 transition"
              dir="ltr"
              required
            />

            {isAdmin && (
              <label className="flex items-center gap-2 bg-[#E3F2FD]/50 p-3 rounded-xl cursor-pointer border border-[#BFDBFE]/50">
                <input
                  type="checkbox"
                  checked={isFixed}
                  onChange={(e) => setIsFixed(e.target.checked)}
                  className="w-4 h-4 text-[#2D5AF0] rounded border-gray-300"
                />
                <span className="text-xs font-bold text-slate-700">ספק קבוע של הבניין</span>
              </label>
            )}

            {(!isAdmin || !isFixed) && (
              <div className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500">דרג את השירות:</span>
                <div className="flex gap-1 flex-row-reverse">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      onClick={() => setNewRating(star)}
                      className={`w-8 h-8 cursor-pointer transition-transform hover:scale-110 ${
                        star <= newRating ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button type="submit" className="flex-1 bg-[#2D5AF0] text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition">
                שמור בפנקס
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="relative mb-5 shrink-0">
              <input
                type="text"
                placeholder="חיפוש איש מקצוע..."
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                className="w-full bg-white border border-slate-200/60 rounded-[1.2rem] py-3.5 px-4 pr-11 outline-none text-sm font-medium focus:border-[#1D4ED8]/40 transition shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
              />
              <svg className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="mb-6 shrink-0 bg-white/60 backdrop-blur-md shadow-sm rounded-full p-1.5 flex gap-1 border border-white relative z-10">
              <button
                onClick={() => setVendorTab('קבועים')}
                className={`flex-1 py-2.5 rounded-full text-sm transition-colors ${
                  vendorTab === 'קבועים'
                    ? 'font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm'
                    : 'font-bold text-slate-500 hover:text-orange-500/70'
                }`}
              >
                ספקי הבית
              </button>
              <button
                onClick={() => setVendorTab('המלצות')}
                className={`flex-1 py-2.5 rounded-full text-sm transition-colors ${
                  vendorTab === 'המלצות'
                    ? 'font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-sm'
                    : 'font-bold text-slate-500 hover:text-orange-500/70'
                }`}
              >
                המלצות שכנים
              </button>
            </div>

            <div className="space-y-4">
              {displayedVendors.map((v) => (
                <div key={v.id} className={`relative ${toastId === v.id ? 'z-50' : 'z-0'}`}>
                  {toastId === v.id && (
                    <div className="absolute -top-10 left-2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none whitespace-nowrap">
                      לחיצה ארוכה לניהול
                    </div>
                  )}

                  <div
                    onTouchStart={() => onVendorPressStart(v)}
                    onTouchEnd={onVendorPressEnd}
                    onTouchMove={onVendorPressEnd}
                    onClick={() => {
                      if (isAdmin || currentUserId === v.recommender_id) {
                        onShowToast(v.id);
                      }
                    }}
                    className="bg-white border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-4 rounded-[1.5rem] relative overflow-hidden transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none]"
                  >
                    {v.is_fixed && <div className="absolute top-0 right-0 bg-[#E3F2FD] text-[#1D4ED8] text-[9px] font-black px-3 py-0.5 rounded-bl-lg z-10">ספק הבית</div>}

                    <div className="flex items-start justify-between w-full mt-1 pointer-events-none">
                      <div className="flex items-center gap-3 pl-8">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-[#1D4ED8] shrink-0 border border-slate-100">
                          <h3 className="font-black text-lg">{v.name.charAt(0)}</h3>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-500 text-base leading-tight mb-0.5">{v.name}</h4>
                          <p className="text-sm font-black text-slate-900">{v.profession}</p>
                          {!v.is_fixed && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg key={star} className={`w-3 h-3 ${star <= (v.rating || 5) ? 'text-yellow-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                  </svg>
                                ))}
                              </div>
                              <span className="text-[9px] text-slate-400 font-medium">ע"י {v.profiles?.full_name?.split(' ')[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-1 pointer-events-auto">
                        <a href={`tel:${v.phone}`} onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                        </a>
                        <a href={formatWhatsApp(v.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                          </svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {displayedVendors.length === 0 && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300 shadow-sm border border-slate-100">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="text-slate-400 text-xs font-bold">לא נמצאו ספקים.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="fixed bottom-8 left-6 bg-white border border-[#E3F2FD] shadow-[0_8px_25px_rgba(29,78,216,0.15)] rounded-[2rem] flex items-center justify-between pl-1 pr-5 py-1.5 gap-4 active:scale-95 transition-transform z-50"
        >
          <span className="font-black text-[#1D4ED8] text-[15px]">איש מקצוע חדש</span>
          <div className="w-12 h-12 bg-[#E3F2FD] rounded-full flex items-center justify-center text-[#1D4ED8]">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
