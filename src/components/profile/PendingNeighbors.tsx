import React from 'react';
import { ProfileUser } from './TenantList';

interface PendingNeighborsProps {
  pendingNeighbors: ProfileUser[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

export default function PendingNeighbors({ pendingNeighbors, onApprove, onReject }: PendingNeighborsProps) {
  if (pendingNeighbors.length === 0) return null;

  return (
    <div dir="rtl">
      <h4 className="text-[11px] font-black text-orange-500 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
        </span>
        ממתינים לאישור
      </h4>
      <div className="flex flex-col gap-3">
        {pendingNeighbors.map((n) => (
          <div key={n.id} className="flex items-center justify-between bg-white/80 border border-white shadow-sm p-3 rounded-[1.2rem]">
            <div className="flex items-center gap-3">
              <img
                src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(n.full_name)}&backgroundColor=EFF6FF&textColor=1D4ED8`}
                className="w-12 h-12 rounded-full bg-white object-cover border border-gray-100 shadow-sm"
                alt="avatar"
              />
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{n.full_name}</p>
                <p className="text-[10px] font-medium text-slate-500">
                  דירה {n.apartment || '?'} | קומה {n.floor || '?'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => onReject(n.id)}
                className="w-10 h-10 rounded-full bg-red-50/80 border border-red-100 text-red-500 flex items-center justify-center active:scale-95 transition shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button
                onClick={() => onApprove(n.id)}
                className="w-10 h-10 rounded-full bg-[#25D366] border border-[#25D366]/50 text-white flex items-center justify-center active:scale-95 transition shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
