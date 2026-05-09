import React, { useState } from 'react';

export interface ProfileUser {
  id: string;
  full_name: string;
  avatar_url?: string;
  apartment?: string;
  floor?: string;
  role: string;
  building_id?: string | null;
  approval_status?: string | null;
  phone?: string;
  created_at: string;
}

interface TenantListProps {
  neighbors: ProfileUser[];
  currentUserId: string;
  founderId: string | null;
  isAdmin: boolean;
  isFounder: boolean;
  onToggleRole: (userId: string, currentRole: string) => void;
  formatWhatsApp: (phone: string) => string;
}

export default function TenantList({
  neighbors,
  currentUserId,
  founderId,
  isAdmin,
  isFounder,
  onToggleRole,
  formatWhatsApp,
}: TenantListProps) {
  const [neighborTab, setNeighborTab] = useState<'הכל' | 'הנהלה' | 'דיירים'>('הכל');

  const displayedNeighbors =
    neighborTab === 'הכל'
      ? neighbors
      : neighborTab === 'הנהלה'
      ? neighbors.filter((n) => n.role === 'admin')
      : neighbors.filter((n) => n.role !== 'admin');

  return (
    <div dir="rtl">
      <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">רשימת דיירים</h4>

      <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 mb-4">
        <button
          onClick={() => setNeighborTab('הכל')}
          className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${
            neighborTab === 'הכל' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'
          }`}
        >
          הכל
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
              neighborTab === 'הכל' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {neighbors.length}
          </span>
        </button>
        <button
          onClick={() => setNeighborTab('הנהלה')}
          className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${
            neighborTab === 'הנהלה' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'
          }`}
        >
          ועד
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
              neighborTab === 'הנהלה' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {neighbors.filter((n) => n.role === 'admin').length}
          </span>
        </button>
        <button
          onClick={() => setNeighborTab('דיירים')}
          className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${
            neighborTab === 'דיירים' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'
          }`}
        >
          דיירים
          <span
            className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
              neighborTab === 'דיירים' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {neighbors.filter((n) => n.role !== 'admin').length}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-3 animate-in fade-in duration-300">
        {displayedNeighbors.length === 0 ? (
          <div className="text-center text-slate-500 text-sm font-medium py-6 bg-white/40 rounded-3xl border border-dashed border-white/80">
            לא נמצאו תוצאות.
          </div>
        ) : (
          displayedNeighbors.map((n) => (
            <div key={n.id} className="flex items-center justify-between bg-white/80 border border-white shadow-sm p-3 rounded-[1.2rem] transition hover:bg-white">
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(n.full_name)}&backgroundColor=EFF6FF&textColor=1D4ED8`}
                  className="w-12 h-12 rounded-full bg-white shrink-0 object-cover border border-gray-100 shadow-sm"
                  alt="avatar"
                />
                <div className="truncate text-right">
                  <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                    <span className="truncate">{n.full_name}</span>
                    {n.role === 'admin' && (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-md font-black shrink-0 ${
                          n.id === founderId
                            ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/30 shadow-[0_0_10px_rgba(29,78,216,0.2)]'
                            : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'
                        }`}
                      >
                        {n.id === founderId ? 'ראש ועד' : 'ועד'}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500">
                    דירה {n.apartment || '?'} | קומה {n.floor || '?'}
                  </p>
                </div>
              </div>

              <div className="flex gap-1.5 shrink-0 pl-1 items-center">
                {n.phone && (
                  <a
                    href={formatWhatsApp(n.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-[#25D366] text-white shadow-sm active:scale-95 transition flex items-center justify-center border border-[#25D366]/50"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347" />
                    </svg>
                  </a>
                )}
                {isAdmin && n.id !== currentUserId && (n.role !== 'admin' || isFounder) && (
                  <button
                    onClick={() => onToggleRole(n.id, n.role)}
                    className={`text-[10px] font-black px-3 h-9 rounded-xl transition active:scale-95 flex items-center justify-center shadow-sm border ${
                      n.role === 'admin'
                        ? 'bg-red-50/80 text-red-500 border-red-100'
                        : 'bg-white text-slate-500 border-gray-100 hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8] hover:border-[#1D4ED8]/30'
                    }`}
                  >
                    {n.role === 'admin' ? 'הסר ועד' : 'מינוי'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
