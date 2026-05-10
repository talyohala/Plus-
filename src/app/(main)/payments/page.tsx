'use client'
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  const [paymentFlowStep, setPaymentFlowStep] = useState<'select' | 'new_card' | 'processing' | 'success'>('select');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [newCardDetails, setNewCardDetails] = useState({ number: '', expiry: '', cvv: '', saveCard: true });

  const [customAlert, setCustomAlert] = useState<{ title: string; message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [activeActionMenu, setActiveActionMenu] = useState<PaymentRecord | null>(null);
  const [editingPaymentData, setEditingPaymentData] = useState<{ id: string; title: string; amount: string } | null>(null);
  const [toastId, setToastId] = useState<string | null>(null);

  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const lastAnalyzedRef = useRef<string>('');
  const router = useRouter();

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
    const channel = supabase.channel('payments_v27')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const pendingItems = useMemo(() => payments.filter(p => p.status === 'pending'), [payments]);
  const approvalItems = useMemo(() => payments.filter(p => p.status === 'pending_approval'), [payments]);
  const paidItems = useMemo(() => payments.filter(p => p.status === 'paid'), [payments]);
  const exempts = useMemo(() => payments.filter(p => p.status === 'exempt'), [payments]);

  const totalCollected = useMemo(() => paidItems.reduce((sum, p) => sum + p.amount, 0), [paidItems]);
  const totalPendingVal = useMemo(() => [...pendingItems, ...approvalItems].reduce((sum, p) => sum + p.amount, 0), [pendingItems, approvalItems]);
  const totalTarget = useMemo(() => totalCollected + totalPendingVal + exempts.reduce((sum, p) => sum + p.amount, 0), [totalCollected, totalPendingVal, exempts]);

  // מנוע AI חכם עם תצוגה מורחבת
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
        if (data && data.text) {
          setAiInsight(data.text);
        } else {
          throw new Error('Empty text');
        }
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

      playSystemSound('notification'); setIsCreating(false); setNewTitle(''); setNewAmount('');
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
    setEditingPaymentData(null); playSystemSound('notification');
    fetchData();
    setIsSubmitting(false);
  };

  const executeAction = (action: () => void) => { setActiveActionMenu(null); action(); };

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

  // פונקציית תזכורת חכמה המשלבת התראת פוש פנימית ווואטסאפ (אם קיים)
  const handlePersonalReminder = async (payment: PaymentRecord) => {
    if (!profile) return;
    
    // 1. שליחת התראה מסודרת באפליקציה בכל מקרה
    await supabase.from('notifications').insert([{
      receiver_id: payment.payer_id,
      sender_id: profile.id,
      type: 'payment',
      title: 'תזכורת תשלום מוועד הבית ⏳',
      content: `אנא הסדר/י את התשלום עבור "${payment.title}" בסך ₪${payment.amount.toLocaleString()}. תודה רבה!`,
      link: '/payments'
    }]);

    // 2. בדיקה האם ניתן לפתוח בנוסף גם שיחת וואטסאפ
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
    fetchData();
  };

  const handleNotifyBitPayment = async (paymentId: string, paymentTitle: string) => {
    if (!profile) return;
    const { error } = await supabase.from('payments').update({ status: 'pending_approval' }).eq('id', paymentId);

    if (!error) {
      const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).eq('role', 'admin').neq('id', profile.id);
      if (admins && admins.length > 0) {
        const notifs = admins.map(admin => ({
          receiver_id: admin.id,
          sender_id: profile.id,
          type: 'system',
          title: 'דיווח תשלום ממתין לאישור',
          content: `${profile.full_name} דיווח/ה ששילם בביט/מזומן על "${paymentTitle}". הכנס לאשר.`,
          link: '/payments'
        }));
        await supabase.from('notifications').insert(notifs);
      }
    }

    playSystemSound('click'); setCustomAlert({ title: 'הודעה נשלחה', message: 'דיווחת ששילמת. הוועד יעודכן ויאשר.', type: 'info' });
    fetchData();
  };

  const startPaymentFlow = (payment: PaymentRecord) => { setPayingItem(payment); setPaymentFlowStep('select'); setActiveActionMenu(null); };

  const processPayment = async (method: string) => {
    if (!payingItem || !profile) return;
    if (method === 'bit') {
      await handleNotifyBitPayment(payingItem.id, payingItem.title); setPayingItem(null); return;
    }
    setPaymentFlowStep('processing');
    setTimeout(async () => {
      const { error } = await supabase.from('payments').update({ status: 'paid' }).eq('id', payingItem.id);

      if (!error) {
        const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).eq('role', 'admin').neq('id', profile.id);
        if (admins && admins.length > 0) {
          const notifs = admins.map(admin => ({
            receiver_id: admin.id, sender_id: profile.id, type: 'system',
            title: 'תשלום חדש באשראי התקבל! 💎',
            content: `${profile.full_name} שילם/ה הרגע באמצעות האשראי עבור: ${payingItem.title}.`,
            link: '/payments'
          }));
          await supabase.from('notifications').insert(notifs);
        }

        if (method === 'new_card' && newCardDetails.saveCard) {
          const last4 = newCardDetails.number.slice(-4) || '1234';
          const newCard = { id: Date.now().toString(), type: 'visa', last4, exp: newCardDetails.expiry };
          const updatedCards = [...savedCards, newCard];
          await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id);
          setSavedCards(updatedCards);
        }
      }
      setPaymentFlowStep('success'); playSystemSound('notification');
      fetchData();
    }, 2000);
  };

  const deleteSavedCard = async (cardId: string) => {
    if (!profile) return;
    setCustomConfirm({
      title: 'הסרת כרטיס', message: 'למחוק את כרטיס האשראי מהמערכת?',
      onConfirm: async () => {
        const updatedCards = savedCards.filter(c => c.id !== cardId);
        await supabase.from('profiles').update({ saved_payment_methods: updatedCards }).eq('id', profile.id);
        setSavedCards(updatedCards);
        setCustomConfirm(null);
      }
    });
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
        .edge-container { width: 100%; min-height: 100vh; display: flex; flex-direction: column; padding: 1.5rem; box-sizing: border-box; }
        .barcode { font-family: 'Libre Barcode 39', cursive; font-size: 40px; letter-spacing: 2px; }
      </style>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+39&display=swap" rel="stylesheet">
    </head>
    <body>
      <div class="edge-container">
        ${htmlContent}
        <div class="mt-auto pt-6 text-center no-print">
          <button onclick="window.print()" class="bg-[#1D4ED8] text-white px-6 py-4 rounded-2xl font-black w-full mb-3 text-lg active:scale-95 transition-transform shadow-lg">שמור PDF / הדפס</button>
          <button onclick="window.close()" class="text-black bg-gray-100 font-bold px-6 py-4 rounded-2xl w-full text-lg active:scale-95 transition-transform border border-gray-200">סגור מסמך</button>
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
      <div class="flex justify-between items-start border-b-2 border-gray-100 pb-6 mb-6 mt-2">
        <div>
          <h1 class="text-4xl font-black text-[#1D4ED8] tracking-tight">שכן<span class="text-black">+</span></h1>
          <p class="text-gray-500 font-bold text-sm mt-1">מערכת ניהול חכמה</p>
        </div>
        <div class="text-left">
          <h2 class="text-2xl font-black text-black">קבלה / אישור תשלום</h2>
          <p class="text-sm font-bold text-gray-500 mt-1">מסמך ממוחשב</p>
        </div>
      </div>

      <div class="mb-6 flex justify-between">
        <div>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">פרטי מנפיק (הוועד)</p>
          <p class="text-lg font-black text-black mt-1">ועד בית: ${building?.name || ''}</p>
          <p class="text-xs font-bold text-gray-500">מלכ״ר - פטור ממע״מ</p>
        </div>
        <div class="text-left">
          <p class="text-xs font-bold text-gray-400 uppercase tracking-wide">תאריך אסמכתא</p>
          <p class="text-sm font-bold text-black mt-1">${fullDate}</p>
          <p class="text-xs font-mono text-gray-500 mt-1">Ref: ${refNumber}</p>
        </div>
      </div>

      <div class="mb-6">
        <p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">פרטי משלם</p>
        <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
          <span class="font-black text-lg">${payment.profiles?.full_name || profile?.full_name || ''}</span>
          <span class="bg-white border border-gray-200 px-3 py-1 rounded-lg text-xs font-bold">דירה ${payment.profiles?.apartment || '?'}</span>
        </div>
      </div>

      <table class="w-full text-right border-collapse mb-8">
        <thead>
          <tr class="text-gray-400 text-xs border-b-2 border-gray-200 uppercase tracking-wide">
            <th class="py-3 pr-2 font-bold">תיאור תשלום</th>
            <th class="py-3 text-center font-bold">כמות</th>
            <th class="py-3 pl-2 text-left font-bold">סה״כ</th>
          </tr>
        </thead>
        <tbody>
          <tr class="border-b border-gray-100 text-base">
            <td class="py-4 pr-2 font-black text-black">${payment.title}</td>
            <td class="py-4 text-center font-bold">1</td>
            <td class="py-4 pl-2 font-black text-left text-black">₪${payment.amount}</td>
          </tr>
        </tbody>
      </table>

      <div class="flex justify-between items-end p-6 bg-[#1D4ED8]/5 rounded-[2rem] border border-[#1D4ED8]/20 mb-8">
        <div>
          <p class="text-xs font-bold text-[#1D4ED8] uppercase tracking-wide">סך הכל ששולם</p>
          <p class="text-[10px] font-bold text-gray-500 mt-1">פטור ממע״מ כחוק</p>
        </div>
        <div class="text-left">
          <span class="font-black text-[#1D4ED8] text-5xl tracking-tight">₪${payment.amount}</span>
        </div>
      </div>

      <div class="mt-8 text-center flex flex-col items-center">
        <div class="barcode text-gray-800">${refNumber}</div>
        <p class="text-xs font-bold text-gray-400 mt-2">התשלום נרשם ואומת במערכת שכן+ בהצלחה.</p>
      </div>
    `;
    generatePDF(`קבלה_${payment.title}`, receiptHtml);
  };

  const generateAdminReport = () => {
    setIsShareMenuOpen(false);
    playSystemSound('notification');
    const fullDate = formatDetailedDate();
    let tableRows = payments.map(p => {
      let statusHtml = p.status === 'paid' ? '<span class="text-[#1D4ED8] font-bold">שולם</span>' : p.status === 'exempt' ? '<span class="text-gray-400">פטור</span>' : '<span class="text-black font-bold">ממתין</span>';
      return `<tr class="border-b border-gray-100 text-sm"><td class="py-4 pr-2 text-black font-bold">${p.profiles?.full_name || ''}</td><td class="py-4 text-gray-600">${p.title}</td><td class="py-4 font-black text-left text-black">₪${p.amount}</td><td class="py-4 pl-2 text-left">${statusHtml}</td></tr>`;
    }).join('');

    const reportHtml = `
      <div class="flex justify-between items-start border-b-2 border-gray-100 pb-6 mb-8 mt-2">
        <div>
          <h1 class="text-4xl font-black text-[#1D4ED8] tracking-tight">שכן<span class="text-black">+</span></h1>
          <p class="text-gray-500 font-bold text-sm mt-1">מערכת ניהול חכמה</p>
        </div>
        <div class="text-left">
          <h2 class="text-2xl font-black text-black">דוח קופה מקיף</h2>
          <p class="text-sm font-bold text-gray-500 mt-1">ועד בית: ${building?.name || ''}</p>
        </div>
      </div>

      <p class="text-sm font-bold text-gray-400 mb-4 text-left">${fullDate}</p>

      <div class="flex justify-between gap-4 mb-8 text-center">
        <div class="flex-1 bg-[#1D4ED8]/5 p-5 rounded-3xl border border-[#1D4ED8]/10 shadow-sm">
          <p class="text-xs text-[#1D4ED8] font-bold uppercase mb-2 tracking-wide">נאסף בקופה</p>
          <p class="text-3xl font-black text-[#1D4ED8]">₪${totalCollected.toLocaleString()}</p>
        </div>
        <div class="flex-1 bg-gray-50 p-5 rounded-3xl border border-gray-200 shadow-sm">
          <p class="text-xs text-gray-600 font-bold uppercase mb-2 tracking-wide">נותר לגבות</p>
          <p class="text-3xl font-black text-black">₪${totalPendingVal.toLocaleString()}</p>
        </div>
      </div>

      <h3 class="text-lg font-black text-black mb-3 border-b-2 border-gray-800 inline-block pb-1">פירוט תנועות</h3>
      <table class="w-full text-right border-collapse mb-6">
        <thead>
          <tr class="text-gray-400 text-xs border-b-2 border-gray-200 uppercase tracking-wide">
            <th class="py-3 pr-2 font-bold">שם הדייר</th><th class="py-3 font-bold">תיאור</th><th class="py-3 text-left font-bold">סכום</th><th class="py-3 pl-2 text-left font-bold">סטטוס</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
    generatePDF(`דוח_גבייה`, reportHtml);
  };

  const shareToAppChat = async () => {
    if (!profile) return;
    setIsShareMenuOpen(false);
    const content = `📊 **סטטוס קופת הבניין** 📊\n✅ נאסף: ₪${totalCollected.toLocaleString()}\n⏳ פתוחים: ₪${totalPendingVal.toLocaleString()}\n\nתודה רבה לכל מי שהסדיר את התשלומים. אנא היכנסו ללשונית "תשלומים" להסדרת יתרות. 🙏`;
    await supabase.from('messages').insert([{ user_id: profile.id, content }]);
    setCustomAlert({ title: 'פורסם בהצלחה', message: 'הדוח נשלח לקבוצת הצ\'אט של הבניין.', type: 'success' });
  };

  if (!profile) return null;

  const toggleExpand = (tab: string) => setExpandedTabs(prev => ({ ...prev, [tab]: !prev[tab] }));
  
  const showToast = (id: string) => { setToastId(id); setTimeout(() => setToastId(null), 4000); };

  const formatAmount = (amount: number) => (
    <div className="flex items-baseline gap-1" dir="ltr">
      <span className="text-[10px] text-slate-400 font-bold mb-0.5">₪</span>
      <span>{amount.toLocaleString()}</span>
    </div>
  );

  const renderList = (list: PaymentRecord[], type: 'pending' | 'approval' | 'history') => {
    if (list.length === 0) return <div className="text-center py-10 text-slate-400 font-bold text-sm bg-white/40 rounded-2xl border border-white/50 shadow-sm">אין תשלומים בקטגוריה זו</div>;

    const sortedList = [...list].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const isExpanded = expandedTabs[type] || false;
    const displayList = isExpanded ? sortedList : sortedList.slice(0, 5);

    return (
      <div className="space-y-3">
        {displayList.map(p => {
          const isPayerMe = p.payer_id === profile.id;
          const isOverdue = type === 'pending' && (new Date().getTime() - new Date(p.created_at).getTime() > 30 * 24 * 60 * 60 * 1000);

          return (
            <div key={p.id} className="relative group">
              {toastId === p.id && (
                <div className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-full shadow-sm animate-in slide-in-from-bottom-2 pointer-events-none whitespace-nowrap z-50">
                  לחיצה ארוכה לאפשרויות
                </div>
              )}
              <div
                onTouchStart={() => handlePressStart(p)} onTouchEnd={handlePressEnd} onTouchMove={handlePressEnd}
                onClick={() => { if (isPayerMe && type === 'pending') startPaymentFlow(p); else showToast(p.id); }}
                className={`bg-white/70 backdrop-blur-xl border p-4 rounded-3xl flex items-center justify-between transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none] overflow-hidden ${p.is_pinned ? 'border-[#1D4ED8]/60 shadow-[0_0_25px_rgba(29,78,216,0.15)] bg-[#1D4ED8]/5' : 'border-white/80 shadow-sm'}`}
              >
                {p.is_pinned && (
                  <div className="absolute top-0 right-4 bg-[#1D4ED8] text-white text-[9px] font-black px-2.5 py-0.5 rounded-b-lg shadow-sm z-10 flex items-center gap-1">
                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                  </div>
                )}

                <div className="flex-1 pr-1">
                  <h4 className={`font-black text-[15px] ${p.is_pinned ? 'mt-2 text-[#1D4ED8]' : 'text-slate-800'}`}>{p.title}</h4>
                  <div className="text-[9px] font-bold text-slate-400 mt-0.5 mb-1.5 flex items-center gap-1.5">
                    {formatShortDate(p.created_at)}
                    {isOverdue && <span className="bg-red-50 text-red-500 px-1.5 py-0.5 rounded-md font-black border border-red-100">באיחור</span>}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                    {p.profiles?.avatar_url && <img src={p.profiles.avatar_url} alt="avatar" className="w-4 h-4 rounded-full object-cover" />}
                    <span className="truncate">{p.profiles?.full_name || 'דייר'}</span>
                    {p.profiles?.role === 'admin' && <span className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-1.5 py-0.5 rounded-md font-black text-[9px]">ועד</span>}
                    <span>דירה {p.profiles?.apartment || '?'}</span>
                  </div>
                </div>
                <div className="text-left shrink-0 flex flex-col items-end gap-2.5">
                  <div className={`text-lg font-black flex items-center justify-end ${type === 'history' ? 'text-[#059669]' : 'text-[#1D4ED8]'}`}>{formatAmount(p.amount)}</div>

                  {isPayerMe && type === 'pending' && <button onClick={(e) => { e.stopPropagation(); startPaymentFlow(p); }} className="bg-[#1D4ED8] text-white text-[11px] font-black px-5 py-2.5 rounded-xl shadow-md active:scale-95 transition">שלם</button>}
                  {isPayerMe && type === 'history' && (
                    <button onClick={(e) => { e.stopPropagation(); downloadReceipt(p); }} className="text-[10px] font-bold text-[#1D4ED8] hover:text-[#0044cc] transition flex items-center gap-1 bg-[#1D4ED8]/10 px-3.5 py-2 rounded-xl">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg> קבלה
                    </button>
                  )}
                  {isAdmin && !isPayerMe && type === 'approval' && <button onClick={(e) => { e.stopPropagation(); handleApprovePayment(p.id, p.payer_id, p.title); }} className="bg-[#059669] text-white text-[11px] font-black px-4 py-2.5 rounded-xl shadow-md active:scale-95 transition">אשר</button>}
                </div>
              </div>
            </div>
          );
        })}
        {list.length > 5 && (
          <button onClick={() => toggleExpand(type)} className="w-full flex items-center justify-center gap-1 text-[#1D4ED8] py-3.5 bg-white/40 rounded-2xl shadow-sm border border-white/50 hover:bg-white/80 transition mt-2">
            <span className="text-[11px] font-black">{isExpanded ? 'הצג פחות' : 'הצג עוד'}</span>
            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen relative" dir="rtl">
      <div className="px-6 pt-6 pb-2 flex justify-between items-center sticky top-0 z-30">
        <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">תשלומים</h2>
      </div>

      <div className="px-6 space-y-5 mt-4">
        <div className="bg-gradient-to-br from-[#0e1e2d] to-[#1D4ED8] p-6 pt-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>

          {isAdmin && (
            <button
              onClick={() => setIsShareMenuOpen(true)}
              className="absolute top-4 left-4 z-20 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/20 active:scale-90 transition shadow-sm"
              title="הפקת דוחות"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </button>
          )}

          <div className="relative z-10 text-right">
            <p className="text-[11px] text-white/70 font-bold mb-1">{isAdmin ? 'קופת ועד הבית' : 'סך הכל שילמתי'}</p>
            <div className="text-4xl font-black font-mono tracking-tight mb-8 flex items-baseline justify-start gap-1" dir="rtl">
              <span>{totalCollected.toLocaleString()}</span>
              <span className="text-xl text-white/80 self-baseline">₪</span>
            </div>
          </div>

          <div className="flex justify-between items-end border-t border-white/10 pt-5 relative z-10">
            <div>
              <p className="text-[10px] text-white/60 font-bold mb-0.5">יעד לגבייה</p>
              <div className="text-sm font-bold text-white flex items-center gap-1" dir="ltr"><span className="text-[10px] text-white/60">₪</span>{totalTarget.toLocaleString()}</div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/60 font-bold mb-0.5">פתוח לתשלום</p>
              <div className="text-sm font-bold text-amber-300 flex items-center justify-end gap-1" dir="ltr"><span className="text-[10px] text-amber-300/70">₪</span>{totalPendingVal.toLocaleString()}</div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm">
            <button onClick={() => setActiveTab('pending')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${activeTab === 'pending' ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'}`}>
              פתוחים
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'pending' ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500'}`}>{pendingItems.length}</span>
            </button>
            {isAdmin && (
              <button onClick={() => setActiveTab('approval')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${activeTab === 'approval' ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'}`}>
                ממתינים
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'approval' ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500'}`}>{approvalItems.length}</span>
              </button>
            )}
            <button onClick={() => setActiveTab('history')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${activeTab === 'history' ? 'text-[#1D4ED8] font-black bg-[#1D4ED8]/10 shadow-sm border border-[#1D4ED8]/20' : 'text-slate-500 font-bold hover:text-[#1D4ED8]/70'}`}>
              שולם
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'history' ? 'bg-[#1D4ED8] text-white' : 'bg-gray-100 text-gray-500'}`}>{paidItems.length}</span>
            </button>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {activeTab === 'pending' && renderList(pendingItems, 'pending')}
            {activeTab === 'approval' && renderList(approvalItems, 'approval')}
            {activeTab === 'history' && renderList(paidItems, 'history')}
          </div>
        </div>
      </div>

      {/* --- כפתור יצירת דרישת תשלום (FAB פלוס זהה לכל שאר האפליקציה) --- */}
      {isAdmin && (
        <button
          onClick={() => { playSystemSound('click'); setIsCreating(true); }}
          className="fixed bottom-24 left-6 z-40 bg-white/90 backdrop-blur-md border border-white text-slate-800 pl-4 pr-1.5 py-1.5 rounded-full shadow-[0_10px_40px_rgba(29,78,216,0.25)] hover:scale-105 active:scale-95 transition flex items-center gap-3 group flex-row-reverse"
          title="דרישת תשלום חדשה"
        >
          <div className="bg-[#1D4ED8] text-white p-3 rounded-full shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
            </svg>
          </div>
          <span className="font-black text-sm text-[#1D4ED8]">דרישת תשלום</span>
        </button>
      )}

      {/* --- AI Floating Character & Bubble (Bottom Right) --- */}
      <div className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}>
        {showAiBubble && !isAiLoading && (
          <div className="absolute bottom-[80px] right-0 mb-3 bg-white/95 backdrop-blur-xl text-slate-800 p-4 rounded-[2rem] rounded-br-md shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-[12px] font-bold w-[260px] leading-relaxed border border-[#1D4ED8]/20 animate-in fade-in slide-in-from-bottom-2 duration-500 whitespace-pre-wrap text-right pointer-events-auto">
            {aiInsight}
          </div>
        )}
        <button
          onClick={() => {
            if (showAiBubble) setShowAiBubble(false);
            else if (!isAiLoading) setShowAiBubble(true);
          }}
          className={`w-20 h-20 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}
        >
          {isAiLoading ? (
            <div className="w-10 h-10 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white">
              <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <img src={aiAvatarUrl} alt="AI Avatar" className="w-16 h-16 object-contain drop-shadow-2xl" />
          )}
        </button>
      </div>

      {/* --- מודל דרישת תשלום משופר --- */}
      {isCreating && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">דרישת תשלום חדשה</h3>
              <button onClick={() => setIsCreating(false)} className="w-12 h-12 flex items-center justify-center bg-gray-100 rounded-full text-slate-600 hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex gap-2 mb-4 overflow-x-auto hide-scrollbar pb-2">
              <button onClick={() => setNewTitle('ועד בית')} className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border border-[#1D4ED8]/20 active:scale-95 transition">ועד בית</button>
              <button onClick={() => setNewTitle('גינון ותחזוקה')} className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border border-[#1D4ED8]/20 active:scale-95 transition">גינון ותחזוקה</button>
              <button onClick={() => setNewTitle('תיקון מעלית')} className="bg-[#1D4ED8]/10 text-[#1D4ED8] px-3 py-1.5 rounded-full text-[11px] font-bold shrink-0 border border-[#1D4ED8]/20 active:scale-95 transition">תיקון מעלית</button>
            </div>

            <form onSubmit={handleCreatePayment} className="space-y-4">
              <div>
                <input type="text" required value={newTitle} onChange={e => setNewTitle(e.target.value)} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-4 text-sm font-bold outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800" placeholder="עבור מה? (לדוג': ועד חודש מאי)" />
              </div>
              <div>
                <input type="number" required value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-4 text-sm outline-none focus:border-[#1D4ED8] transition shadow-sm text-slate-800 font-black text-lg" placeholder="סכום פר דייר (₪)" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-4 active:scale-95 transition disabled:opacity-50 text-base">
                {isSubmitting ? 'משדר לכולם...' : 'שלח לכל הבניין'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- Bottom Sheet: תפריט פעולות --- */}
      {activeActionMenu && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex justify-center items-end" onClick={() => setActiveActionMenu(null)}>
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>

            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="font-black text-xl text-slate-800">{activeActionMenu.title}</h3>
                <div className="text-xs text-slate-500 font-bold mt-1 flex items-baseline gap-1" dir="ltr">
                  <span>{activeActionMenu.profiles?.full_name || profile?.full_name}</span> <span className="mx-1">•</span> <span className="text-[10px]">₪</span><span>{activeActionMenu.amount.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-5 mt-2">
              {isAdmin && activeActionMenu.status === 'pending' && (
                <>
                  <button onClick={() => { setEditingPaymentData({ id: activeActionMenu.id, title: activeActionMenu.title, amount: activeActionMenu.amount.toString() }); setActiveActionMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-blue-50 text-[#1D4ED8] flex items-center justify-center shadow-sm border border-blue-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">עריכה</span>
                  </button>
                  <button onClick={() => executeAction(() => handlePersonalReminder(activeActionMenu))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shadow-sm border border-[#25D366]/20">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.94 5.83L3 22l4.25-.93A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.42 14.08c-.24.68-1.37 1.3-1.9 1.4-.53.1-.98.17-1.48-.03-2.96-1.2-4.86-4.3-5.01-4.5-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .58.01.18 0 .44-.07.68.5.26.6.83 2.03.9 2.18.08.15.13.32.03.52-.1.2-.16.33-.31.51-.15.18-.33.42-.46.56-.16.16-.33.34-.14.63.19.3.8 1.32 1.72 2.14 1.19 1.06 2.19 1.39 2.5 1.54.3.15.48.13.65-.07.18-.22.81-.94 1.03-1.27.22-.33.43-.28.71-.18.28.1 1.8.85 2.11 1.01.31.16.52.23.6.36.08.13.08.78-.16 1.46z"/>
                      </svg>
                    </div>
                    <span className="text-[10px] font-black text-slate-600">תזכורת אישית</span>
                  </button>
                  <button onClick={() => executeAction(() => togglePinPayment(activeActionMenu))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-sm border ${activeActionMenu.is_pinned ? 'bg-[#1D4ED8] text-white border-[#1D4ED8]' : 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20'}`}>
                      <svg className="w-6 h-6" fill={activeActionMenu.is_pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                    </div>
                    <span className="text-[10px] font-black text-slate-600">{activeActionMenu.is_pinned ? 'בטל נעיצה' : 'נעיצה לפיד'}</span>
                  </button>
                  <button onClick={() => executeAction(() => markAsExempt(activeActionMenu.id))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center shadow-sm border border-gray-200"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">פטור</span>
                  </button>
                  <button onClick={() => executeAction(() => deletePayment(activeActionMenu.id))} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-sm border border-red-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></div>
                    <span className="text-[10px] font-black text-slate-600">מחיקה</span>
                  </button>
                </>
              )}

              {isAdmin && activeActionMenu.status === 'pending_approval' && (
                <button onClick={() => executeAction(() => handleApprovePayment(activeActionMenu.id, activeActionMenu.payer_id, activeActionMenu.title))} className="flex flex-col items-center gap-2 col-span-4 group active:scale-95 transition">
                  <div className="w-16 h-16 rounded-full bg-[#059669]/10 text-[#059669] flex items-center justify-center shadow-sm border border-[#059669]/20"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg></div>
                  <span className="text-xs font-black text-[#059669]">אשר תשלום</span>
                </button>
              )}

              {!isAdmin && activeActionMenu.status === 'pending' && (
                <>
                  <button onClick={() => executeAction(() => startPaymentFlow(activeActionMenu))} className="flex flex-col items-center gap-2 col-span-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center shadow-sm border border-[#1D4ED8]/20"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg></div>
                    <span className="text-[10px] font-black text-[#1D4ED8]">תשלום אשראי</span>
                  </button>
                  <button onClick={() => executeAction(() => processPayment('bit'))} className="flex flex-col items-center gap-2 col-span-2 group active:scale-95 transition">
                    <div className="w-14 h-14 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center shadow-sm border border-[#25D366]/20"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg></div>
                    <span className="text-[10px] font-black text-[#25D366]">ביט / מזומן</span>
                  </button>
                </>
              )}

              {activeActionMenu.status === 'paid' && (
                <button onClick={() => executeAction(() => downloadReceipt(activeActionMenu))} className="flex flex-col items-center gap-2 col-span-4 group active:scale-95 transition">
                  <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shadow-sm border border-slate-200"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></div>
                  <span className="text-xs font-black text-slate-700">הורדת קבלה</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- חלון עריכה מהירה --- */}
      {editingPaymentData && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex justify-center items-center p-4">
          <form onSubmit={handleInlineEditSubmit} className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
            <h3 className="text-xl font-black text-slate-800 mb-4">עריכת תשלום</h3>
            <input type="text" required value={editingPaymentData.title} onChange={e => setEditingPaymentData({ ...editingPaymentData, title: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-3 text-sm outline-none focus:border-[#1D4ED8]" />
            <input type="number" required value={editingPaymentData.amount} onChange={e => setEditingPaymentData({ ...editingPaymentData, amount: e.target.value })} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 mb-5 text-sm outline-none focus:border-[#1D4ED8] font-black" />
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditingPaymentData(null)} className="flex-1 bg-gray-100 text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-200 transition">ביטול</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl transition shadow-sm">שמור</button>
            </div>
          </form>
        </div>
      )}

      {/* --- תפריט דוחות ומנהל משופר ועמיד לחלוטין --- */}
      {isShareMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex justify-center items-end" onClick={() => setIsShareMenuOpen(false)}>
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">דוחות ופעולות</h3>
              <button onClick={() => setIsShareMenuOpen(false)} className="w-12 h-12 flex items-center justify-center bg-gray-50 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition shadow-sm border border-gray-100">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={generateAdminReport}
                className="w-full flex items-center justify-between bg-white border border-[#1D4ED8]/10 p-4 rounded-xl hover:border-[#1D4ED8]/30 transition active:scale-95 shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center group-hover:bg-[#1D4ED8] group-hover:text-white transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-slate-800">הפקת דוח גבייה (PDF)</h4>
                    <p className="text-[10px] font-bold text-slate-500">מסמך מרוכז להדפסה עם כלל הנתונים.</p>
                  </div>
                </div>
              </button>

              <button
                onClick={shareToAppChat}
                className="w-full flex items-center justify-between bg-white border border-[#1D4ED8]/10 p-4 rounded-xl hover:border-[#1D4ED8]/30 transition active:scale-95 shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-slate-200 transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-slate-800">פרסום בקבוצת האפליקציה</h4>
                    <p className="text-[10px] font-bold text-slate-500">תמונת מצב קופה שקופצת לכל הדיירים.</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setIsShareMenuOpen(false);
                  const pendingItems = payments.filter(p => p.status === 'pending');
                  const phones = [...new Set(pendingItems.map(p => p.profiles?.phone).filter(Boolean))];
                  if (phones.length === 0) return setCustomAlert({ title: 'אין למי לשלוח', message: 'לא נמצאו מספרי פלאפון לדיירים עם דרישה פתוחה.', type: 'info' });
                  const text = encodeURIComponent(`היי שכנים, תזכורת עדינה ממנהל ועד הבית 🏢\nאנא היכנסו לאפליקציית שכן+ להסדיר תשלומים פתוחים כדי שנוכל להמשיך לטפח את הבניין בצורה מיטבית. תודה רבה! 🙏`);
                  window.open(`https://wa.me/?text=${text}`, '_blank');
                }}
                className="w-full flex items-center justify-between bg-white border border-[#1D4ED8]/10 p-4 rounded-xl hover:border-[#25D366]/30 transition active:scale-95 shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#25D366] flex items-center justify-center group-hover:bg-[#25D366] group-hover:text-white transition">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.7 4.19 1.94 5.83L3 22l4.25-.93A9.96 9.96 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm5.42 14.08c-.24.68-1.37 1.3-1.9 1.4-.53.1-.98.17-1.48-.03-2.96-1.2-4.86-4.3-5.01-4.5-.15-.2-1.2-1.6-1.2-3.05 0-1.45.76-2.16 1.03-2.48.27-.3.6-.37.8-.37.2 0 .4 0 .58.01.18 0 .44-.07.68.5.26.6.83 2.03.9 2.18.08.15.13.32.03.52-.1.2-.16.33-.31.51-.15.18-.33.42-.46.56-.16.16-.33.34-.14.63.19.3.8 1.32 1.72 2.14 1.19 1.06 2.19 1.39 2.5 1.54.3.15.48.13.65-.07.18-.22.81-.94 1.03-1.27.22-.33.43-.28.71-.18.28.1 1.8.85 2.11 1.01.31.16.52.23.6.36.08.13.08.78-.16 1.46z"/>
                    </svg>
                  </div>
                  <div className="text-right">
                    <h4 className="font-bold text-sm text-slate-800">תזכורת גלובלית לכולם</h4>
                    <p className="text-[10px] font-bold text-slate-500">שליחת הודעת וואטסאפ למי שטרם שילם.</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- זרימת תשלום צ'קאאוט מאובטחת --- */}
      {payingItem && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 min-h-[50vh] border-t border-white/50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-xl text-slate-800">הסדרת תשלום</h3>
              <button onClick={() => { setPayingItem(null); setPaymentFlowStep('select'); }} className="w-12 h-12 flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl text-slate-800 hover:bg-gray-100 transition active:scale-95 shadow-sm">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 mb-6 flex justify-between items-center border border-gray-100 shadow-sm">
              <div>
                <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">עבור:</p>
                <p className="text-sm font-black text-slate-800">{payingItem.title}</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold mb-0.5 uppercase tracking-wider">לתשלום:</p>
                <div className="text-2xl font-black text-[#1D4ED8] flex items-end justify-end gap-1" dir="ltr"><span className="text-[12px] text-slate-400 mb-0.5">₪</span>{payingItem.amount.toLocaleString()}</div>
              </div>
            </div>

            {paymentFlowStep === 'select' && (
              <div className="flex flex-col gap-3">
                <p className="text-[10px] font-black text-slate-400 tracking-wider uppercase mb-1">אמצעי תשלום</p>

                {savedCards.length > 0 && savedCards.map(card => (
                  <div key={card.id} className="w-full flex items-center justify-between bg-white border border-[#1D4ED8]/10 p-4 rounded-xl shadow-sm hover:border-[#1D4ED8]/50 transition">
                    <button onClick={() => processPayment('saved_card')} className="flex items-center gap-3 flex-1 text-right">
                      <div className="w-10 h-6 bg-slate-800 rounded shrink-0 flex items-center justify-center relative overflow-hidden shadow-sm">
                        <div className="absolute top-0 right-0 w-8 h-8 bg-white/10 rounded-full -mr-4 -mt-4"></div>
                        <span className="text-[8px] font-black text-white tracking-widest italic">VISA</span>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-800 font-mono tracking-widest">**** {card.last4}</p>
                      </div>
                    </button>
                    <button onClick={() => deleteSavedCard(card.id)} className="w-12 h-12 flex items-center justify-center text-gray-300 hover:text-red-500 transition hover:bg-red-50 rounded-lg">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                  </div>
                ))}

                <button onClick={() => setPaymentFlowStep('new_card')} className="w-full flex items-center justify-center gap-2 bg-white text-[#1D4ED8] border border-[#1D4ED8]/30 py-4 rounded-xl font-bold hover:bg-[#1D4ED8]/5 active:scale-95 transition shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                  הוסף כרטיס אשראי חדש
                </button>

                <div className="relative flex items-center justify-center mt-4 mb-2">
                  <div className="border-t border-gray-200 w-full absolute"></div>
                  <span className="bg-white/95 backdrop-blur-xl px-3 text-[10px] font-bold text-slate-400 relative z-10 uppercase tracking-widest">או</span>
                </div>

                <button onClick={() => processPayment('bit')} className="w-full flex items-center justify-between px-5 bg-white border border-[#1D4ED8]/10 py-4 rounded-xl font-bold hover:bg-gray-50 active:scale-95 transition shadow-sm">
                  <div className="flex items-center gap-3 text-slate-800">
                    <div className="w-8 h-8 rounded-full bg-[#1D4ED8]/10 flex items-center justify-center text-[#1D4ED8]">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    דיווח תשלום בביט/מזומן
                  </div>
                </button>
              </div>
            )}

            {paymentFlowStep === 'new_card' && (
              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-4">
                <button onClick={() => setPaymentFlowStep('select')} className="text-[10px] font-bold text-[#1D4ED8] flex items-center gap-1 mb-2 w-max px-2 py-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg> חזור לאמצעי תשלום
                </button>

                <div>
                  <input type="text" placeholder="מספר כרטיס (0000 0000 0000 0000)" maxLength={19} className="w-full bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono tracking-widest text-left shadow-sm" dir="ltr" onChange={e => setNewCardDetails({ ...newCardDetails, number: e.target.value })} />
                </div>

                <div className="flex gap-3">
                  <input type="text" placeholder="תוקף (MM/YY)" maxLength={5} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center shadow-sm" dir="ltr" onChange={e => setNewCardDetails({ ...newCardDetails, expiry: e.target.value })} />
                  <input type="password" placeholder="CVV" maxLength={3} className="flex-1 bg-white border border-[#1D4ED8]/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition font-mono text-center tracking-widest shadow-sm" dir="ltr" onChange={e => setNewCardDetails({ ...newCardDetails, cvv: e.target.value })} />
                </div>

                <label className="flex items-center gap-3 p-4 rounded-xl border border-[#1D4ED8]/20 bg-[#1D4ED8]/5 cursor-pointer mt-2 shadow-sm">
                  <input type="checkbox" checked={newCardDetails.saveCard} onChange={e => setNewCardDetails({ ...newCardDetails, saveCard: e.target.checked })} className="w-5 h-5 text-[#1D4ED8] rounded border-gray-300" />
                  <span className="text-sm font-bold text-slate-800">שמור כרטיס לתשלומים הבאים בבניין</span>
                </label>

                <button onClick={() => processPayment('new_card')} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-4 active:scale-95 transition text-lg">
                  בצע תשלום
                </button>
              </div>
            )}

            {paymentFlowStep === 'processing' && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <div className="w-16 h-16 border-4 border-[#1D4ED8]/20 border-t-[#1D4ED8] rounded-full animate-spin"></div>
                <p className="font-bold text-[#1D4ED8] text-lg animate-pulse">מעבד תשלום מאובטח...</p>
              </div>
            )}

            {paymentFlowStep === 'success' && (
              <div className="flex flex-col items-center justify-center py-8 gap-4 animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-[#059669]/10 text-[#059669] rounded-full flex items-center justify-center mb-2 shadow-lg animate-[bounce_1s_infinite]">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h3 className="text-3xl font-black text-slate-800">התשלום בוצע!</h3>
                <p className="text-base text-slate-500 text-center font-medium">העברת ₪{payingItem.amount.toLocaleString()} נרשמה בהצלחה בקופה.</p>

                <button onClick={() => { setPayingItem(null); setPaymentFlowStep('select'); }} className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-xl shadow-[0_8px_20px_rgba(29,78,216,0.3)] mt-6 active:scale-95 transition text-lg">
                  סיום
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- התראות מערכת וחלוניות אישור --- */}
      {customAlert && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
              {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
              {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
              {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customAlert.message}</p>
            <button onClick={() => setCustomAlert(null)} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition shadow-sm text-lg">סגירה</button>
          </div>
        </div>
      )}

      {customConfirm && (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 text-orange-500 shadow-sm">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77-1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setCustomConfirm(null)} className="flex-1 w-12 h-12 flex items-center justify-center bg-white text-slate-600 font-bold rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm">ביטול</button>
              <button onClick={customConfirm.onConfirm} className="flex-1 w-12 h-12 flex items-center justify-center bg-[#1D4ED8] text-white font-bold rounded-xl transition shadow-sm active:scale-95">אישור</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
