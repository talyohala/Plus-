'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabase';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../../components/providers/AppManager';

interface PaymentProfile {
  id: string;
  full_name: string;
  apartment?: string;
  avatar_url?: string;
  role?: string;
  phone?: string;
}

interface PaymentRecord {
  id: string;
  title: string;
  amount: number;
  status: string;
  created_at: string;
  payer_id: string;
  building_id: string;
  is_pinned?: boolean;
  profiles?: PaymentProfile;
}

interface SavedCard {
  id: string;
  type: string;
  last4: string;
  exp: string;
}

interface PaymentUser {
  id: string;
  full_name: string;
  building_id: string;
  role: string;
  avatar_url?: string;
  saved_payment_methods?: SavedCard[];
}

interface Building {
  id: string;
  name: string;
}

export default function PaymentsPage() {
  const [profile, setProfile] = useState<PaymentUser | null>(null);
  const [building, setBuilding] = useState<Building | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approval' | 'history'>('pending');
  const [expandedTabs, setExpandedTabs] = useState<Record<string, boolean>>({});
  
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(true);
  const [showAiBubble, setShowAiBubble] = useState(false);

  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [payingItem, setPayingItem] = useState<PaymentRecord | null>(null);
  const [paymentFlowStep, setPaymentFlowStep] = useState<'select' | 'credit_flow' | 'bit_flow' | 'bank_flow' | 'processing' | 'success'>('select');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [newCardDetails, setNewCardDetails] = useState({ number: '', expiry: '', cvv: '', saveCard: true });
  const [idNumber, setIdNumber] = useState('');

  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<PaymentRecord | null>(null);
  const [editingPaymentData, setEditingPaymentData] = useState<{ id: string; title: string; amount: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [toastId, setToastId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedRef = useRef<string>('');
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = profile?.role === 'admin';

  const aiAvatarUrl = useMemo(() => {
    const fallbackRobot = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
    return profile?.avatar_url || fallbackRobot;
  }, [profile?.avatar_url]);

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session) {
        setIsAiLoading(false);
        router.push('/login');
        return;
      }

      const response = await fetch('/api/payments/fetch', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
      });

      if (!response.ok) {
        throw new Error('API fetch failed');
      }

      const data = await response.json();

      if (data.profile) {
        setProfile(data.profile);
        if (data.profile.saved_payment_methods) {
          setSavedCards(data.profile.saved_payment_methods);
        }
        const { data: bld } = await supabase.from('buildings').select('*').eq('id', data.profile.building_id).single();
        if (bld) setBuilding(bld);
      }

      if (data.payments) {
        setPayments(data.payments);
      }
    } catch (err) {
      console.error("Fetch Data Error:", err);
    } finally {
      setIsAiLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!profile?.building_id) return;
    const channelTopic = `payments_realtime_${profile.id}`;
    const channel = supabase.channel(channelTopic)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments', filter: `building_id=eq.${profile.building_id}` }, () => {
        fetchData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.building_id, profile?.id, fetchData]);

  const pendingItems = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);
  const approvalItems = useMemo(() => payments.filter(p => p.status === 'pending_approval'), [payments]);
  const paidItems = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const exempts = useMemo(() => payments.filter(p => p.status === 'exempt'), [payments]);

  const totalCollected = useMemo(() => paidItems.reduce((sum, p) => sum + p.amount, 0), [paidItems]);
  const totalPendingVal = useMemo(() => [...pendingItems, ...approvalItems].reduce((sum, p) => sum + p.amount, 0), [pendingItems, approvalItems]);
  const totalTarget = useMemo(() => totalCollected + totalPendingVal + exempts.reduce((sum, p) => sum + p.amount, 0), [totalCollected, totalPendingVal, exempts]);

  useEffect(() => {
    if (!profile || payments.length === 0) return;
    const currentHash = `${profile.id}-${payments.length}`;
    if (lastAnalyzedRef.current === currentHash) return;
    lastAnalyzedRef.current = currentHash;

    const processAiAnalysis = async () => {
      setIsAiLoading(true);
      const myPending = pendingItems.filter(p => p.payer_id === profile.id);
      const myPendingAmount = myPending.reduce((s, p) => s + p.amount, 0);

      try {
        let context = '';
        const now = Date.now();

        if (isAdmin) {
          const overdueList = pendingItems
            .map(p => {
              const days = Math.floor((now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
              return `${p.profiles?.full_name || 'דייר'} (${p.amount}₪, ממתין ${days} ימים)`;
            })
            .slice(0, 8)
            .join(' | ');

          const rate = totalCollected + totalPendingVal > 0 ? Math.round((totalCollected / (totalCollected + totalPendingVal)) * 100) : 0;
          context = `מנהל הוועד: ${profile.full_name}. קופה: ₪${totalCollected}. פתוח לגבייה: ₪${totalPendingVal} (${pendingItems.length} דרישות). אחוז הצלחה: ${rate}%. רשימת פיגורים וזמן עבר: ${overdueList || 'אין'}. נסח ניתוח חכם, סמכותי ומכובד מגוף ראשון כרובוט העוזר שלו. זהה מי שילם ומי לא, כמה זמן עבר, והמלץ לתת התראה מכובדת או תזכורת לדיירים שמעכבים. כתוב בדיוק 3 שורות ענייניות. בלי המילה חוב. אימוג'י רלוונטי בכל שורה.`;
        } else {
          const myOverdueList = myPending
            .map(p => {
              const days = Math.floor((now - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
              return `${p.title} (פתוח ${days} ימים)`;
            })
            .join(', ');

          context = `דייר: ${profile.full_name}. ממתינים לו ${myPending.length} תשלומים בסך ₪${myPendingAmount}. פירוט וזמן עבר: ${myOverdueList}. נסח תזכורת אישית, מכובדת וחמודה מגוף ראשון כרובוט העוזר שלו. ציין בעדינות את הזמן שעבר ועודד אותו להסדיר. בדיוק 3 שורות. בלי המילה חוב. אימוג'י חמוד בכל שורה.`;
        }

        const res = await fetch('/api/ai/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ description: context, mode: 'insight' })
        });

        if (!res.ok) throw new Error('AI trigger failed');

        const data = await res.json();
        if (data && data.text) setAiInsight(data.text);
        else throw new Error('Empty text');
      } catch (err) {
        const fallbackText = isAdmin
          ? `שלום ${profile.full_name}, תמונת מצב חכמה 💼\nנאספו ${totalCollected.toLocaleString()} ₪ בקופה (${pendingItems.length} דרישות ממתינות) 📊\nמומלץ לשלוח תזכורת מכובדת לדיירים שטרם הסדירו ✨`
          : `היי ${profile.full_name}! תזכורת ידידותית 🚀\nממתינים להסדרה ${myPending.length} תשלומים (₪${myPendingAmount.toLocaleString()}) 💎\nנודה להסדרתך בהקדם למען הקהילה ✨`;
        setAiInsight(fallbackText);
      } finally {
        setIsAiLoading(false);
        setShowAiBubble(true);
        setTimeout(() => setShowAiBubble(false), 20000);
      }
    };

    processAiAnalysis();
  }, [profile, payments.length, isAdmin, pendingItems, totalCollected, totalPendingVal]);

  const handlePressStart = (payment: PaymentRecord) => {
    const timer = setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50);
      setActiveActionMenu(payment);
      playSystemSound('click');
    }, 400);
    pressTimer.current = timer;
  };

  const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current); };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !isAdmin || !newTitle || !newAmount) return;

    setIsSubmitting(true);
    const { data: tenants } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id);
    if (tenants && tenants.length > 0) {
      const paymentsToInsert = tenants.map(t => ({ payer_id: t.id, building_id: profile.building_id, amount: parseFloat(newAmount), title: newTitle, status: 'pending' }));
      const { error } = await supabase.from('payments').insert(paymentsToInsert);

      if (!error) {
        const tenantsToNotify = tenants.filter(t => t.id !== profile.id);
        if (tenantsToNotify.length > 0) {
          const notifs = tenantsToNotify.map(t => ({
            receiver_id: t.id,
            sender_id: profile.id,
            type: 'system',
            title: 'דרישת תשלום חדשה 💸',
            content: `ועד הבית פרסם דרישת תשלום עבור: ${newTitle}. הקופה פתוחה להסדרה.`,
            link: '/payments'
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
      playSystemSound('notification'); setIsCreating(false); setNewTitle(''); setNewAmount(''); setTranslateY(0);
      fetchData();
      setCustomAlert({ title: 'הדרישה נוצרה', message: 'בקשת התשלום נשלחה לכלל דיירי הבניין.', type: 'success' });
    }
    setIsSubmitting(false);
  };

  const handleInlineEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentData) return;
    setIsSubmitting(true);
    await supabase.from('payments').update({ title: editingPaymentData.title, amount: parseInt(editingPaymentData.amount) }).eq('id', editingPaymentData.id);
    setEditingPaymentData(null); playSystemSound('notification'); setTranslateY(0);
    fetchData();
    setIsSubmitting(false);
  };

  const executeAction = (action: () => void) => { setActiveActionMenu(null); setOpenMenuId(null); action(); };

  const deletePayment = (paymentId: string) => {
    setCustomConfirm({
      title: 'ביטול ומחיקה', message: 'האם לבטל תשלום זה? הסכום יקוזז אוטומטית מהקופה.',
      onConfirm: async () => { await supabase.from('payments').update({ status: 'canceled' }).eq('id', paymentId); fetchData(); setCustomConfirm(null); playSystemSound('click'); }
    });
  };

  const markAsExempt = (paymentId: string) => {
    setCustomConfirm({
      title: 'הענקת פטור', message: 'הדייר יקבל פטור מתשלום זה. לאשר?',
      onConfirm: async () => { await supabase.from('payments').update({ status: 'exempt' }).eq('id', paymentId); fetchData(); setCustomConfirm(null); playSystemSound('notification'); }
    });
  };

  const togglePinPayment = async (payment: PaymentRecord) => {
    const isPinned = !payment.is_pinned;
    await supabase.from('payments').update({ is_pinned: isPinned }).eq('id', payment.id);
    if (isPinned && profile) {
      const content = `📌 **הודעה חשובה לכלל הדיירים** 📌\n\nרצינו להזכיר שיש להסדיר את התשלום עבור: **${payment.title}**.\n\nאנא היכנסו לאפליקציה כדי לסגור את הפינה הזו. \nתודה רבה על שיתוף הפעולה למען הבניין של כולנו! 🏢✨`;
      await supabase.from('messages').insert([{ user_id: profile.id, content }]);
      playSystemSound('notification');
      setCustomAlert({ title: 'ננעץ ופורסם', message: 'התשלום הודגש ונשלחה תזכורת חגיגית לפיד.', type: 'success' });
    } else {
      playSystemSound('click');
    }
    fetchData();
  };

  const handlePersonalReminder = async (payment: PaymentRecord) => {
    if (!profile) return;
    await supabase.from('notifications').insert([{
      receiver_id: payment.payer_id,
      sender_id: profile.id,
      type: 'payment',
      title: 'תזכורת תשלום מוועד הבית ⏳',
      content: `אנא הסדר/י את התשלום עבור "${payment.title}" בסך ₪${payment.amount.toLocaleString()}. תודה רבה!`,
      link: '/payments'
    }]);

    const phone = payment.profiles?.phone;
    if (phone) {
      const daysOpen = Math.floor((Date.now() - new Date(payment.created_at).getTime()) / (1000 * 60 * 60 * 24));
      const text = encodeURIComponent(`היי ${payment.profiles?.full_name || ''}, תזכורת נעימה מוועד הבית 🏢\nנשמח להסדרת התשלום עבור "${payment.title}" בסך ₪${payment.amount.toLocaleString()} (פתוח ${daysOpen} ימים) דרך האפליקציה.\nתודה רבה על שיתוף הפעולה! ✨`);
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`, '_blank');
      playSystemSound('notification');
      setCustomAlert({ title: 'תזכורת כפולה נשלחה', message: 'נשלחה התראת פוש באפליקציה ונפתח חלון וואטסאפ בהצלחה.', type: 'success' });
    } else {
      playSystemSound('notification');
      setCustomAlert({ title: 'התראה נשלחה באפליקציה', message: 'נשלחה תזכורת מסודרת למערכת ההתראות של הדייר. (הערה: לא הוגדר לו מספר טלפון לשליחת וואטסאפ)', type: 'info' });
    }
  };

  const handleApprovePayment = async (paymentId: string, payerId: string, paymentTitle: string) => {
    if (!profile) return;
    const { error } = await supabase.from('payments').update({ status: 'paid' }).eq('id', paymentId);
    if (!error && payerId !== profile.id) {
      await supabase.from('notifications').insert([{
        receiver_id: payerId,
        sender_id: profile.id,
        type: 'system',
        title: 'התשלום שלך אושר! 🎉',
        content: `ועד הבית אישר את התשלום עבור: ${paymentTitle}. קבלה דיגיטלית הופקה במערכת.`,
        link: '/payments'
      }]);
    }
    playSystemSound('notification');
    setCustomAlert({ title: 'עסקה אושרה', message: 'התשלום קלט בהצלחה והופקה קבלה דיגיטלית לדייר.', type: 'success' });
    fetchData();
  };

  const startPaymentFlow = (payment: PaymentRecord) => { 
    setActiveActionMenu(null);
    setOpenMenuId(null);
    setPayingItem(payment); 
    setPaymentFlowStep('select'); 
  };

  const selectPaymentMethod = (method: 'credit' | 'bit' | 'bank') => {
    playSystemSound('click');
    if (method === 'credit') setPaymentFlowStep('credit_flow');
    if (method === 'bit') {
      setPaymentFlowStep('bit_flow');
      if (payingItem) {
         window.location.href = `https://bitpay.co.il/app/main?amount=${payingItem.amount}`;
      } else {
         window.location.href = 'bitpay://';
      }
    }
    if (method === 'bank') setPaymentFlowStep('bank_flow');
  };

  const confirmManualPayment = async (e: React.FormEvent, methodName: string) => {
    e.preventDefault();
    if (!payingItem || !profile) return;
    const { error } = await supabase.from('payments').update({ status: 'pending_approval' }).eq('id', payingItem.id);
    if (!error) {
      const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).eq('role', 'admin').neq('id', profile.id);
      if (admins && admins.length > 0) {
        const notifs = admins.map(admin => ({
          receiver_id: admin.id,
          sender_id: profile.id,
          type: 'system',
          title: 'דיווח תשלום ממתין לאישור',
          content: `${profile.full_name} דיווח על תשלום ב${methodName} עבור "${payingItem.title}". הכנס לאשר.`,
          link: '/payments'
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }
    closeAllModals();
    playSystemSound('notification');
    setCustomAlert({ title: 'הדיווח התקבל', message: `עסקת התשלום דרך ${methodName} נרשמה בהצלחה וממתינה לאישור הוועד.`, type: 'info' });
    fetchData();
  };

  const processCreditCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingItem || !profile) return;
    setPaymentFlowStep('processing');
    
    setTimeout(async () => {
      const { error } = await supabase.from('payments').update({ status: 'paid' }).eq('id', payingItem.id);
      if (!error) {
        const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).eq('role', 'admin').neq('id', profile.id);
        if (admins && admins.length > 0) {
          const notifs = admins.map(admin => ({
            receiver_id: admin.id, sender_id: profile.id, type: 'system',
            title: 'תשלום באשראי התקבל! 💳',
            content: `${profile.full_name} שילם הרגע באשראי עבור: ${payingItem.title}.`,
            link: '/payments'
          }));
          await supabase.from('notifications').insert(notifs);
        }
      }
      playSystemSound('notification');
      closeAllModals();
      setCustomAlert({ title: 'עסקה אושרה!', message: 'התשלום באשראי עבר בהצלחה וקבלה הופקה במערכת.', type: 'success' });
      fetchData();
    }, 2500);
  };

  const formatDetailedDate = (dateString?: string) => {
    const d = dateString ? new Date(dateString) : new Date();
    return new Intl.DateTimeFormat('he-IL', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const generatePDF = (title: string, htmlContent: string) => {
    const htmlTemplate = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>${title}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @media print {
            @page { margin: 0; size: auto; }
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
          }
          body { font-family: system-ui, sans-serif; background-color: #fff; margin:0; padding: 0; min-height:100vh; width: 100vw; display:flex; flex-direction:column; overflow-x: hidden; }
          .edge-container { width: 100%; min-height: 100vh; display: flex; flex-direction: column; padding: 2rem; box-sizing: border-box; }
          .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 45px; letter-spacing: 2px; }
        </style>
        <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
      </head>
      <body>
        <div class="edge-container">
          ${htmlContent}
          <div class="mt-auto pt-6 text-center no-print">
            <button onclick="window.print()" class="bg-[#1D4ED8] text-white px-6 py-4 rounded-2xl font-black w-full mb-3 text-lg active:scale-95 transition-transform shadow-lg">הדפסה / שמירה כ-PDF</button>
            <button onclick="window.close()" class="text-slate-600 bg-slate-100 font-bold px-6 py-4 rounded-2xl w-full text-lg active:scale-95 transition-transform">סגירת מסמך</button>
          </div>
        </div>
      </body>
      </html>
    `;
    const url = URL.createObjectURL(new Blob([htmlTemplate], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank');
  };

  const downloadReceipt = (payment: PaymentRecord) => {
    const fullDate = formatDetailedDate(payment.created_at);
    const refNumber = payment.id.split('-')[0].toUpperCase() + Math.floor(Math.random() * 1000);
    const receiptHtml = `
      <div class="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-6 mt-2">
        <div>
          <h1 class="text-4xl font-black text-[#1D4ED8] tracking-tight">שכן<span class="text-slate-800">+</span></h1>
          <p class="text-slate-500 font-bold text-sm mt-1">ניהול קהילה חכם</p>
        </div>
        <div class="text-left">
          <h2 class="text-2xl font-black text-slate-800">אישור תשלום</h2>
          <p class="text-sm font-bold text-slate-400 mt-1">מקור דיגיטלי</p>
        </div>
      </div>
      <div class="mb-6 flex justify-between">
        <div>
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">פרטי המנפיק</p>
          <p class="text-lg font-black text-slate-800 mt-1">ועד הבית: ${building?.name || ''}</p>
          <p class="text-xs font-bold text-slate-500">מוסד ללא כוונת רווח (מלכ״ר)</p>
        </div>
        <div class="text-left">
          <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">זמן הפקה</p>
          <p class="text-sm font-bold text-slate-800 mt-1">${fullDate}</p>
          <p class="text-xs font-mono text-slate-500 mt-1">Ref: ${refNumber}</p>
        </div>
      </div>
      <div class="mb-6">
        <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">פרטי המשלם</p>
        <div class="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
          <span class="font-black text-lg text-slate-800">${payment.profiles?.full_name || profile?.full_name || ''}</span>
          <span class="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs font-bold text-slate-600">דירה ${payment.profiles?.apartment || '?'}</span>
        </div>
      </div>
      <table class="w-full text-right border-collapse mb-8">
        <thead>
          <tr class="text-slate-400 text-xs border-b-2 border-slate-200 uppercase tracking-wide">
            <th class="py-3 pr-2 font-bold">מהות התשלום</th>
            <th class="py-3 text-center font-bold">כמות</th>
            <th class="py-3 pl-2 text-left font-bold">סכום</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-slate-100 text-base">
            <td class="py-4 pr-2 font-black text-slate-800">${payment.title}</td>
            <td class="py-4 text-center font-bold text-slate-600">1</td>
            <td class="py-4 pl-2 font-black text-left text-slate-800">₪${payment.amount}</td>
          </tr>
        </tbody>
      </table>
      <div class="flex justify-between items-end p-6 bg-[#1D4ED8]/5 rounded-[2rem] border border-[#1D4ED8]/20 mb-8">
        <div>
          <p class="text-xs font-bold text-[#1D4ED8] uppercase tracking-wide">סך הכל ששולם</p>
          <p class="text-[10px] font-bold text-slate-500 mt-1">פטור ממע״מ לפי סעיף 31(3)</p>
        </div>
        <div class="text-left">
          <span class="font-black text-[#1D4ED8] text-5xl tracking-tight">₪${payment.amount}</span>
        </div>
      </div>
      <div class="mt-8 text-center flex flex-col items-center">
        <div class="barcode text-slate-800">${refNumber}</div>
        <p class="text-xs font-bold text-slate-400 mt-2">התשלום נרשם ואומת במערכת שכן+ בהצלחה.</p>
      </div>
    `;
    generatePDF(`אישור_תשלום_${payment.title}`, receiptHtml);
  };

  const generateAdminReport = () => {
    setIsShareMenuOpen(false);
    setTranslateY(0);
    playSystemSound('notification');
    const fullDate = formatDetailedDate();
    let tableRows = payments.map(p => {
      let statusHtml = p.status === 'paid' ? '<span class="text-emerald-600 font-bold">שולם</span>' : p.status === 'exempt' ? '<span class="text-slate-400">פטור</span>' : '<span class="text-slate-800 font-bold">ממתין</span>';
      return `<tr class="border-b border-slate-100 text-sm"><td class="py-4 pr-2 text-slate-800 font-bold">${p.profiles?.full_name || ''}</td><td class="py-4 text-slate-600">${p.title}</td><td class="py-4 font-black text-left text-slate-800">₪${p.amount}</td><td class="py-4 pl-2 text-left">${statusHtml}</td></tr>`;
    }).join('');

    const reportHtml = `
      <div class="flex justify-between items-start border-b-2 border-slate-100 pb-6 mb-8 mt-2">
        <div>
          <h1 class="text-4xl font-black text-[#1D4ED8] tracking-tight">שכן<span class="text-slate-800">+</span></h1>
          <p class="text-slate-500 font-bold text-sm mt-1">ניהול קהילה חכם</p>
        </div>
        <div class="text-left">
          <h2 class="text-2xl font-black text-slate-800">דוח גבייה תקופתי</h2>
          <p class="text-sm font-bold text-slate-500 mt-1">ועד בית: ${building?.name || ''}</p>
        </div>
      </div>
      <p class="text-sm font-bold text-slate-400 mb-4 text-left">${fullDate}</p>
      <div class="flex justify-between gap-4 mb-8 text-center">
        <div class="flex-1 bg-[#1D4ED8]/5 p-5 rounded-3xl border border-[#1D4ED8]/10 shadow-sm">
          <p class="text-xs text-[#1D4ED8] font-bold uppercase mb-2 tracking-wide">נאסף בקופה</p>
          <p class="text-3xl font-black text-[#1D4ED8]">₪${totalCollected.toLocaleString()}</p>
        </div>
        <div class="flex-1 bg-slate-50 p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p class="text-xs text-slate-600 font-bold uppercase mb-2 tracking-wide">נותר לגבות</p>
          <p class="text-3xl font-black text-slate-800">₪${totalPendingVal.toLocaleString()}</p>
        </div>
      </div>
      <h3 class="text-lg font-black text-slate-800 mb-3 border-b-2 border-slate-800 inline-block pb-1">פירוט תנועות</h3>
      <table class="w-full text-right border-collapse mb-6">
        <thead>
          <tr class="text-slate-400 text-xs border-b-2 border-slate-200 uppercase tracking-wide">
            <th class="py-3 pr-2 font-bold">שם הדייר</th><th class="py-3 font-bold">תיאור</th><th class="py-3 text-left font-bold">סכום</th><th class="py-3 pl-2 text-left font-bold">סטטוס</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    generatePDF(`דוח_גבייה_${building?.name || 'ועד'}`, reportHtml);
  };

  const shareToAppChat = async () => {
    if (!profile) return;
    setIsShareMenuOpen(false);
    setTranslateY(0);
    playSystemSound('click');
    const content = `📊 **סטטוס קופת הבניין** 📊\n✅ נאסף: ₪${totalCollected.toLocaleString()}\n⏳ פתוחים: ₪${totalPendingVal.toLocaleString()}\n\nתודה רבה לכל מי שהסדיר את התשלומים. אנא היכנסו ללשונית "תשלומים" להסדרת יתרות. 🙏`;

    try {
      const res = await fetch('/api/ai/omni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          userId: profile.id,
          buildingId: profile.building_id
        })
      });

      if (res.ok) {
        playSystemSound('notification');
        setCustomAlert({ title: 'פורסם בהצלחה', message: 'הדוח נשלח ישירות לקבוצת הצ\'אט של הבניין.', type: 'success' });
      } else {
        throw new Error('Chat API writing error');
      }
    } catch (err) {
      await supabase.from('messages').insert([{ building_id: profile.building_id, user_id: profile.id, content }]);
      playSystemSound('notification');
      setCustomAlert({ title: 'פורסם בהצלחה', message: 'הדוח הועבר לצ\'אט הבניין.', type: 'success' });
    }
  };

  const shareReportToWhatsApp = () => {
    setIsShareMenuOpen(false);
    setTranslateY(0);
    playSystemSound('click');
    const text = encodeURIComponent(`📊 *סטטוס קופת ועד הבית* 📊\n\n✅ *נאסף בקופה:* ₪${totalCollected.toLocaleString()}\n⏳ *נותר לגבות:* ₪${totalPendingVal.toLocaleString()}\n\nנודה מאוד לכל מי שטרם הסדיר את התשלומים להיכנס לאפליקציית *שכן+* ולסגור את היתרות הפתוחות. תודה רבה על שיתוף הפעולה! 🏢✨`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const closeAllModals = useCallback(() => {
    setIsCreating(false);
    setPayingItem(null);
    setIsShareMenuOpen(false);
    setEditingPaymentData(null);
    setActiveActionMenu(null);
    setOpenMenuId(null);
    setTranslateY(0);
    setIdNumber('');
  }, []);

  useEffect(() => {
    if (isCreating || payingItem || isShareMenuOpen || editingPaymentData || activeActionMenu || openMenuId) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isCreating, payingItem, isShareMenuOpen, editingPaymentData, activeActionMenu, openMenuId]);

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const diff = e.targetTouches[0].clientY - touchStart;
    if (diff > 0) setTranslateY(diff);
  };
  const onTouchEnd = () => {
    if (translateY > 150) closeAllModals();
    setTranslateY(0);
    setTouchStart(null);
  };

  const toggleExpand = (tab: string) => setExpandedTabs(prev => ({ ...prev, [tab]: !prev[tab] }));
  const showToast = (id: string) => { setToastId(id); setTimeout(() => setToastId(null), 4000); };

  const renderList = (list: PaymentRecord[], type: 'pending' | 'approval' | 'history') => {
    if (list.length === 0) return <div className="text-center py-10 bg-white/60 backdrop-blur-xl rounded-[2rem] border border-[#1D4ED8]/10 shadow-sm animate-in fade-in text-slate-400 font-bold text-sm">אין תשלומים בקטגוריה זו</div>;

    const sortedList = [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const isExpanded = expandedTabs[type] || false;
    const displayList = isExpanded ? sortedList : sortedList.slice(0, 5);

    return (
      <div className="space-y-4">
        {displayList.map(p => {
          const isPayerMe = p.payer_id === profile?.id;
          const isOverdue = type === 'pending' && (new Date().getTime() - new Date(p.created_at).getTime() > 30 * 24 * 60 * 60 * 1000);
          const amountColorClass = type === 'history' ? 'text-emerald-600' : 'text-[#1D4ED8]';

          return (
            <div key={p.id} className={`bg-white/90 backdrop-blur-xl rounded-[2rem] p-5 relative transition-all duration-300 ${p.is_pinned ? 'border-2 border-[#1D4ED8] shadow-[0_0_15px_rgba(29,78,216,0.4)]' : 'border border-[#1D4ED8]/10 shadow-[0_8px_30px_rgba(29,78,216,0.04)]'} ${openMenuId === p.id ? 'z-50' : 'z-10'}`}>
              
              <div className="absolute top-0 right-0 flex overflow-hidden rounded-bl-[1.5rem] rounded-tr-[2rem] shadow-sm z-10 border-b border-l border-white/20">
                <div className={`px-4 py-1.5 text-white text-[10px] font-black ${p.status === 'paid' || p.status === 'exempt' ? 'bg-[#10B981]' : p.status === 'pending_approval' ? 'bg-orange-500' : 'bg-[#1D4ED8]'}`}>
                  {p.status === 'paid' ? 'שולם' : p.status === 'exempt' ? 'פטור' : p.status === 'pending_approval' ? 'ממתין' : 'פתוח'}
                </div>
                {type === 'pending' && isOverdue && (
                  <div className="px-3 py-1.5 bg-rose-50 text-rose-600 text-[10px] font-black border-r border-rose-100/50 animate-pulse">באיחור</div>
                )}
              </div>

              {(isAdmin || (isPayerMe && type === 'history')) && (
                <div className="absolute top-3 left-3 z-20">
                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id); }} className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-[#1D4ED8] transition-colors active:scale-95">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                  </button>

                  {openMenuId === p.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }}></div>
                      <div className="absolute left-0 top-10 w-[170px] bg-white/95 backdrop-blur-xl border border-slate-100 shadow-[0_15px_50px_rgba(0,0,0,0.15)] rounded-2xl z-[150] py-1.5 animate-in zoom-in-95">
                        {isAdmin && type === 'pending' && (
                          <>
                            <button onClick={() => { setEditingPaymentData({ id: p.id, title: p.title, amount: p.amount.toString() }); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50">
                              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>עריכה
                            </button>
                            <button onClick={() => { handlePersonalReminder(p); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50">
                              <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              שיתוף לוואטסאפ
                            </button>
                            <button onClick={() => { togglePinPayment(p); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50">
                              <svg className="w-4 h-4 text-[#1D4ED8]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>{p.is_pinned ? 'ביטול נעיצה' : 'נעץ הודעה'}
                            </button>
                            <button onClick={() => { markAsExempt(p.id); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100/50">
                              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>פטור מתשלום
                            </button>
                            <button onClick={() => { deletePayment(p.id); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3">
                              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>מחיקת דרישה
                            </button>
                          </>
                        )}
                        {isAdmin && type === 'approval' && (
                          <>
                            <button onClick={() => { handleApprovePayment(p.id, p.payer_id, p.title); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-emerald-600 hover:bg-emerald-50 flex items-center gap-3 border-b border-slate-100/50">
                              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>אישור קבלה
                            </button>
                            <button onClick={() => { deletePayment(p.id); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3">
                              <svg className="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>דחייה ומחיקה
                            </button>
                          </>
                        )}
                        {type === 'history' && (
                          <button onClick={() => { downloadReceipt(p); setOpenMenuId(null); }} className="w-full text-right px-4 h-11 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M9 21h6a2 2 0 002-2V7.414A2 2 0 0016.414 6L14 3.586A2 2 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>הורדת מסמך
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div
                onTouchStart={() => handlePressStart(p)} onTouchEnd={handlePressEnd} onTouchMove={handlePressEnd}
                onClick={() => { if (isPayerMe && type === 'pending') startPaymentFlow(p); else showToast(p.id); }}
                className="select-none [-webkit-touch-callout:none]"
              >
                <div className="pt-7 pr-1 pl-10">
                  <h3 className="text-[17px] font-black text-slate-800 leading-tight mb-2.5 flex items-center gap-1.5">
                    {p.is_pinned && <svg className="w-4 h-4 text-[#1D4ED8] shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>}
                    {p.title}
                  </h3>
                  <div className="flex items-center gap-2.5 mb-3">
                    <img src={p.profiles?.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${p.profiles?.full_name}`} className="w-8 h-8 rounded-full border border-slate-200 object-cover" alt="avatar" />
                    <div className="flex flex-col">
                      <span className="text-[14px] font-black text-slate-700 leading-none flex items-center gap-1">
                        {p.profiles?.full_name || 'דייר'}
                        {p.profiles?.role === 'admin' && <span className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-1.5 py-0.5 rounded-md font-black text-[9px] mr-1">ועד</span>}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1">דירה {p.profiles?.apartment || '-'} • {formatShortDate(p.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-[#1D4ED8]/5 p-3.5 rounded-2xl border border-[#1D4ED8]/10 mt-2 shadow-sm flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-[#1D4ED8] mb-0.5">סכום לתשלום</span>
                    <div className={`text-lg font-black flex items-center justify-start gap-1 font-sans ${amountColorClass}`} dir="ltr">
                      <span className="text-[11px] font-bold opacity-70">₪</span>
                      <span className="tracking-tight">{p.amount.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  {isPayerMe && type === 'pending' && (
                    <div className="flex gap-2 relative z-10">
                      <button onClick={(e) => { e.stopPropagation(); startPaymentFlow(p); }} className="h-9 px-6 bg-[#1D4ED8] text-white rounded-xl font-bold text-xs shadow-xs active:scale-95 transition">תשלום</button>
                    </div>
                  )}
                  
                  {isPayerMe && type === 'history' && (
                    <button onClick={(e) => { e.stopPropagation(); downloadReceipt(p); }} className="h-9 px-4 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-xl relative z-10">
                      קבלה
                    </button>
                  )}
                </div>
              </div>

            </div>
          );
        })}
        {list.length > 5 && (
          <button onClick={() => toggleExpand(type)} className="w-full flex items-center justify-center gap-1 text-[#1D4ED8] py-3.5 bg-white/40 rounded-2xl shadow-sm border border-[#1D4ED8]/10 hover:bg-white/80 transition mt-2">
            <span className="text-[11px] font-black">{isExpanded ? 'הצג פחות' : 'הצג עוד'}</span>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        )}
      </div>
    );
  };

  const alertsPortal = mounted && customAlert ? createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" onClick={() => setCustomAlert(null)} dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm animate-[bounce_1s_infinite] ${customAlert.type === 'success' ? 'bg-emerald-50 text-emerald-600' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-[#1D4ED8]'}`}>
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customAlert.message}</p>
        <button onClick={() => setCustomAlert(null)} className="w-full h-14 bg-[#1E293B] hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition shadow-md text-lg">
          סגירה
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  const confirmsPortal = mounted && customConfirm ? createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4" dir="rtl">
      <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center border border-white/50 animate-in zoom-in-95">
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center bg-amber-50 text-amber-500 shadow-sm">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
        </div>
        <h3 className="text-2xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
        <p className="text-base text-slate-500 mb-6 leading-relaxed font-medium">{customConfirm.message}</p>
        <div className="flex gap-3">
          <button onClick={() => setCustomConfirm(null)} className="flex-1 h-14 bg-gray-100 text-slate-600 font-bold rounded-xl hover:bg-gray-200 transition text-lg flex items-center justify-center">ביטול</button>
          <button onClick={customConfirm.onConfirm} className="flex-1 h-14 bg-[#1D4ED8] text-white font-bold rounded-xl transition shadow-sm active:scale-95 text-lg flex items-center justify-center">אישור</button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen relative px-6 pt-6" dir="rtl" onClick={() => { setActiveActionMenu(null); setOpenMenuId(null); }}>
      {alertsPortal}
      {confirmsPortal}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-black text-slate-800">תשלומים</h2>
      </div>

      <div className="bg-[#1D4ED8] p-6 pt-8 rounded-[2rem] text-white shadow-xl relative overflow-hidden mb-6 border border-white/10">
        {isAdmin && (
          <button onClick={(e) => { e.stopPropagation(); setIsShareMenuOpen(true); }} className="absolute top-4 left-4 z-20 w-11 h-11 flex items-center justify-center bg-[#0a192f]/40 hover:bg-[#0a192f]/60 backdrop-blur-md rounded-full border border-white/20 active:scale-95 transition shadow-sm" title="אפשרויות דוח קופה">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          </button>
        )}
        <div className="relative z-10 flex flex-col items-end w-full">
          <p className="text-[11px] text-white/80 font-bold mb-1 w-full text-right">{isAdmin ? 'קופת ועד הבית' : 'סך הכל שילמתי'}</p>
          <div className="flex items-baseline justify-end gap-1.5 w-full" dir="ltr">
            <span className="text-2xl font-bold text-white">₪</span>
            <span className="text-4xl font-black tracking-tight text-white">{totalCollected.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex justify-between items-end border-t border-white/10 pt-4 relative z-10 w-full mt-1">
          <div className="flex flex-col w-1/2">
            <p className="text-[10px] text-white/70 font-bold mb-0.5 w-full text-right">יעד לגבייה</p>
            <div className="flex items-baseline justify-end gap-1 w-full" dir="ltr">
              <span className="text-xs font-bold text-white/90">₪</span>
              <span className="text-sm font-bold text-white">{totalTarget.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex flex-col w-1/2">
            <p className="text-[10px] text-white/70 font-bold mb-0.5 w-full text-left">פתוח לתשלום</p>
            <div className="flex items-baseline justify-start gap-1 w-full" dir="ltr">
              <span className="text-xs font-bold text-[#F5A623]">₪</span>
              <span className="text-sm font-black text-[#F5A623]">{totalPendingVal.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-full border border-[#1D4ED8]/10 shadow-sm relative z-10 mb-5">
        {(isAdmin ? ['pending', 'approval', 'history'] : ['pending', 'history']).map(tabKey => {
          const label = tabKey === 'pending' ? 'פתוחים' : tabKey === 'approval' ? 'ממתינים' : 'שולם';
          const count = tabKey === 'pending' ? pendingItems.length : tabKey === 'approval' ? approvalItems.length : paidItems.length;
          const isActive = activeTab === tabKey;
          return (
            <button key={tabKey} onClick={() => setActiveTab(tabKey as any)} className={`flex-1 h-10 rounded-full text-[13px] transition-all flex items-center justify-center font-bold gap-1 shrink-0 ${isActive ? 'text-[#1D4ED8] bg-blue-50 border border-blue-100 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <span>{label}</span><span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="w-full relative z-10 space-y-4">
        {activeTab === 'pending' && renderList(pendingItems, 'pending')}
        {activeTab === 'approval' && renderList(approvalItems, 'approval')}
        {activeTab === 'history' && renderList(paidItems, 'history')}
      </div>

      {isAdmin && (
        <button onClick={(e) => { e.stopPropagation(); setIsCreating(true); }} className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-[#1D4ED8]/20 text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 group flex-row-reverse active:scale-95 transition">
          <div className="bg-[#1D4ED8] text-white w-10 h-10 flex items-center justify-center rounded-full font-black text-base">＋</div>
          <span className="font-black text-xs text-[#1D4ED8]">דרישת תשלום</span>
        </button>
      )}

      {/* --- Unified Swipeable Bottom Sheets (Forms & Actions) --- */}
      {(isCreating || !!payingItem || isShareMenuOpen || !!editingPaymentData) && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-end justify-center touch-none overscroll-none"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={(e) => { if(e.target === e.currentTarget) closeAllModals(); }}
        >
          <div style={{ transform: `translateY(${translateY}px)` }} className="bg-white w-full rounded-t-[2.5rem] p-6 pb-12 shadow-2xl transition-transform duration-75 ease-out relative border-t border-white/20" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 cursor-grab active:cursor-grabbing"></div>
            
            {/* Create Payment */}
            {isCreating && (
              <>
                <h3 className="font-black text-2xl text-slate-800 mb-6">דרישת תשלום חדשה</h3>
                <div className="flex gap-1.5 mb-6 overflow-x-auto hide-scrollbar pb-1.5">
                  {['ועד בית', 'גינון ותחזוקה', 'תיקון מעלית', 'ניקיון ופוליש', 'ביטוח מבנה', 'איטום וזיפות'].map(tag => (
                    <button key={tag} type="button" onClick={() => setNewTitle(tag)} className="bg-[#1D4ED8]/5 hover:bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/15 px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition active:scale-95 shadow-sm">
                      {tag}
                    </button>
                  ))}
                </div>
                <form onSubmit={handleCreatePayment} className="space-y-4">
                  <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="עבור מה? (או בחר מתגית מעל)" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner" />
                  <input type="number" required value={newAmount} onChange={e => setNewAmount(e.target.value)} placeholder="סכום פר דייר (₪)" dir="ltr" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner" />
                  <button type="submit" disabled={isSubmitting} className="w-full h-14 mt-2 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">
                    {isSubmitting ? 'שולח...' : 'שלח לכל הבניין'}
                  </button>
                </form>
              </>
            )}

            {/* Edit Payment */}
            {editingPaymentData && (
              <>
                <h3 className="font-black text-2xl text-slate-800 mb-6">עריכת תשלום</h3>
                <form onSubmit={handleInlineEditSubmit} className="space-y-4">
                  <input type="text" required value={editingPaymentData.title} onChange={e => setEditingPaymentData({ ...editingPaymentData, title: e.target.value })} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-bold outline-none focus:border-[#1D4ED8] shadow-inner" />
                  <input type="number" required value={editingPaymentData.amount} onChange={e => setEditingPaymentData({ ...editingPaymentData, amount: e.target.value })} dir="ltr" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner" />
                  <button type="submit" disabled={isSubmitting} className="w-full h-14 mt-2 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">
                    {isSubmitting ? 'שומר...' : 'שמור שינויים'}
                  </button>
                </form>
              </>
            )}

            {/* Pay Modal with Advanced Options */}
            {payingItem && (
              <>
                <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">איך תרצה לשלם?</h3>
                
                {paymentFlowStep === 'select' && (
                  <div className="space-y-3">
                    <button onClick={() => selectPaymentMethod('credit')} className="w-full h-14 flex items-center justify-center bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg gap-2">
                      תשלום באשראי
                    </button>
                    <button onClick={() => selectPaymentMethod('bit')} className="w-full h-14 flex items-center justify-center bg-[#00B0FF] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg gap-2">
                      העברה בביט
                    </button>
                    <button onClick={() => selectPaymentMethod('bank')} className="w-full h-14 flex items-center justify-center bg-[#1E293B] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg gap-2">
                      העברה בנקאית
                    </button>
                  </div>
                )}

                {/* Credit Card Flow */}
                {paymentFlowStep === 'credit_flow' && (
                  <form onSubmit={processCreditCard} className="space-y-4 text-center">
                    <div className="text-emerald-600 text-xs font-black mb-2 flex items-center justify-center gap-1"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>אזור מאובטח בתקן בנקאי</div>
                    <div className="bg-[#1D4ED8]/5 p-4 rounded-2xl border border-[#1D4ED8]/10 mb-4 text-center">
                      <p className="text-sm font-bold text-[#1D4ED8] mb-1">{payingItem.title}</p>
                      <p className="text-3xl font-black text-slate-800 font-sans" dir="ltr">₪{payingItem.amount.toLocaleString()}</p>
                    </div>
                    <input required type="tel" placeholder="תעודת זהות (ת״ז)" value={idNumber} onChange={e => setIdNumber(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner" dir="ltr" />
                    <input required type="tel" placeholder="מספר כרטיס אשראי" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner" dir="ltr" />
                    <div className="flex gap-3">
                      <input required type="text" placeholder="תוקף (MM/YY)" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-center outline-none focus:border-[#1D4ED8] shadow-inner" dir="ltr" />
                      <input required type="tel" placeholder="CVV" className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-center outline-none focus:border-[#1D4ED8] shadow-inner" dir="ltr" />
                    </div>
                    <button type="submit" className="w-full h-14 mt-2 bg-[#1D4ED8] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg flex items-center justify-center gap-2">
                      שלם עכשיו
                    </button>
                  </form>
                )}

                {/* Bit Flow */}
                {paymentFlowStep === 'bit_flow' && (
                  <form onSubmit={(e) => confirmManualPayment(e, 'ביט')} className="text-center space-y-5">
                    <p className="text-sm text-slate-500 font-bold px-4 leading-relaxed">אנא אשרו כאן לאחר ביצוע ההעברה בביט:</p>
                    <button type="submit" className="w-full h-14 mt-2 bg-[#00B0FF] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">
                      אישור, ביצעתי העברה בביט
                    </button>
                  </form>
                )}

                {/* Bank Transfer Flow */}
                {paymentFlowStep === 'bank_flow' && (
                  <form onSubmit={(e) => confirmManualPayment(e, 'העברה בנקאית')} className="text-center space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-2 text-emerald-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"></path></svg>
                      <span className="text-[11px] font-black uppercase tracking-wider">אזור מאובטח בנקאית</span>
                    </div>
                    <p className="text-sm text-slate-500 font-bold px-2 leading-relaxed">נא לבצע העברה בנקאית לפי הפרטים הבאים ולהזין תעודת זהות לאימות:</p>
                    <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 text-right space-y-3 shadow-inner">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-bold">בנק</span><span className="font-black text-slate-800">הפועלים (12)</span></div>
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-bold">סניף</span><span className="font-black text-slate-800">123</span></div>
                      <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-slate-500 text-sm font-bold">חשבון</span><span className="font-black text-slate-800">123456</span></div>
                      <div className="flex justify-between items-center"><span className="text-slate-500 text-sm font-bold">מוטב</span><span className="font-black text-slate-800">ועד הבית</span></div>
                    </div>
                    <input required type="tel" placeholder="תעודת זהות (ת״ז) בעל החשבון" value={idNumber} onChange={e => setIdNumber(e.target.value)} className="w-full h-14 bg-[#F8FAFC] border border-slate-200 rounded-2xl px-4 text-sm font-black text-right outline-none focus:border-[#1D4ED8] shadow-inner mt-4" dir="ltr" />
                    <button type="submit" className="w-full h-14 mt-2 bg-[#1E293B] text-white font-black rounded-2xl shadow-lg active:scale-[0.98] transition-all text-lg">
                      אישור, ביצעתי העברה
                    </button>
                  </form>
                )}

                {/* Processing Steps */}
                {paymentFlowStep === 'processing' && (
                  <div className="text-center py-10 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#1D4ED8]/20 border-t-[#1D4ED8] rounded-full animate-spin"></div>
                    <div className="font-black text-xl text-[#1D4ED8] animate-pulse">מתחבר ומעבד תשלום...</div>
                  </div>
                )}
                
              </>
            )}

            {/* Share Menu */}
            {isShareMenuOpen && (
              <>
                <h3 className="font-black text-2xl text-slate-800 mb-6 text-center">אפשרויות דוח קופה</h3>
                <div className="space-y-3">
                  <button onClick={generateAdminReport} className="w-full h-14 text-right px-5 bg-[#F8FAFC] hover:bg-slate-100 text-slate-700 rounded-2xl font-bold text-sm border border-slate-200 shadow-sm transition flex items-center justify-between">
                    <span>הפקת דוח גבייה (PDF)</span>
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3M9 21h6a2 2 0 002-2V7.414A2 2 0 0016.414 6L14 3.586A2 2 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                  </button>
                  <button onClick={shareToAppChat} className="w-full h-14 text-right px-5 bg-[#1D4ED8]/5 hover:bg-[#1D4ED8]/10 text-[#1D4ED8] rounded-2xl font-bold text-sm border border-[#1D4ED8]/10 shadow-sm transition flex items-center justify-between">
                    <span>שידור סטטוס לצ'אט הבניין</span>
                    <svg className="w-5 h-5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  </button>
                  <button onClick={shareReportToWhatsApp} className="w-full h-14 text-right px-5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#25D366] rounded-2xl font-bold text-sm border border-[#25D366]/20 shadow-sm transition flex items-center justify-between">
                    <span>שיתוף סיכום לוואטסאפ</span>
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.305-.883-.653-1.48-1.459-1.653-1.758-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.413z"/></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* AI Bubble */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && !isAiLoading && <div className="absolute bottom-[60px] right-0 mb-2 bg-white/95 backdrop-blur-md text-slate-800 p-4 rounded-2xl shadow-lg text-xs font-bold w-max max-w-[240px] leading-snug border border-[#1D4ED8]/20 text-right pointer-events-auto break-words">{aiInsight}</div>}
        <button onClick={() => setShowAiBubble(!showAiBubble)} className={`w-12 h-12 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : ''}`}>
          {isAiLoading ? <div className="w-12 h-12 bg-[#1D4ED8]/10 backdrop-blur-sm rounded-full flex items-center justify-center border border-[#1D4ED8]/30"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin" /></div> : <img src={aiAvatarUrl} alt="AI" className="w-12 h-12 object-contain drop-shadow-md rounded-full" />}
        </button>
      </div>

    </div>
  );
}
