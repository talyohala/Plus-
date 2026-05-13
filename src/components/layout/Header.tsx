'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { playSystemSound } from '../providers/AppManager';

export default function Header() {
  const [aiMessage, setAiMessage] = useState<{ text: string, type: 'searching' | 'matched' } | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

  useEffect(() => {
    fetchActiveRequests();

    // האזנה בזמן אמת לשינויים בבקשות ה-AI (למשל כשמישהו מאשר חניה)
    const channel = supabase
      .channel('smart_ai_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ai_smart_requests' }, (payload) => {
        handleRealtimeUpdate(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchActiveRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // שליפת בקשה פעילה שטרם פג תוקפה (פחות מ-24 שעות)
    const { data, error } = await supabase
      .from('ai_smart_requests')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .in('status', ['searching', 'matched'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      setActiveRequestId(data.id);
      updateBubbleUI(data);
    } else {
      setAiMessage(null); // הבקשה פגה תוקף או שאין בקשה
    }
  };

  const handleRealtimeUpdate = (newData: any) => {
    // אם הבקשה שלנו קיבלה מאצ' (מישהו לחץ בווטסאפ או באפליקציה)
    if (newData.id === activeRequestId && newData.status === 'matched') {
      playSystemSound('notification');
      updateBubbleUI(newData);
    }
  };

  const updateBubbleUI = (data: any) => {
    if (data.status === 'matched') {
      setAiMessage({ text: `🎉 ${data.matched_with_name} הציע לך חניה!`, type: 'matched' });
    } else if (data.status === 'searching') {
      setAiMessage({ text: 'מחפש חניה... הודעה נשלחה לשכנים', type: 'searching' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#1D4ED8] to-[#1E3A8A] pt-10 pb-4 px-6 rounded-b-[2.5rem] shadow-[0_10px_30px_rgba(29,78,216,0.25)]" dir="rtl">
      <div className="flex justify-between items-center max-w-md mx-auto">
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 flex items-center justify-center shadow-sm">
             <span className="text-white font-black text-xl">ש<span className="text-blue-300">+</span></span>
          </div>
          <div>
            <h2 className="text-white font-black text-lg leading-tight">שכן+</h2>
            <p className="text-blue-200/70 text-[10px] font-bold tracking-widest uppercase">Community OS</p>
          </div>
        </div>

        {/* --- הבועה החכמה של ה-AI --- */}
        {aiMessage && (
          <div className={`animate-in fade-in slide-in-from-top-4 duration-500 px-4 py-2 rounded-full border backdrop-blur-md shadow-lg flex items-center gap-2 ${
            aiMessage.type === 'matched' 
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-50' 
              : 'bg-white/10 border-white/20 text-white'
          }`}>
            {aiMessage.type === 'searching' && (
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" />
            )}
            <span className="text-xs font-bold tracking-tight">
              {aiMessage.text}
            </span>
          </div>
        )}

      </div>
    </header>
  );
}
