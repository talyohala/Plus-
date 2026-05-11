'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { playSystemSound } from '../../../components/providers/AppManager';
import TicketCard, { ServiceTicket } from '../../../components/services/TicketCard';

export default function ServicesPage() {
  const [profile, setProfile] = useState<any>(null);
  const [tickets, setTickets] = useState<ServiceTicket[]>([]);
  const [activeTab, setActiveTab] = useState('הכל');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const fetchTickets = useCallback(async (userId: string) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!prof) return;
    setProfile(prof);
    const { data } = await supabase.from('service_tickets').select('*, profiles(full_name, avatar_url, apartment)').eq('building_id', prof.building_id).order('created_at', { ascending: false });
    if (data) setTickets(data);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) fetchTickets(user.id); });
  }, [fetchTickets]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const ticket = tickets.find(t => t.id === id);
    if (!ticket) return;

    await supabase.from('service_tickets').update({ status: newStatus }).eq('id', id);
    
    // שליחת התראה לדייר שפתח את התקלה (רק אם זה לא המנהל עצמו)
    if (ticket.user_id !== profile.id) {
      await supabase.from('notifications').insert([{
        receiver_id: ticket.user_id,
        sender_id: profile.id,
        type: 'service',
        title: `עדכון בתקלה: ${newStatus} 🛠️`,
        content: `הוועד עדכן את הסטטוס של "${ticket.title}" ל-${newStatus}.`,
        link: '/services'
      }]);
    }

    playSystemSound('notification');
    fetchTickets(profile.id);
  };

  const filteredTickets = useMemo(() => {
    return tickets.filter(t => {
      if (activeTab === 'פתוחות') return t.status === 'פתוח';
      if (activeTab === 'בטיפול') return t.status === 'בטיפול';
      if (activeTab === 'טופלו') return t.status === 'טופל';
      return true;
    });
  }, [tickets, activeTab]);

  return (
    <div className="flex flex-col flex-1 w-full pb-28 relative bg-transparent min-h-screen" dir="rtl" onClick={() => setOpenMenuId(null)}>
      <div className="px-4 mt-6 mb-5"><h2 className="text-2xl font-black text-slate-800 tracking-tight">תקלות ושירות</h2></div>
      <div className="px-4 mb-6">
        <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 overflow-x-auto hide-scrollbar">
          {['הכל', 'פתוחות', 'בטיפול', 'טופלו'].map(tab => (
            <button key={tab} onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }} className={`flex-1 min-w-[70px] h-10 px-2 rounded-full text-xs transition-all flex items-center justify-center whitespace-nowrap ${activeTab === tab ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'}`}>{tab}</button>
          ))}
        </div>
      </div>
      <div className="space-y-4 px-4 relative">
        {filteredTickets.map(ticket => (
          <TicketCard key={ticket.id} ticket={ticket} currentUserId={profile?.id} isAdmin={profile?.role === 'admin'} openMenuId={openMenuId} onToggleMenu={setOpenMenuId} onUpdateStatus={handleUpdateStatus} onDelete={(id) => { supabase.from('service_tickets').delete().eq('id', id).then(() => fetchTickets(profile.id)); }} onImageClick={() => {}} />
        ))}
      </div>
      <button onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 group flex-row-reverse active:scale-95 transition">
        <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full shadow-md font-black text-base">＋</div>
        <span className="font-black text-xs text-[#1D4ED8]">דיווח תקלה</span>
      </button>
    </div>
  );
}
