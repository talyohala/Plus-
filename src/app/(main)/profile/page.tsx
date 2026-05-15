'use client'

import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { playSystemSound } from '../../../components/providers/AppManager';
import TenantList, { ProfileUser } from '../../../components/profile/TenantList';
import PendingNeighbors from '../../../components/profile/PendingNeighbors';
import AnimatedSheet from '../../../components/ui/AnimatedSheet';
import { WhatsAppIcon } from '../../../components/ui/ActionIcons';

interface BuildingData { id: string; name: string; invite_code?: string; entry_code?: string; }
interface PendingPaymentSummary { title: string; amount: number; }

const animalAvatars = [
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Lion.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Tiger.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Bear.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Panda.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Fox.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cat.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog.png',
  'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Rabbit.png'
];

const fetcher = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  let building = null;
  let neighbors: ProfileUser[] = [];
  let pendingPayments: PendingPaymentSummary[] = [];

  if (prof) {
    const { data: payments } = await supabase.from('payments').select('title, amount').eq('payer_id', user.id).eq('status', 'pending');
    if (payments) pendingPayments = payments;

    if (prof.building_id) {
      const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single();
      if (bld) {
        if (!bld.invite_code) {
          const newCode = 'B-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          await supabase.from('buildings').update({ invite_code: newCode }).eq('id', bld.id);
          bld.invite_code = newCode;
        }
        building = bld;
      }
      const { data: nbs } = await supabase.from('profiles').select('*').eq('building_id', prof.building_id);
      if (nbs) neighbors = nbs;
    }
  }
  return { user, profile: prof, building, neighbors, pendingPayments };
};

