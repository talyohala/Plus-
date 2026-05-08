'use client'
import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function ServicesPage() {
    const [profile, setProfile] = useState<any>(null)
    const [tickets, setTickets] = useState<any[]>([])
    const [vendors, setVendors] = useState<any[]>([])
    const [activeFilter, setActiveFilter] = useState('הכל')
    const [isReporting, setIsReporting] = useState(false)
    const [showVendors, setShowVendors] = useState(false)
    const [vendorTab, setVendorTab] = useState('קבועים')
    const [vendorSearch, setVendorSearch] = useState('')
    const [description, setDescription] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null)
    const [isAddingVendor, setIsAddingVendor] = useState(false)
    const [newVendor, setNewVendor] = useState({ name: '', profession: '', phone: '' })
    const [newRating, setNewRating] = useState(5)
    const [isFixedVendor, setIsFixedVendor] = useState(false)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [activeTicketMenu, setActiveTicketMenu] = useState<any>(null)
    const [editingTicket, setEditingTicket] = useState<any>(null)
    const [editDescription, setEditDescription] = useState('')
    const [activeVendorMenu, setActiveVendorMenu] = useState<any>(null)
    const [editingVendor, setEditingVendor] = useState<any>(null)
    const [editVendorData, setEditVendorData] = useState({ name: '', profession: '', phone: '' })
    const [toastId, setToastId] = useState<string | null>(null)

    // --- AI States ---
    const [aiInsight, setAiInsight] = useState<string>('')
    const [isAiLoading, setIsAiLoading] = useState(true)
    const [showAiBubble, setShowAiBubble] = useState(false)

    const pressTimer = useRef<any>(null)
    const vendorPressTimer = useRef<any>(null)
    const menuOpenTime = useRef<number>(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const isAdmin = profile?.role === 'admin'

    const aiAvatarUrl = useMemo(() => {
        const fallbackRobot = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
        return profile?.avatar_url || fallbackRobot;
    }, [profile?.avatar_url]);

    const showToast = (id: string) => {
        setToastId(id)
        setTimeout(() => setToastId(null), 2000)
    }

    const handleCloseTicketMenu = () => {
        if (Date.now() - menuOpenTime.current > 300) setActiveTicketMenu(null);
    }

    const handleCloseVendorMenu = () => {
        if (Date.now() - menuOpenTime.current > 300) setActiveVendorMenu(null);
    }

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: prof } = await supabase.from('profiles').select('*, avatar_url').eq('id', user.id).single()
        if (!prof || !prof.building_id) return
        setProfile(prof)

        let query = supabase.from('service_tickets')
            .select('*, profiles(full_name, apartment, avatar_url)')
            .eq('building_id', prof.building_id)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })

        const { data: tks } = await query
        if (tks) setTickets(tks)

        const { data: vnds } = await supabase.from('building_vendors')
            .select('*, profiles!building_vendors_recommender_id_fkey(full_name)')
            .eq('building_id', prof.building_id)
            .order('created_at', { ascending: false })
        if (vnds) setVendors(vnds)
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        const fetchAiData = async () => {
            if (!profile || !profile.building_id || tickets.length === 0) return;

            if (!isAiLoading && showAiBubble) return;

            setIsAiLoading(true);
            try {
                const openFaults = tickets.filter(f => f.status === 'פתוח' || f.status === 'בטיפול');
                const closedFaults = tickets.filter(f => f.status === 'טופל');

                let chatSummary = '';
                try {
                    const { data: msgs } = await supabase.from('messages').select('content').eq('building_id', profile.building_id).order('created_at', { ascending: false }).limit(3);
                    if (msgs && msgs.length > 0) chatSummary = `בצ'אט מדברים על: ${msgs.map(m => m.content.substring(0, 20)).join(', ')}`;
                } catch(e) {}

                let context = '';
                if (profile.role === 'admin') {
                    context = `
                        מנהל הוועד: ${profile.full_name}. יש בבניין ${openFaults.length} תקלות פתוחות ו-${closedFaults.length} טופלו.
                        התקלות הפתוחות: ${openFaults.slice(0, 2).map(f => f.title).join(', ')}.
                        ${chatSummary}
                        נסח הודעת עזר מגוף ראשון כרובוט ניהול ואחזקה שעוזר לו (${profile.full_name}). תן עדכון קצר למנהל, כתוב בדיוק 3 שורות עם ירידת שורה ביניהן (\n). הוסף אימוג'י בכל שורה.
                    `;
                } else {
                    const myFaults = openFaults.filter(f => f.user_id === profile.id);
                    context = `
                        דייר: ${profile.full_name}. בבניין יש ${openFaults.length} תקלות בטיפול. הדייר דיווח בעצמו על ${myFaults.length} מהן.
                        נסח הודעת עזר אישית מגוף ראשון כעוזר התחזוקה החמוד שלו. היה מדויק, פנה אליו בשמו, ציין שהוועד מטפל. כתוב בדיוק 3 שורות קצרות עם ירידת שורה ביניהן (\n). הוסף אימוג'י חמוד בכל שורה.
                    `;
                }

                const res = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: context, mode: 'insight' })
                });

                const data = await res.json();
                const fallbackText = profile.role === 'admin'
                    ? `היי ${profile.full_name}, מערכת התקלות פעילה 🛠️\n${openFaults.length} פניות ממתינות לטיפולך 📋\nאני כאן לעזור תמיד ✨`
                    : `היי ${profile.full_name}! 🚀\nתקלות הבניין מנוהלות כרגע 🔧\nנמשיך לעדכן אותך בכל התפתחות ✨`;

                setAiInsight(data.text || fallbackText);
                setShowAiBubble(true);
                setTimeout(() => setShowAiBubble(false), 10000);
            } catch (error) {
                setAiInsight(`שלום ${profile.full_name}, המערכת מסונכרנת 🛠️\nצוות הניהול עוקב אחר הדיווחים 📋\nהמשך יום נעים! ✨`);
                setShowAiBubble(true);
                setTimeout(() => setShowAiBubble(false), 10000);
            } finally {
                setIsAiLoading(false);
            }
        };

        if (tickets.length > 0 && !showAiBubble && isAiLoading) fetchAiData();
    }, [profile, tickets.length, showAiBubble, isAiLoading]);

    const handleAddVendor = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.building_id || !newVendor.name || !newVendor.phone) return
        const finalIsFixed = profile.role === 'admin' ? isFixedVendor : false
        await supabase.from('building_vendors').insert([{ building_id: profile.building_id, recommender_id: profile.id, is_fixed: finalIsFixed, rating: finalIsFixed ? 5 : newRating, ...newVendor }])
        setNewVendor({ name: '', profession: '', phone: '' })
        setNewRating(5)
        setIsAddingVendor(false)
        playSystemSound('notification')
        fetchData()
    }

    const handleSaveVendorEdit = async () => {
        if (!editingVendor || !editVendorData.name.trim() || !editVendorData.phone.trim()) return;
        await supabase.from('building_vendors').update({
            name: editVendorData.name,
            profession: editVendorData.profession,
            phone: editVendorData.phone
        }).eq('id', editingVendor.id);
        playSystemSound('notification');
        setEditingVendor(null);
        fetchData();
    }

    const handleDeleteVendor = async (id: string) => {
        await supabase.from('building_vendors').delete().eq('id', id)
        playSystemSound('click')
        fetchData()
    }

    const handleSubmitReport = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!profile?.building_id || (!description.trim() && !imageFile)) return
        setIsSubmitting(true)
        let imageUrl = null

        if (imageFile) {
            const fileExt = imageFile.name.split('.').pop()
            const fileName = `${Date.now()}.${fileExt}`
            const { data, error } = await supabase.storage.from('tickets').upload(fileName, imageFile)
            if (!error && data) imageUrl = supabase.storage.from('tickets').getPublicUrl(fileName).data.publicUrl
        }

        let finalTitle = 'תקלה בבניין';
        let aiTags: string[] = [];

        try {
            const aiRes = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description })
            });
            const aiData = await aiRes.json();
            if (aiData.title) finalTitle = aiData.title;
            if (aiData.tags) aiTags = aiData.tags;
        } catch (e) {
            finalTitle = description.trim().split(' ').slice(0, 4).join(' ') + '...';
        }

        const { error } = await supabase.from('service_tickets').insert([{ building_id: profile.building_id, user_id: profile.id, title: finalTitle, description: description, image_url: imageUrl, ai_tags: aiTags, source: 'app' }])
        
        if (!error) {
            // --- שלח התראה למנהלי הוועד בבניין ---
            const { data: admins } = await supabase.from('profiles').select('id').eq('building_id', profile.building_id).eq('role', 'admin')
            if (admins && admins.length > 0) {
                const notifs = admins.map(admin => ({
                    receiver_id: admin.id,
                    sender_id: profile.id,
                    type: 'system',
                    title: 'תקלה חדשה דווחה 🛠️',
                    content: `${profile.full_name} פתח קריאה: ${finalTitle}`,
                    link: '/services'
                }))
                await supabase.from('notifications').insert(notifs)
            }
        }

        playSystemSound('notification')
        setIsReporting(false)
        setDescription('')
        setImageFile(null)
        setImagePreview(null)
        setActiveFilter('הכל')
        fetchData()
        setIsSubmitting(false)
    }

    const handleSaveEdit = async () => {
        if (!editingTicket || !editDescription.trim()) return;
        await supabase.from('service_tickets').update({ description: editDescription }).eq('id', editingTicket.id);
        playSystemSound('notification');
        setEditingTicket(null);
        fetchData();
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setImageFile(file)
            setImagePreview(URL.createObjectURL(file))
        }
    }

    const updateTicketStatus = async (id: string, newStatus: string, userId: string, ticketTitle: string) => {
        const updates: any = { status: newStatus };
        if (newStatus === 'טופל') updates.is_pinned = false;
        
        const { error } = await supabase.from('service_tickets').update(updates).eq('id', id)
        
        if (!error && userId !== profile.id) {
            // --- שלח התראה אישית לדייר שהתקלה שלו זזה ---
            const msgTitle = newStatus === 'בטיפול' ? 'התקלה שלך בטיפול! 🛠️' : 'התקלה שלך טופלה! ✅';
            const msgContent = newStatus === 'בטיפול' ? `הוועד החל לטפל בפנייה: ${ticketTitle}` : `הוועד סגר את הפנייה: ${ticketTitle}`;
            
            await supabase.from('notifications').insert([{
                receiver_id: userId,
                sender_id: profile.id,
                type: 'system',
                title: msgTitle,
                content: msgContent,
                link: '/services'
            }])
        }

        playSystemSound('click')
        fetchData()
    }

    const togglePin = async (id: string, currentPinStatus: boolean) => {
        await supabase.from('service_tickets').update({ is_pinned: !currentPinStatus }).eq('id', id)
        playSystemSound('click')
        fetchData()
    }

    const deleteTicket = async (id: string) => {
        await supabase.from('service_tickets').delete().eq('id', id)
        playSystemSound('click')
        fetchData()
    }

    const formatWhatsAppLink = (phone: string, text: string = '') => {
        const cleanPhone = phone.replace(/\D/g, '')
        const baseUrl = cleanPhone.startsWith('0') ? `https://wa.me/972${cleanPhone.substring(1)}` : `https://wa.me/${cleanPhone}`
        return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
    }

    const timeFormat = (dateString: string) => {
        const date = new Date(dateString)
        return `${date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })} • ${date.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`
    }

    const handlePressStart = (ticket: any) => {
        pressTimer.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
            menuOpenTime.current = Date.now()
            setActiveTicketMenu(ticket)
        }, 500)
    }

    const handlePressEnd = () => { if (pressTimer.current) clearTimeout(pressTimer.current) }

    const handleVendorPressStart = (vendor: any) => {
        vendorPressTimer.current = setTimeout(() => {
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
            menuOpenTime.current = Date.now()
            setActiveVendorMenu(vendor)
        }, 500)
    }

    const handleVendorPressEnd = () => { if (vendorPressTimer.current) clearTimeout(vendorPressTimer.current) }

    const shouldShowDescription = (title: string, desc: string) => {
        if (!desc || desc === title || desc.length < 40) return false;
        return true;
    }

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
    }

    const findMatchingVendor = (tags: string[], fixedArr: any[], recommendedArr: any[]) => {
        if (!tags || !tags.length) return null;
        const dictionary: Record<string, string[]> = {
            'חשמלאי': ['חשמל', 'תאורה', 'מנורה', 'קצר', 'פקק קפץ', 'שקע', 'תקע', 'לוח חשמל', 'פנדל', 'פלורסנט', 'לד', 'חוטים', 'שעון שבת', 'טיימר', 'גוף תאורה'],
            'אינסטלטור': ['מים', 'אינסטלציה', 'פיצוץ', 'נזילה', 'ביוב', 'צינור', 'סתימה', 'סתום', 'ניאגרה', 'ברז', 'טפטוף', 'חלודה', 'דוד', 'פומפה', 'צנרת', 'דוד שמש', 'מרזב'],
            'מנקה': ['ניקיון', 'אשפה', 'פח', 'שטיפה', 'לכלוך', 'מסריח', 'ספונג\'ה', 'פוליש', 'חדר מדרגות', 'לובי', 'זבל', 'ריח', 'כתם', 'שואב'],
            'טכנאי מעליות': ['מעלית', 'מעליות', 'תקועה', 'כפתור', 'דלת לא נסגרת', 'שבת', 'פיר', 'חילוץ'],
            'גנן': ['גינון', 'גינה', 'עצים', 'דשא', 'עשבים', 'השקיה', 'ממטרות', 'גזום', 'שתילים', 'יבש', 'צמחיה', 'טפטפות', 'גיזום'],
            'מנעולן': ['מנעול', 'דלת', 'מפתח', 'קודן', 'פריצה', 'צילינדר', 'תקוע', 'ציר', 'טריקה', 'מחזיר דלת'],
            'מדביר': ['הדברה', 'ג\'וקים', 'מקקים', 'נמלים', 'חולדות', 'עכברים', 'יתושים', 'ריסוס', 'חרקים', 'פשפשים', 'תיקנים', 'חולדה', 'עכבר'],
            'אינטרקום': ['אינטרקום', 'מצלמה', 'זמזם', 'לא שומעים', 'מסך', 'תקשורת', 'מערכת', 'צ\'יפ'],
            'שיפוצניק': ['שיפוץ', 'צבע', 'טיח', 'קיר', 'סדק', 'שבר', 'חור', 'פאנלים', 'בלטות', 'קרמיקה', 'רובה', 'התקנה', 'תיקון', 'הנדימן', 'שבור'],
            'מסגר': ['מעקה', 'סורג', 'סורגים', 'שער', 'ברזל', 'ריתוך', 'רתך', 'מסגרות', 'חניה'],
            'איטום': ['גג', 'זפת', 'איטום', 'רטיבות', 'יריעות', 'נזילה מהגג', 'טפטוף מהתקרה'],
            'כיבוי אש': ['מטף', 'גלאי עשן', 'ארון כיבוי', 'ספרינקלר', 'ספרינקלרים', 'אש', 'שריפה', 'זרנוק'],
            'משאבות': ['משאבה', 'משאבת מים', 'משאבה טבולה', 'משאבות ביוב', 'הצפה']
        };

        const expandedTags = new Set<string>();
        tags.forEach(tag => {
            const t = tag.toLowerCase();
            expandedTags.add(t);
            for (const [category, words] of Object.entries(dictionary)) {
                if (category.includes(t) || t.includes(category) || words.some(w => t.includes(w) || w.includes(t))) {
                    expandedTags.add(category);
                    words.forEach(w => expandedTags.add(w));
                }
            }
        });

        const searchInArray = (vends: any[]) => vends.find(v => {
            const prof = v.profession.toLowerCase();
            for (const tag of Array.from(expandedTags)) {
                if (prof.includes(tag) || tag.includes(prof)) return true;
            }
            return false;
        });

        const fixedMatch = searchInArray(fixedArr);
        if (fixedMatch) return { vendor: fixedMatch, type: 'fixed' };

        const recMatch = searchInArray(recommendedArr);
        if (recMatch) return { vendor: recMatch, type: 'recommended' };

        return null;
    };

    const fixedVendors = vendors.filter(v => v.is_fixed)
    const recommendedVendors = vendors.filter(v => !v.is_fixed)

    const vendorsToDisplay = (vendorTab === 'קבועים' ? fixedVendors : recommendedVendors)
        .filter(v => !vendorSearch || v.name.includes(vendorSearch) || v.profession.includes(vendorSearch));

    const filteredTickets = activeFilter === 'הכל' ? tickets : tickets.filter(t => t.status === activeFilter);
    const currentYear = new Date().getFullYear();
    const pinnedTickets = filteredTickets.filter(t => t.is_pinned);
    const unpinnedTickets = filteredTickets.filter(t => !t.is_pinned);

    const currentYearTickets = unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() === currentYear);
    const archivedTickets = unpinnedTickets.filter(t => new Date(t.created_at).getFullYear() < currentYear);

    const groupedByMonth = currentYearTickets.reduce((acc: any, ticket: any) => {
        const month = new Date(ticket.created_at).toLocaleDateString('he-IL', { month: 'long' });
        if (!acc[month]) acc[month] = [];
        acc[month].push(ticket);
        return acc;
    }, {});

    const groupedByYear = archivedTickets.reduce((acc: any, ticket: any) => {
        const year = new Date(ticket.created_at).getFullYear().toString();
        if (!acc[year]) acc[year] = [];
        acc[year].push(ticket);
        return acc;
    }, {});

    const openCount = tickets.filter(t => t.status === 'פתוח').length;
    const inProgressCount = tickets.filter(t => t.status === 'בטיפול').length;
    const closedCount = tickets.filter(t => t.status === 'טופל').length;
    const allCount = tickets.length;

    const renderTicketCard = (ticket: any) => {
        const matchResult = isAdmin && ticket.status !== 'טופל' ? findMatchingVendor(ticket.ai_tags, fixedVendors, recommendedVendors) : null;
        const vendorMessage = matchResult ? `היי ${matchResult.vendor.name}, מדברים מוועד הבית.\nאשמח לעזרתך לגבי: ${ticket.title}\nתיאור: ${ticket.description}\nנוכל לתאם?` : '';

        return (
            <div key={ticket.id} className={`relative ${toastId === ticket.id ? 'z-50' : 'z-0'}`}>
                {toastId === ticket.id && (
                    <div className="absolute -top-10 left-2 bg-[#FFF7ED] border border-[#FED7AA] text-[#F97316] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none whitespace-nowrap">
                        לחיצה ארוכה לניהול
                    </div>
                )}
                <div
                    onTouchStart={() => handlePressStart(ticket)}
                    onTouchEnd={handlePressEnd}
                    onTouchMove={handlePressEnd}
                    onClick={() => {
                        if (isAdmin || profile?.id === ticket.user_id) {
                            showToast(ticket.id);
                        }
                    }}
                    className={`bg-white p-5 rounded-3xl shadow-[0_2px_20px_rgb(0,0,0,0.03)] border ${ticket.is_pinned ? 'border-orange-500/30' : 'border-gray-100/60'} flex flex-col gap-2 relative overflow-hidden text-right transition-transform active:scale-[0.98] select-none [-webkit-touch-callout:none]`}
                >
                    <div className={`absolute top-0 right-0 w-1.5 h-full ${ticket.status === 'פתוח' ? 'bg-red-400' : ticket.status === 'בטיפול' ? 'bg-orange-400' : 'bg-green-400'}`}></div>
                    
                    <div className="flex justify-between items-center pr-2 pointer-events-none">
                        <div className="flex items-center gap-2">
                            {ticket.profiles?.avatar_url ? (
                                <img src={ticket.profiles.avatar_url} className="w-8 h-8 rounded-full border border-gray-100 object-cover" alt="פרופיל" />
                            ) : (
                                <img src={`https://api.dicebear.com/8.x/initials/svg?seed=${ticket.profiles?.full_name}&backgroundColor=eef2ff&textColor=f97316`} className="w-8 h-8 rounded-full border border-gray-100 object-cover" alt="פרופיל" />
                            )}
                            <div>
                                <p className="text-xs font-bold text-brand-dark">{ticket.profiles?.full_name}</p>
                                <p className="text-[10px] text-gray-400">{timeFormat(ticket.created_at)}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {ticket.is_pinned && <svg className="w-3.5 h-3.5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>}
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${ticket.status === 'פתוח' ? 'text-red-500 bg-red-50' : ticket.status === 'בטיפול' ? 'text-orange-500 bg-orange-50' : 'text-green-500 bg-green-50'}`}>{ticket.status}</span>
                        </div>
                    </div>

                    <div className="pr-2 mt-1 pointer-events-none">
                        <p className="text-sm font-black text-brand-dark flex items-center gap-1.5">{ticket.title}</p>
                        {shouldShowDescription(ticket.title, ticket.description) && (
                            <p className="text-xs text-gray-600 mt-2 leading-relaxed bg-gray-50/80 p-3 rounded-xl border border-gray-50">"{ticket.description}"</p>
                        )}
                    </div>

                    {ticket.image_url && (
                        <div onClick={(e) => { e.stopPropagation(); setFullScreenImage(ticket.image_url); }} className="w-full h-32 rounded-2xl overflow-hidden cursor-pointer mt-2 border border-gray-50 relative z-10">
                            <img src={ticket.image_url} className="w-full h-full object-cover pointer-events-none" alt="תמונה" />
                        </div>
                    )}

                    {isAdmin && ticket.status !== 'טופל' && (
                        <div className="mt-3 bg-gradient-to-r from-orange-50/50 to-amber-50/50 border border-orange-100/50 rounded-2xl p-3 relative z-10 flex items-center justify-between">
                            <div onClick={(e) => e.stopPropagation()}>
                                <p className="text-[10px] font-black text-orange-600 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"></path></svg>
                                    זיהוי מערכת
                                </p>
                                {matchResult ? (
                                    <>
                                        <p className="text-xs font-bold text-brand-dark mt-0.5">סיווג: מתאים ל{matchResult.vendor.name} ({matchResult.vendor.profession})</p>
                                        {matchResult.type === 'recommended' && <p className="text-[9px] text-brand-dark/60 mt-0.5 font-bold">הומלץ ע"י {matchResult.vendor.profiles?.full_name}</p>}
                                    </>
                                ) : (
                                    <p className="text-xs font-bold text-brand-dark mt-0.5">
                                        הבעיה דורשת: <span className="text-orange-500">{ticket.ai_tags && ticket.ai_tags.length > 0 ? ticket.ai_tags[0] : 'איש מקצוע'}</span>
                                    </p>
                                )}
                            </div>
                            {matchResult && (
                                <div className="flex items-center gap-2 shrink-0">
                                    <a href={`tel:${matchResult.vendor.phone}`} onClick={(e) => { e.stopPropagation(); playSystemSound('click'); }} className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center pointer-events-auto">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                    </a>
                                    <a href={formatWhatsAppLink(matchResult.vendor.phone, vendorMessage)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center pointer-events-auto">
                                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && ticket.status !== 'טופל' && (
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-50 relative z-10">
                            {ticket.status === 'פתוח' && <button onClick={(e) => { e.stopPropagation(); updateTicketStatus(ticket.id, 'בטיפול', ticket.user_id, ticket.title); }} className="flex-1 bg-orange-50 text-orange-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95">העבר לטיפול</button>}
                            <button onClick={(e) => { e.stopPropagation(); updateTicketStatus(ticket.id, 'טופל', ticket.user_id, ticket.title); }} className="flex-1 bg-green-50 text-green-600 text-xs font-bold py-2.5 rounded-xl transition active:scale-95">סמן כטופל</button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    const renderGroup = (title: string, list: any[], groupKey: string) => {
        if (!list || list.length === 0) return null;
        const isExpanded = expandedGroups[groupKey];
        const visibleList = isExpanded ? list : list.slice(0, 5);
        const hasMore = list.length > 5;

        return (
            <div key={groupKey} className="space-y-4 mb-6">
                <div className="flex items-center gap-3 py-1">
                    <h3 className="text-xs font-black text-gray-400">{title}</h3>
                    <div className="flex-1 h-px bg-gray-100"></div>
                </div>
                {visibleList.map(renderTicketCard)}
                {hasMore && (
                    <button onClick={() => toggleGroup(groupKey)} className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-white border border-gray-100 rounded-2xl text-xs font-bold text-gray-500 shadow-sm active:scale-95 transition">
                        {isExpanded ? 'הצג פחות' : `הצג עוד ${list.length - 5} תקלות`}
                        <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col flex-1 w-full pb-24 relative" dir="rtl">
            
            <div className="px-4 mb-4 mt-4">
                <h2 className="text-2xl font-black text-brand-dark">תקלות שירות</h2>
            </div>

            <div className="grid grid-cols-3 gap-3 px-4 mb-6">
                {!isReporting ? (
                    <button onClick={() => setIsReporting(true)} className="col-span-2 bg-white border border-orange-100 rounded-[1.5rem] p-5 shadow-[0_8px_30px_rgb(249,115,22,0.06)] flex flex-col items-start justify-center active:scale-95 transition relative overflow-hidden group">
                        <div className="absolute -left-10 -top-10 w-32 h-32 bg-orange-100 rounded-full blur-3xl opacity-70"></div>
                        <h3 className="font-black text-orange-500 text-lg mb-0.5 relative z-10">דיווח תקלה</h3>
                        <p className="text-[11px] font-bold text-gray-500 relative z-10">המערכת תסווג לבד</p>
                    </button>
                ) : (
                    <div className="col-span-3">
                        <form onSubmit={handleSubmitReport} className="bg-white border border-orange-100 rounded-[2rem] p-5 shadow-lg animate-in zoom-in-95">
                            <div className="flex justify-between items-center mb-3">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-brand-dark">מה קרה?</h3>
                                    <span className="bg-orange-50 text-orange-500 text-[9px] font-bold px-2 py-0.5 rounded-full">מערכת חכמה פעילה</span>
                                </div>
                                <button type="button" onClick={() => setIsReporting(false)} className="p-2 bg-gray-50 rounded-full text-gray-500 hover:text-brand-dark"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                            </div>
                            <textarea autoFocus value={description} onChange={e => setDescription(e.target.value)} placeholder="תאר במילים שלך... המערכת כבר תבין למי להפנות את זה" className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[100px] mb-3 text-brand-dark border border-gray-100 focus:border-orange-300 transition" />
                            {imagePreview && (
                                <div className="relative w-24 h-24 mb-3 rounded-xl overflow-hidden shadow-sm">
                                    <img src={imagePreview} className="w-full h-full object-cover" alt="תצוגה" />
                                    <button type="button" onClick={() => {setImagePreview(null); setImageFile(null)}} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                                </div>
                            )}
                            <div className="flex gap-2">
                                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageChange} />
                                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-gray-50 border border-gray-100 text-gray-500 w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 active:scale-95 transition">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                </button>
                                <button type="submit" disabled={isSubmitting || (!description.trim() && !imageFile)} className="flex-1 bg-orange-500 text-white font-bold rounded-2xl shadow-sm disabled:opacity-50 active:scale-95 transition">
                                    {isSubmitting ? 'מעבד מידע...' : 'שליחה לוועד'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                
                {!isReporting && (
                    <button onClick={() => setShowVendors(true)} className="col-span-1 bg-white border border-gray-100 rounded-[1.5rem] p-4 shadow-sm flex flex-col items-center justify-center active:scale-95 transition text-center gap-2">
                        <div className="w-10 h-10 bg-indigo-50 text-[#1D4ED8] rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        </div>
                        <span className="text-[11px] font-black text-brand-dark">ספקים</span>
                    </button>
                )}
            </div>

            {/* --- טאבים לתקלות - עיצוב קפסולה --- */}
            <div className="space-y-4 px-4 mb-5 pt-2">
                <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10">
                    <button onClick={() => setActiveFilter('הכל')} className={`flex-1 py-3 text-[11px] rounded-full transition-all flex items-center justify-center gap-1.5 ${activeFilter === 'הכל' ? 'text-orange-500 font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                        הכל
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === 'הכל' ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-500'}`}>{allCount}</span>
                    </button>
                    <button onClick={() => setActiveFilter('פתוח')} className={`flex-1 py-3 text-[11px] rounded-full transition-all flex items-center justify-center gap-1.5 ${activeFilter === 'פתוח' ? 'text-orange-500 font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                        פתוחות
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === 'פתוח' ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-500'}`}>{openCount}</span>
                    </button>
                    <button onClick={() => setActiveFilter('בטיפול')} className={`flex-1 py-3 text-[11px] rounded-full transition-all flex items-center justify-center gap-1.5 ${activeFilter === 'בטיפול' ? 'text-orange-500 font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                        בטיפול
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === 'בטיפול' ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-500'}`}>{inProgressCount}</span>
                    </button>
                    <button onClick={() => setActiveFilter('טופל')} className={`flex-1 py-3 text-[11px] rounded-full transition-all flex items-center justify-center gap-1.5 ${activeFilter === 'טופל' ? 'text-orange-500 font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                        טופלו
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeFilter === 'טופל' ? 'bg-orange-50 text-orange-500' : 'bg-gray-100 text-gray-500'}`}>{closedCount}</span>
                    </button>
                </div>

                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {filteredTickets.length === 0 ? (
                        <div className="text-center py-10 bg-white/50 rounded-3xl border border-gray-100">
                            <p className="text-gray-400 font-medium text-sm">אין תקלות בסטטוס זה</p>
                        </div>
                    ) : (
                        <div>
                            {pinnedTickets.length > 0 && renderGroup('נעוץ ע"י הוועד', pinnedTickets, 'pinned')}
                            {Object.entries(groupedByMonth).map(([month, list]: [string, any]) => renderGroup(month, list, `month_${month}`))}
                            {Object.entries(groupedByYear).map(([year, list]: [string, any]) => renderGroup(`ארכיון ${year}`, list, `year_${year}`))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- AI Floating Character & Bubble (Bottom Right) --- */}
            <div 
                className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}
            >
                {showAiBubble && !isAiLoading && (
                    <div className="absolute bottom-[80px] right-0 mb-3 bg-white/95 backdrop-blur-xl text-slate-800 p-4 rounded-[2rem] rounded-br-md shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-[12px] font-bold w-[260px] leading-relaxed border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-500 whitespace-pre-wrap text-right pointer-events-auto">
                        {aiInsight}
                    </div>
                )}
                <button
                    onClick={() => {
                        if(showAiBubble) setShowAiBubble(false);
                        else if(!isAiLoading) setShowAiBubble(true);
                    }}
                    className={`w-20 h-20 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}
                >
                    {isAiLoading ? (
                        <div className="w-10 h-10 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white">
                            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : (
                        <img 
                            src={aiAvatarUrl} 
                            alt="AI Avatar" 
                            className="w-16 h-16 object-contain drop-shadow-2xl" 
                        />
                    )}
                </button>
            </div>

            {/* תפריט פעולות צף לתקלות */}
            {activeTicketMenu && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end" onClick={handleCloseTicketMenu}>
                    <div className="bg-white w-full rounded-t-[1.5rem] pt-3 px-6 pb-12 animate-in slide-in-from-bottom-full shadow-[0_-20px_60px_rgba(0,0,0,0.15)]" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
                        <div className="flex justify-center gap-6">
                            {isAdmin && (
                                <button onClick={() => { togglePin(activeTicketMenu.id, activeTicketMenu.is_pinned); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                    <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm border ${activeTicketMenu.is_pinned ? 'bg-orange-50 border-orange-200 text-orange-500' : 'bg-gray-50 border-gray-100 text-gray-600 group-hover:bg-gray-100'}`}>
                                        <svg className="w-7 h-7" fill={activeTicketMenu.is_pinned ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                    </div>
                                    <span className="text-xs font-black text-brand-dark">{activeTicketMenu.is_pinned ? 'ביטול נעיצה' : 'נעיצה'}</span>
                                </button>
                            )}
                            {(isAdmin || profile?.id === activeTicketMenu.user_id) && (
                                <>
                                    <button onClick={() => { setEditDescription(activeTicketMenu.description || ''); setEditingTicket(activeTicketMenu); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                        <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shadow-sm group-hover:bg-orange-100">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </div>
                                        <span className="text-xs font-black text-orange-500">עריכה</span>
                                    </button>
                                    <button onClick={() => { deleteTicket(activeTicketMenu.id); setActiveTicketMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shadow-sm group-hover:bg-red-100">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </div>
                                        <span className="text-xs font-black text-red-500">מחיקה</span>
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={() => setActiveTicketMenu(null)} className="mt-8 w-full py-4 bg-gray-50 text-gray-500 font-bold rounded-2xl active:scale-95 transition text-sm">ביטול</button>
                    </div>
                </div>
            )}

            {/* מודל עריכת תקלה */}
            {editingTicket && (
                <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
                        <h3 className="text-xl font-black text-brand-dark mb-4">עריכת דיווח</h3>
                        <textarea autoFocus value={editDescription} onChange={e => setEditDescription(e.target.value)} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none resize-none min-h-[120px] mb-4 text-brand-dark border border-gray-100 focus:border-orange-300 transition" />
                        <div className="flex gap-2">
                            <button onClick={handleSaveEdit} disabled={!editDescription.trim()} className="flex-1 bg-orange-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
                            <button onClick={() => setEditingTicket(null)} className="px-6 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
                        </div>
                    </div>
                </div>
            )}

            {/* מסך מלא: פנקס אנשי מקצוע */}
            {showVendors && (
                <div className="fixed inset-0 z-[100] bg-[#F8FAFC] flex flex-col h-[100dvh] w-full animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="px-5 pt-12 pb-4 flex items-center justify-between shrink-0 z-20 bg-[#F8FAFC] sticky top-0">
                        <div className="flex items-center gap-2">
                            <button onClick={() => {
                                if(isAddingVendor) {
                                    setIsAddingVendor(false);
                                } else {
                                    setShowVendors(false); setVendorSearch('');
                                }
                            }} className="p-2 -mr-2 text-slate-500 hover:text-slate-800 transition active:scale-95">
                                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                            <h2 className="text-2xl font-black text-slate-800">{isAddingVendor ? 'הוספת ספק' : 'פנקס ספקים'}</h2>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto hide-scrollbar px-5 pb-32 relative z-10">
                        {isAddingVendor ? (
                            <form onSubmit={handleAddVendor} className="bg-white border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] p-5 rounded-[1.5rem] space-y-4 animate-in zoom-in-95">
                                <input type="text" placeholder="שם (לדוג': יצחק החשמלאי)" value={newVendor.name} onChange={e => setNewVendor({...newVendor, name: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8]/30 transition" required />
                                <input type="text" placeholder="מקצוע (לדוג': חשמלאי)" value={newVendor.profession} onChange={e => setNewVendor({...newVendor, profession: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold focus:border-[#1D4ED8]/30 transition" required />
                                <input type="tel" placeholder="טלפון נייד" value={newVendor.phone} onChange={e => setNewVendor({...newVendor, phone: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm font-bold text-left focus:border-[#1D4ED8]/30 transition" dir="ltr" required />
                                
                                {isAdmin && (
                                    <label className="flex items-center gap-2 bg-[#E3F2FD]/50 p-3 rounded-xl cursor-pointer border border-[#BFDBFE]/50">
                                        <input type="checkbox" checked={isFixedVendor} onChange={e => setIsFixedVendor(e.target.checked)} className="w-4 h-4 text-[#2D5AF0] rounded border-gray-300" />
                                        <span className="text-xs font-bold text-slate-700">ספק קבוע של הבניין</span>
                                    </label>
                                )}

                                {(!isAdmin || !isFixedVendor) && (
                                    <div className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        <span className="text-xs font-bold text-slate-500">דרג את השירות:</span>
                                        <div className="flex gap-1 flex-row-reverse">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <svg key={star} onClick={() => setNewRating(star)} className={`w-8 h-8 cursor-pointer transition-transform hover:scale-110 ${star <= newRating ? 'text-yellow-400 drop-shadow-sm' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                    <button type="submit" className="flex-1 bg-[#2D5AF0] text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition">שמור בפנקס</button>
                                </div>
                            </form>
                        ) : (
                            <>
                                <div className="relative mb-5 shrink-0">
                                    <input
                                        type="text"
                                        placeholder="חיפוש איש מקצוע..."
                                        value={vendorSearch}
                                        onChange={e => setVendorSearch(e.target.value)}
                                        className="w-full bg-white border border-slate-200/60 rounded-[1.2rem] py-3.5 px-4 pr-11 outline-none text-sm font-medium focus:border-[#1D4ED8]/40 transition shadow-[0_2px_10px_rgb(0,0,0,0.02)]"
                                    />
                                    <svg className="w-5 h-5 absolute right-4 top-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>

                                <div className="mb-6 shrink-0 bg-white/60 backdrop-blur-md shadow-sm rounded-full p-1.5 flex gap-1 border border-white relative z-10">
                                    <button onClick={() => {setVendorTab('קבועים');}} className={`flex-1 py-2.5 rounded-full text-sm transition-colors ${vendorTab === 'קבועים' ? 'font-black bg-white text-[#1D4ED8] shadow-sm' : 'font-bold text-slate-500 hover:text-slate-700'}`}>ספקי הבית</button>
                                    <button onClick={() => {setVendorTab('המלצות');}} className={`flex-1 py-2.5 rounded-full text-sm transition-colors ${vendorTab === 'המלצות' ? 'font-black bg-white text-[#1D4ED8] shadow-sm' : 'font-bold text-slate-500 hover:text-slate-700'}`}>המלצות שכנים</button>
                                </div>

                                <div className="space-y-4">
                                    {vendorsToDisplay.map(v => (
                                        <div key={v.id} className={`relative ${toastId === v.id ? 'z-50' : 'z-0'}`}>
                                            {toastId === v.id && (
                                                <div className="absolute -top-10 left-2 bg-[#E3F2FD] border border-[#BFDBFE] text-[#1D4ED8] text-[11px] font-black px-3 py-1.5 rounded-xl shadow-sm animate-in slide-in-from-bottom-2 fade-in pointer-events-none whitespace-nowrap">
                                                    לחיצה ארוכה לניהול
                                                </div>
                                            )}

                                            <div
                                                onTouchStart={() => handleVendorPressStart(v)}
                                                onTouchEnd={handleVendorPressEnd}
                                                onTouchMove={handleVendorPressEnd}
                                                onClick={() => {
                                                    if (isAdmin || profile?.id === v.recommender_id) {
                                                        showToast(v.id);
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
                                                                        {[1, 2, 3, 4, 5].map(star => <svg key={star} className={`w-3 h-3 ${star <= (v.rating || 5) ? 'text-yellow-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>)}
                                                                    </div>
                                                                    <span className="text-[9px] text-slate-400 font-medium">ע"י {v.profiles?.full_name?.split(' ')[0]}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 shrink-0 pt-1 pointer-events-auto">
                                                        <a href={`tel:${v.phone}`} onClick={(e) => { e.stopPropagation(); playSystemSound('click'); }} className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>
                                                        </a>
                                                        <a href={formatWhatsAppLink(v.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {vendorsToDisplay.length === 0 && (
                                        <div className="text-center py-10">
                                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300 shadow-sm border border-slate-100">
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                            </div>
                                            <p className="text-slate-400 text-xs font-bold">לא נמצאו ספקים.</p>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* כפתור FAB למטה */}
                    {!isAddingVendor && (
                        <button onClick={() => setIsAddingVendor(true)} className="fixed bottom-8 left-6 bg-white border border-[#E3F2FD] shadow-[0_8px_25px_rgba(29,78,216,0.15)] rounded-[2rem] flex items-center justify-between pl-1 pr-5 py-1.5 gap-4 active:scale-95 transition-transform z-50">
                            <span className="font-black text-[#1D4ED8] text-[15px]">איש מקצוע חדש</span>
                            <div className="w-12 h-12 bg-[#E3F2FD] rounded-full flex items-center justify-center text-[#1D4ED8]">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path></svg>
                            </div>
                        </button>
                    )}
                </div>
            )}

            {/* תפריט פעולות צף לספקים */}
            {activeVendorMenu && (
                <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-end" onClick={handleCloseVendorMenu}>
                    <div className="bg-white w-full rounded-t-[1.5rem] pt-3 px-6 pb-12 animate-in slide-in-from-bottom-full shadow-[0_-20px_60px_rgba(0,0,0,0.15)]" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8"></div>
                        <div className="flex justify-center gap-6">
                            <a href={formatWhatsAppLink('', `היי, מצאתי המלצה בשכן+ על ${activeVendorMenu.profession} בשם ${activeVendorMenu.name}.\nהמספר שלו: ${activeVendorMenu.phone}`)} target="_blank" rel="noopener noreferrer" onClick={() => setActiveVendorMenu(null)} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                <div className="w-16 h-16 rounded-full bg-green-50 border border-green-100 text-[#25D366] flex items-center justify-center shadow-sm group-hover:bg-green-100">
                                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                </div>
                                <span className="text-xs font-black text-[#25D366]">שיתוף המלצה</span>
                            </a>
                            
                            {(isAdmin || profile?.id === activeVendorMenu.recommender_id) && (
                                <>
                                    <button onClick={() => { setEditVendorData({ name: activeVendorMenu.name, profession: activeVendorMenu.profession, phone: activeVendorMenu.phone }); setEditingVendor(activeVendorMenu); setActiveVendorMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                        <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 text-orange-500 flex items-center justify-center shadow-sm group-hover:bg-orange-100">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        </div>
                                        <span className="text-xs font-black text-orange-500">עריכה</span>
                                    </button>
                                    <button onClick={() => { handleDeleteVendor(activeVendorMenu.id); setActiveVendorMenu(null); }} className="flex flex-col items-center gap-2 group active:scale-95 transition">
                                        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 text-red-500 flex items-center justify-center shadow-sm group-hover:bg-red-100">
                                            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </div>
                                        <span className="text-xs font-black text-red-500">מחיקה</span>
                                    </button>
                                </>
                            )}
                        </div>
                        <button onClick={() => setActiveVendorMenu(null)} className="mt-8 w-full py-4 bg-gray-50 text-gray-500 font-bold rounded-2xl active:scale-95 transition text-sm">סגירה</button>
                    </div>
                </div>
            )}

            {/* מודל עריכת ספק */}
            {editingVendor && (
                <div className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-md rounded-[1.5rem] p-6 shadow-2xl animate-in zoom-in-95 text-right">
                        <h3 className="text-xl font-black text-brand-dark mb-4">עריכת איש מקצוע</h3>
                        <div className="space-y-3 mb-4">
                            <input type="text" placeholder="שם" value={editVendorData.name} onChange={e => setEditVendorData({...editVendorData, name: e.target.value})} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none text-brand-dark border border-gray-100 focus:border-[#1D4ED8]/30 transition" />
                            <input type="text" placeholder="מקצוע" value={editVendorData.profession} onChange={e => setEditVendorData({...editVendorData, profession: e.target.value})} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none text-brand-dark border border-gray-100 focus:border-[#1D4ED8]/30 transition" />
                            <input type="tel" placeholder="טלפון נייד" value={editVendorData.phone} onChange={e => setEditVendorData({...editVendorData, phone: e.target.value})} className="w-full bg-gray-50 rounded-2xl p-4 text-sm outline-none text-brand-dark border border-gray-100 focus:border-[#1D4ED8]/30 transition" dir="ltr" />
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSaveVendorEdit} disabled={!editVendorData.name.trim() || !editVendorData.phone.trim()} className="flex-1 bg-[#2D5AF0] text-white font-bold py-3.5 rounded-xl text-sm shadow-md active:scale-95 transition disabled:opacity-50">שמור שינויים</button>
                            <button onClick={() => setEditingVendor(null)} className="px-6 bg-gray-100 text-gray-500 font-bold rounded-xl text-sm active:scale-95 transition">ביטול</button>
                        </div>
                    </div>
                </div>
            )}

            {/* תצוגת תמונה במסך מלא */}
            {fullScreenImage && (
                <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center animate-in fade-in zoom-in-95" onClick={() => setFullScreenImage(null)}>
                    <button onClick={() => setFullScreenImage(null)} className="absolute top-6 right-6 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                    <img src={fullScreenImage} className="w-full h-auto max-h-screen object-contain p-4" alt="תמונה מוגדלת" />
                </div>
            )}
        </div>
    )
}