export default function ProfilePage() {
  const router = useRouter();
  const { data, error, mutate } = useSWR('/api/profile/fetch', fetcher, { revalidateOnFocus: true });

  const profile = data?.profile;
  const building = data?.building;
  const neighbors = data?.neighbors || [];
  const pendingPayments = data?.pendingPayments || [];

  const [editFullName, setEditFullName] = useState('');
  const [apartment, setApartment] = useState('');
  const [floor, setFloor] = useState('');
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newEntryCode, setNewEntryCode] = useState('');

  const [createBuildingName, setCreateBuildingName] = useState('');
  const [joinBuildingCode, setJoinBuildingCode] = useState('');

  const [isUpdating, setIsUpdating] = useState(false);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string; message: string; confirmText?: string; isDanger?: boolean; onConfirm: () => void } | null>(null);
  
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);
  const [mounted, setMounted] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const lastAnalyzedRef = useRef<string>('');

  const isAdmin = profile?.role === 'admin';
  const isPending = profile?.approval_status === 'pending';
  const allAdmins = neighbors.filter(n => n.role === 'admin').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const isFounder = profile?.id === (allAdmins.length > 0 ? allAdmins[0].id : null);
  const approvedNeighbors = neighbors.filter(n => n.approval_status?.trim() !== 'pending' && n.id !== profile?.id).sort((a, b) => (a.role === 'admin' ? -1 : 1));

  const aiAvatarUrl = profile?.avatar_url || "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (data?.profile) {
      setEditFullName(data.profile.full_name || '');
      setApartment(data.profile.apartment || '');
      setFloor(data.profile.floor || '');
    }
    if (data?.building) {
      setNewBuildingName(data.building.name || '');
      setNewEntryCode(data.building.entry_code || '');
    }
  }, [data?.profile, data?.building]);

  useEffect(() => {
    if (!data?.user?.id) return;
    const channel = supabase.channel(`profile_${data.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => mutate())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `payer_id=eq.${data.user.id}` }, () => mutate())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [data?.user?.id, mutate]);

  useEffect(() => {
    if (!profile || !building || neighbors.length === 0) {
      if (data) setIsAiLoading(false);
      return;
    }
    const pendingCount = neighbors.filter(n => n.approval_status === 'pending' && n.id !== profile.id).length;
    const currentHash = `${profile.id}-${pendingCount}-${pendingPayments.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;

    const fetchAiData = async () => {
      setIsAiLoading(true);
      try {
        const totalPendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);
        let context = isAdmin
          ? `מנהל הוועד: ${profile.full_name}. בבניין ${building.name} יש ${neighbors.length} דיירים ו-${pendingCount} בקשות הצטרפות ממתינות. מנהל זה טרם שילם ${totalPendingAmount} ₪ בקופה. נסח הודעת עזר מגוף ראשון כעוזר האישי שלו. כתוב בדיוק 3 שורות עם ירידת שורה ביניהן (\n). בלי המילה חוב. הוסף אימוג'י 1 בכל שורה.`
          : `דייר: ${profile.full_name}. גר בבניין ${building.name} שמכיל ${neighbors.length} דיירים. נותר לו לשלם סך של ${totalPendingAmount} ₪. נסח הודעת עזר אישית מגוף ראשון כעוזר האישי שלו. כתוב בדיוק 3 שורות קצרות עם ירידת שורה ביניהן (\n). בלי המילה חוב. הוסף אימוג'י 1 בכל שורה.`;

        const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: context, mode: 'insight' }) });
        const aiData = await res.json();
        setAiInsight(aiData.text || '');
      } catch (error) {
        setAiInsight(isAdmin ? `שלום ${profile.full_name}, הקהילה איתך! 🏢\nיש ${pendingCount} ממתינים לאישור 👥\nשים לב ליתרות הפתוחות שלך להסדרה ✨` : `היי ${profile.full_name}! כיף שאתה איתנו 🚀\nהקהילה שלנו מתרחבת 🏢\nאנא ודא שהתשלומים שלך מוסדרים ✨`);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 20000);
      }
    };
    fetchAiData();
  }, [profile, building, neighbors, pendingPayments, isAdmin, data]);

  const generateAdminDraft = async () => {
    if (!building || !profile) return;
    setIsGeneratingDraft(true); playSystemSound('click');
    try {
      const prompt = `אתה מנהל ועד הבית של בניין "${building.name}". סה"כ ${approvedNeighbors.length} דיירים רשומים. נסח הודעת וואטסאפ חכמה, קהילתית ומעודדת לשימוש באפליקציה "שכן+". עד 3 שורות עם אימוג'ים.`;
      const res = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ description: prompt, mode: 'insight' }) });
      const aiData = await res.json();
      navigator.clipboard.writeText(aiData.text || "היי שכנים! 🏢 מוזמנים להמשיך להשתמש באפליקציית שכן+ לכל פנייה לוועד.");
      playSystemSound('notification');
      setCustomAlert({ title: 'הודעה הועתקה!', message: 'ה-AI ניתח את נתוני הבניין ויצר טיוטה מותאמת.', type: 'success' });
    } catch (e) {
      setCustomAlert({ title: 'שגיאה', message: 'אירעה שגיאה ביצירת הטיוטה.', type: 'error' });
    } finally { setIsGeneratingDraft(false); }
  };

  const handleCreateBuilding = async () => {
    if (!createBuildingName.trim() || !profile) return;
    setIsUpdating(true);
    const { data: bldData } = await supabase.from('buildings').insert([{ name: createBuildingName }]).select().single();
    if (bldData) {
      await supabase.from('profiles').update({ building_id: bldData.id, role: 'admin', approval_status: 'approved' }).eq('id', profile.id);
      playSystemSound('notification'); setCreateBuildingName(''); mutate();
      setCustomAlert({ title: 'מזל טוב!', message: 'הבניין הוקם בהצלחה. כעת תוכל להזמין שכנים.', type: 'success' });
    }
    setIsUpdating(false);
  };

  const handleJoinBuilding = async () => {
    if (!joinBuildingCode.trim() || !profile) return;
    setIsUpdating(true);
    const { data: bldData } = await supabase.from('buildings').select('id, name').ilike('invite_code', joinBuildingCode.trim()).single();
    if (bldData) {
      await supabase.from('profiles').update({ building_id: bldData.id, role: 'tenant', approval_status: 'pending' }).eq('id', profile.id);
      const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', bldData.id).eq('role', 'admin');
      if (admins) {
        await supabase.from('notifications').insert(admins.map(a => ({ receiver_id: a.id, sender_id: profile.id, type: 'join_request', title: 'בקשת הצטרפות לבניין 🏢', content: `${profile.full_name || 'דייר חדש'} ביקש להצטרף.`, link: '/profile', is_read: false })));
      }
      playSystemSound('notification'); setJoinBuildingCode(''); mutate();
      setCustomAlert({ title: 'הבקשה נשלחה', message: 'בקשת ההצטרפות הועברה בהצלחה לראש הוועד.', type: 'success' });
    } else {
      setCustomAlert({ title: 'שגיאה', message: 'קוד הבניין שגוי או שאינו קיים.', type: 'error' });
    }
    setIsUpdating(false);
  };

  const triggerLeaveBuilding = () => {
    setCustomConfirm({
      title: 'עזיבת הבניין', message: 'האם אתה בטוח שברצונך לעזוב את קהילת הבניין?', confirmText: 'כן, עזוב בניין', isDanger: true,
      onConfirm: async () => {
        setIsUpdating(true);
        await supabase.from('profiles').update({ building_id: null, role: 'tenant', approval_status: null }).eq('id', profile?.id);
        playSystemSound('click'); setCustomConfirm(null); mutate(); setIsUpdating(false);
      }
    });
  };

  const triggerStepDown = () => {
    setCustomConfirm({
      title: 'התפטרות מוועד הבית', message: isFounder && allAdmins.length > 1 ? 'הניהול יעבור אוטומטית לחבר הוועד הבא.' : 'האם לוותר על הרשאות הניהול ולהפוך לדייר רגיל?', confirmText: 'כן, אני מתפטר', isDanger: true,
      onConfirm: async () => {
        setIsUpdating(true);
        await supabase.from('profiles').update({ role: 'tenant' }).eq('id', profile?.id);
        playSystemSound('click'); setCustomConfirm(null); mutate(); setIsUpdating(false);
      }
    });
  };

  const approveNeighbor = async (userId: string) => {
    await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', userId);
    await supabase.from('notifications').insert([{ receiver_id: userId, sender_id: profile?.id, type: 'system', title: 'ברוך הבא לבניין! 🎉', content: 'הוועד אישר את בקשת ההצטרפות שלך.', link: '/profile', is_read: false }]);
    playSystemSound('click'); mutate();
  };

  const rejectNeighbor = async (userId: string) => {
    setCustomConfirm({
      title: 'דחיית בקשה', message: 'האם לדחות את בקשת ההצטרפות?', confirmText: 'דחה בקשה', isDanger: true,
      onConfirm: async () => {
        await supabase.from('profiles').update({ building_id: null, approval_status: null }).eq('id', userId);
        playSystemSound('click'); mutate(); setCustomConfirm(null);
      }
    });
  };

  const updateAvatarInDB = async (url: string) => {
    setIsUpdating(true);
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile?.id);
    playSystemSound('notification'); mutate(); setIsUpdating(false); setIsAvatarMenuOpen(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !profile) return;
    setIsUpdating(true); setIsAvatarMenuOpen(false);
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${profile.id}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file);
    if (!uploadError) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
      await updateAvatarInDB(data.publicUrl);
    }
  };

  const resetToInitials = () => updateAvatarInDB(`https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile?.full_name || 'U')}&backgroundColor=EFF6FF&textColor=1D4ED8`);

  const updateBuildingDetails = async () => {
    if (!building) return; setIsUpdating(true);
    await supabase.from('buildings').update({ name: newBuildingName, entry_code: newEntryCode }).eq('id', building.id);
    playSystemSound('notification'); mutate(); setIsUpdating(false);
    setCustomAlert({ title: 'עודכן בהצלחה', message: 'פרטי הבניין נשמרו.', type: 'success' });
  };

  const updatePersonalDetails = async () => {
    if (!profile) return; setIsUpdating(true);
    await supabase.from('profiles').update({ apartment, floor, full_name: editFullName }).eq('id', profile.id);
    playSystemSound('notification'); mutate(); setIsUpdating(false);
    setCustomAlert({ title: 'עודכן בהצלחה', message: 'הפרטים האישיים נשמרו.', type: 'success' });
  };

  const toggleRole = async (userId: string, currentRole: string) => {
    await supabase.from('profiles').update({ role: currentRole === 'admin' ? 'tenant' : 'admin' }).eq('id', userId);
    playSystemSound('click'); mutate();
  };

  const copyBuildingCode = () => {
    navigator.clipboard.writeText(building?.invite_code || '');
    playSystemSound('click');
    setCustomAlert({ title: 'הועתק בהצלחה', message: 'קוד הבניין הועתק ללוח.', type: 'success' });
  };

  const formatWhatsAppLink = (phone: string) => {
    if (!phone) return '#'; const clean = phone.replace(/\D/g, '');
    return clean.startsWith('0') ? `https://wa.me/972${clean.substring(1)}` : `https://wa.me/${clean}`;
  };

  const inviteNeighbors = () => {
    const text = encodeURIComponent(`היי שכנים! 🏢\nהצטרפו לאפליקציית שכן+\n\nקוד ההצטרפות לבניין שלנו: *${building?.invite_code}*\n\nלהורדה: https://shechen-plus.com/join`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (!data && !error) return <div className="flex flex-col flex-1 w-full items-center justify-center pb-32 bg-transparent"><div className="w-16 h-16 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin" /></div>;
  if (!profile) return null;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen relative" dir="rtl">
      
      {mounted && customAlert && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg ${customAlert.type === 'success' ? 'bg-[#10B981]/10 text-[#10B981] animate-[bounce_1s_infinite]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' ? <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] text-white font-bold rounded-xl active:scale-95 transition text-lg">סגירה</button>
          </div>
        </div>, document.body
      )}

      {mounted && customConfirm && createPortal(
        <div className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" dir="rtl">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customConfirm.isDanger ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200 transition text-lg">ביטול</button>
              <button onClick={customConfirm.onConfirm} className={`flex-1 h-14 text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-lg flex items-center justify-center ${customConfirm.isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-[#1D4ED8] hover:bg-blue-700'}`}>{customConfirm.confirmText || 'אישור'}</button>
            </div>
          </div>
        </div>, document.body
      )}

      <div className="px-6 pt-6 pb-4 flex justify-between items-center sticky top-0 z-30">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">הפרופיל שלי</h2>
        <Link href="/settings" className="w-12 h-12 bg-white/60 backdrop-blur-md rounded-full text-[#1D4ED8] hover:bg-white border border-white/50 transition active:scale-95 flex items-center justify-center shadow-sm">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </Link>
      </div>

      <div className="px-6 space-y-6 relative z-10">
        <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5 flex flex-col gap-6 relative">
          <div className="flex items-start gap-5">
            <div onClick={() => setIsAvatarMenuOpen(true)} className="relative w-[5.5rem] h-[5.5rem] shrink-0 cursor-pointer group mt-1">
              <div className="w-full h-full rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                <img src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(profile.full_name)}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-full h-full object-cover" alt="avatar" />
                {isUpdating && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div>}
              </div>
              <div className="absolute bottom-0 -right-1 bg-white w-8 h-8 rounded-full shadow-md border border-gray-100 flex items-center justify-center text-[#1D4ED8] group-active:scale-90 transition z-20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <input type="text" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} className="text-2xl font-black text-slate-800 bg-transparent outline-none w-full pb-1 placeholder-slate-400/50 truncate" placeholder="שם מלא" />
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full inline-flex items-center shadow-sm border ${!building ? 'bg-orange-50/80 text-orange-600 border-orange-100' : isPending ? 'bg-yellow-50/80 text-yellow-600 border-yellow-100' : isFounder ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/30 shadow-[0_0_10px_rgba(29,78,216,0.2)]' : isAdmin ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20' : 'bg-white/80 text-slate-500 border-white'}`}>
                  {!building ? 'ללא קהילה' : isPending ? 'ממתין' : isFounder ? 'ראש ועד' : isAdmin ? 'חבר ועד' : 'דייר'}
                </span>
                {building && !isPending && isAdmin && (
                  <button onClick={generateAdminDraft} disabled={isGeneratingDraft} className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-indigo-500 text-white flex items-center justify-center shadow-sm active:scale-95 transition hover:scale-105 disabled:opacity-50">
                    {isGeneratingDraft ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 bg-white/70 backdrop-blur-sm border border-[#1D4ED8]/10 shadow-sm rounded-xl p-3.5"><label className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-wider mb-1.5 block">דירה</label><input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-transparent text-base font-black outline-none text-slate-800 transition" placeholder="-" /></div>
            <div className="flex-1 bg-white/70 backdrop-blur-sm border border-[#1D4ED8]/10 shadow-sm rounded-xl p-3.5"><label className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-wider mb-1.5 block">קומה</label><input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-transparent text-base font-black outline-none text-slate-800 transition" placeholder="-" /></div>
          </div>
          <button onClick={updatePersonalDetails} disabled={isUpdating} className="w-full h-14 bg-[#1D4ED8] text-white text-base font-bold rounded-xl shadow-md active:scale-95 transition disabled:opacity-50">שמירת פרטים אישיים</button>
        </div>

        {building && !isPending && (
          <Link href="/documents" className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5 flex items-center justify-between group cursor-pointer hover:bg-white transition-all active:scale-95">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1D4ED8]/10 text-[#1D4ED8] rounded-2xl flex items-center justify-center text-xl shadow-inner border border-[#1D4ED8]/20">
                   📁
                </div>
                <div>
                   <h3 className="text-base font-black text-slate-800">ארכיון מסמכים</h3>
                   <p className="text-xs text-slate-500 font-bold mt-0.5">חוזים, חשבוניות וביטוחים</p>
                </div>
             </div>
             <div className="w-10 h-10 bg-slate-50 group-hover:bg-[#1D4ED8]/10 rounded-full flex items-center justify-center transition-colors">
               <svg className="w-5 h-5 text-slate-400 group-hover:text-[#1D4ED8] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
             </div>
          </Link>
        )}

        {building && !isPending && (
          <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
            {showAiBubble && !isAiLoading && <div className="absolute bottom-[60px] right-0 mb-2 bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)] text-xs font-bold w-max max-w-[240px] leading-snug border border-[#1D4ED8]/20 text-right pointer-events-auto break-words animate-in fade-in slide-in-from-bottom-2 duration-500">{aiInsight}</div>}
            <button onClick={() => setShowAiBubble(!showAiBubble)} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}>{isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div> : <img src={aiAvatarUrl} alt="AI" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}</button>
          </div>
        )}

        {!building && !isPending && (
          <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5"><h3 className="text-base font-black text-slate-800 mb-1">הצטרפות לקהילה</h3><div className="flex gap-2 mt-4"><input type="text" value={joinBuildingCode} onChange={(e) => setJoinBuildingCode(e.target.value)} className="flex-1 min-w-0 bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-black outline-none text-[#1D4ED8] text-center tracking-[0.2em] uppercase transition placeholder:font-sans placeholder:text-slate-400/40 shadow-sm" placeholder="B-XXXX" dir="ltr" /><button onClick={handleJoinBuilding} disabled={isUpdating || !joinBuildingCode.trim()} className="shrink-0 bg-[#1D4ED8] text-white px-6 h-14 rounded-xl text-base font-bold active:scale-95 transition shadow-sm disabled:opacity-50">הצטרפות</button></div></div>
            <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5"><h3 className="text-base font-black text-slate-800 mb-1">הקמת קהילה חדשה</h3><div className="flex flex-col gap-3 mt-4"><input type="text" value={createBuildingName} onChange={(e) => setCreateBuildingName(e.target.value)} className="w-full bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-bold outline-none focus:border-[#1D4ED8]/30 text-slate-800 transition shadow-sm" placeholder="שם הבניין" /><button onClick={handleCreateBuilding} disabled={isUpdating || !createBuildingName.trim()} className="w-full h-14 bg-slate-800 text-white rounded-xl text-base font-bold active:scale-95 transition shadow-sm disabled:opacity-50 border border-slate-800">צור בניין חדש</button></div></div>
          </div>
        )}

        {isPending && building && (
          <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5 flex flex-col gap-4">
            <div className="bg-yellow-50/90 border border-yellow-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm"><div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-yellow-500 shrink-0 shadow-sm"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><div className="pt-1"><h3 className="text-base font-black text-slate-800 mb-1">ממתין לאישור הוועד</h3><p className="text-sm text-slate-600 font-medium leading-relaxed">בקשתך להצטרף אל <strong>{building.name}</strong> נשלחה לוועד הבית.</p></div></div>
            <button onClick={triggerLeaveBuilding} className="w-full h-14 bg-red-50/80 text-red-500 border border-red-100 text-base font-bold rounded-xl active:scale-95 transition flex items-center justify-center gap-2 shadow-sm">ביטול ועזיבה</button>
          </div>
        )}

        {building && !isPending && (
          <div className="space-y-6">
            <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5">
              <h4 className="text-[11px] font-black text-[#1D4ED8] uppercase tracking-wider mb-3">פרטי הבניין</h4>
              {isAdmin ? (
                <div className="flex flex-col gap-3">
                  <input type="text" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} className="w-full bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-bold outline-none focus:border-[#1D4ED8]/30 text-slate-800 transition shadow-sm" placeholder="שם הבניין" />
                  <input type="text" value={newEntryCode} onChange={(e) => setNewEntryCode(e.target.value)} className="w-full bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-bold outline-none focus:border-[#1D4ED8]/30 text-[#1D4ED8] transition shadow-sm text-left" dir="ltr" placeholder="קוד דלת אינטרקום (*1234#)" />
                  <button onClick={updateBuildingDetails} disabled={isUpdating || (newBuildingName === building.name && newEntryCode === (building.entry_code || ''))} className="w-full h-14 bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 rounded-xl text-base font-bold active:scale-95 transition shadow-sm disabled:opacity-50">עדכן פרטי בניין</button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="bg-white/80 border border-white shadow-sm p-4 rounded-xl font-black text-slate-800 text-base">{building.name}</div>
                  {building.entry_code && (
                    <div className="bg-[#1D4ED8]/5 border border-[#1D4ED8]/20 shadow-sm p-4 rounded-xl flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-600">קוד דלת:</span>
                      <span className="font-black text-xl font-mono text-[#1D4ED8] tracking-widest" dir="ltr">{building.entry_code}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {isAdmin && building.invite_code && (
              <div className="bg-white/60 backdrop-blur-xl border border-[#1D4ED8]/15 shadow-sm rounded-[1.5rem] p-5">
                <h4 className="text-[11px] font-black text-[#1D4ED8] uppercase tracking-wider mb-3">קוד הצטרפות</h4>
                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-[1.5rem] flex items-center justify-between">
                  <div><p className="text-2xl font-black font-mono text-[#1D4ED8] tracking-[0.1em]">{building.invite_code}</p></div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={copyBuildingCode} className="w-12 h-12 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    </button>
                    <button onClick={inviteNeighbors} className="w-12 h-12 rounded-xl bg-white text-slate-800 border border-slate-100 hover:bg-slate-50 shadow-md active:scale-95 transition flex items-center justify-center">
                      <WhatsAppIcon className="w-7 h-7" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isAdmin && <PendingNeighbors pendingNeighbors={neighbors.filter(n => n.approval_status === 'pending' && n.id !== profile.id)} onApprove={approveNeighbor} onReject={rejectNeighbor} />}

            <TenantList neighbors={approvedNeighbors} currentUserId={profile.id} founderId={allAdmins.length > 0 ? allAdmins[0].id : null} isAdmin={isAdmin} isFounder={isFounder} onToggleRole={toggleRole} formatWhatsApp={formatWhatsAppLink} />

            <div className="pt-2 space-y-3">
              <button onClick={triggerLeaveBuilding} className="w-full h-14 bg-white/60 backdrop-blur-sm border border-red-100 text-red-500 hover:bg-red-50 text-base font-bold rounded-xl active:scale-95 transition flex items-center justify-center gap-2 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>התנתקות מהבניין</button>
              {isAdmin && <button onClick={triggerStepDown} className="w-full h-14 bg-white/60 backdrop-blur-sm border border-red-100 text-red-500 hover:bg-red-50 text-base font-bold rounded-xl active:scale-95 transition flex items-center justify-center gap-2 shadow-sm"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z" /></svg>התפטר מתפקיד הוועד</button>}
            </div>
          </div>
        )}
      </div>

      <AnimatedSheet isOpen={isAvatarMenuOpen} onClose={() => setIsAvatarMenuOpen(false)}>
        <div className="flex justify-between items-center mb-6 px-1"><h3 className="font-black text-xl text-slate-800">תמונת פרופיל</h3></div>
        <div className="flex flex-col gap-4">
          <div className="bg-slate-50 p-5 rounded-[1.5rem] border border-gray-100 shadow-inner">
            <div className="grid grid-cols-4 gap-3">
              {animalAvatars.map((avatar, idx) => (
                <button key={idx} onClick={() => updateAvatarInDB(avatar)} className="aspect-square rounded-full bg-white border border-gray-100 hover:border-[#1D4ED8] hover:shadow-md transition active:scale-90 overflow-hidden flex items-center justify-center p-2 shadow-sm"><img src={avatar} className="w-full h-full object-contain drop-shadow-sm" alt="animal" /></button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarUpload} />
            <button onClick={() => avatarInputRef.current?.click()} className="flex-[2] h-14 flex items-center justify-center gap-2 bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 rounded-xl font-bold active:scale-95 transition shadow-sm text-base"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>מהגלריה</button>
            <button onClick={resetToInitials} className="flex-[1] h-14 flex items-center justify-center gap-2 bg-white shadow-sm text-slate-500 border border-gray-100 rounded-xl font-bold active:scale-95 transition text-base hover:text-slate-800">איפוס</button>
          </div>
        </div>
      </AnimatedSheet>
    </div>
  );
}
