'use client'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { playSystemSound } from '../../../components/providers/AppManager'

const animalAvatars = [
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Lion.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Tiger.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Bear.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Panda.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Fox.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cat.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog.png',
    'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Rabbit.png'
]

export default function ProfilePage() {
    const [profile, setProfile] = useState<any>(null)
    const [building, setBuilding] = useState<any>(null)
    const [neighbors, setNeighbors] = useState<any[]>([])
    const [myPendingPayments, setMyPendingPayments] = useState<any[]>([])

    const [newBuildingName, setNewBuildingName] = useState('')
    const [createBuildingName, setCreateBuildingName] = useState('')
    const [joinBuildingCode, setJoinBuildingCode] = useState('')

    const [apartment, setApartment] = useState('')
    const [floor, setFloor] = useState('')
    
    const [isLoading, setIsLoading] = useState(true)
    const [isUpdating, setIsUpdating] = useState(false)
    const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
    const [neighborTab, setNeighborTab] = useState<'הכל' | 'הנהלה' | 'דיירים'>('הכל')

    // --- Alerts States ---
    const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
    const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

    // --- AI States ---
    const [aiInsight, setAiInsight] = useState<string>('')
    const [isAiLoading, setIsAiLoading] = useState(true)
    const [showAiBubble, setShowAiBubble] = useState(false)
    const [isGeneratingDraft, setIsGeneratingDraft] = useState(false)

    const router = useRouter()
    const avatarInputRef = useRef<HTMLInputElement>(null)

    // מנגנון חכם לבחירת האווטאר של ה-AI לפי בחירת המשתמש
    const aiAvatarUrl = useMemo(() => {
        const fallbackRobot = "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png";
        return profile?.avatar_url || fallbackRobot;
    }, [profile?.avatar_url]);

    const fetchData = useCallback(async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
            if (prof) {
                setProfile(prof)
                setApartment(prof.apartment || '')
                setFloor(prof.floor || '')

                const { data: payments } = await supabase.from('payments')
                    .select('title, amount')
                    .eq('payer_id', user.id)
                    .eq('status', 'pending')
                if (payments) setMyPendingPayments(payments)

                if (prof.building_id) {
                    const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
                    if (bld) {
                        if (!bld.invite_code) {
                            const newCode = 'B-' + Math.random().toString(36).substring(2, 6).toUpperCase()
                            await supabase.from('buildings').update({ invite_code: newCode }).eq('id', bld.id)
                            bld.invite_code = newCode
                        }
                        setBuilding(bld)
                        setNewBuildingName(bld.name)
                    }

                    const { data: nbs, error: nbsError } = await supabase.from('profiles')
                        .select('*')
                        .eq('building_id', prof.building_id)
                    if (!nbsError && nbs) setNeighbors(nbs)
                } else {
                    setBuilding(null)
                    setNeighbors([])
                }
            }
        } catch (error) {
            console.error("שגיאה כללית בטעינת הנתונים:", error)
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
        const channel = supabase.channel('profile_realtime_v38')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [fetchData])

    // --- AI Omniscient Logic ---
    useEffect(() => {
        const fetchAiData = async () => {
            if (!profile || !building) return;
            
            if (!isAiLoading && showAiBubble) return;

            setIsAiLoading(true);
            try {
                const pendingCount = neighbors.filter(n => n.approval_status === 'pending' && n.id !== profile.id).length;
                const totalPendingAmount = myPendingPayments.reduce((sum, p) => sum + p.amount, 0);

                let context = '';
                if (profile.role === 'admin') {
                    context = `
                        מנהל הוועד: ${profile.full_name}. בבניין ${building.name} יש ${neighbors.length} דיירים ו-${pendingCount} בקשות הצטרפות ממתינות. מנהל זה טרם שילם ${totalPendingAmount} ₪ בקופה.
                        נסח הודעת עזר מגוף ראשון כעוזר האישי החכם שלו. תן סקירת ניהול מהירה, פנה אליו בשמו, כתוב בדיוק 3 שורות עם ירידת שורה ביניהן (\n). בלי המילה חוב ובלי סימני שאלה. הוסף אימוג'י בכל שורה.
                    `;
                } else {
                    context = `
                        דייר: ${profile.full_name}. גר בבניין ${building.name} שמכיל ${neighbors.length} דיירים. נותר לו לשלם סך של ${totalPendingAmount} ₪.
                        נסח הודעת עזר אישית מגוף ראשון כעוזר האישי החמוד שלו. היה מדויק, פנה אליו בשמו, תן סקירה אישית. כתוב בדיוק 3 שורות קצרות עם ירידת שורה ביניהן (\n). בלי המילה חוב. הוסף אימוג'י בכל שורה.
                    `;
                }

                const res = await fetch('/api/ai/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description: context, mode: 'insight' })
                });

                const data = await res.json();
                const fallbackText = profile.role === 'admin'
                    ? `שלום ${profile.full_name}, קהילת ${building.name} איתך! 🏢\nיש ${pendingCount} דיירים הממתינים לאישור מנהל 👥\nשים לב ליתרות הפתוחות שלך להסדרה ✨`
                    : `היי ${profile.full_name}! כיף שאתה איתנו  🚀\nקהילת ${building.name} מתרחבת 🏢\nאנא ודא שהתשלומים שלך מוסדרים ✨`;

                setAiInsight(data.text || fallbackText);
                setShowAiBubble(true);
                setTimeout(() => setShowAiBubble(false), 10000);
            } catch (error) {
                setAiInsight(`הפרופיל שלך מסונכרן 🏢\nהקהילה שלנו פועלת מצוין ✅\nהמשך יום נעים! ✨`);
                setShowAiBubble(true);
                setTimeout(() => setShowAiBubble(false), 10000);
            } finally {
                setIsAiLoading(false);
            }
        };

        if (profile && building && !showAiBubble && isAiLoading) fetchAiData();
    }, [profile, building, neighbors.length, myPendingPayments.length, showAiBubble, isAiLoading]);

    const generateAdminDraft = async () => {
        setIsGeneratingDraft(true)
        playSystemSound('click')
        
        const approvedCount = neighbors.filter(n => n.approval_status === 'approved').length;
        const pendingCount = neighbors.filter(n => n.approval_status === 'pending').length;

        try {
            const prompt = `אתה מנהל ועד הבית של בניין "${building.name}". כרגע רשומים בקהילה ${approvedCount} דיירים ויש ${pendingCount} ממתינים לאישור.
                נסח הודעת וואטסאפ חגיגית, קצרה ומרעננת לדיירי הבניין. תהיה יצירתי ושנה את הניסוח בכל פעם. תעדכן שהקהילה שלנו צומחת, הזמן אותם להמשיך להשתמש באפליקציית "שכן+" לדיווח תקלות ותשלומים בנוחות, וסיים בברכה חמה. הוסף אימוג'ים מתאימים. החזר אך ורק את תוכן ההודעה.`
            
            const res = await fetch('/api/ai/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description: prompt, mode: 'insight' })
            })
            const data = await res.json()
            const draft = data.text || "היי שכנים! 🏢 רצינו לעדכן שהקהילה שלנו גדלה והכל מתנהל כשורה. מוזמנים להמשיך להשתמש באפליקציית שכן+ לכל פנייה לוועד. המשך שבוע מצוין לכולם! 💙"
            
            navigator.clipboard.writeText(draft)
            playSystemSound('notification')
            setCustomAlert({ title: 'הטיוטה הועתקה!', message: 'טיוטת ההודעה שנוסחה על ידי ה-AI הועתקה ללוח שלך. פשוט הדבק אותה בקבוצת הבניין.', type: 'success' })
        } catch (e) {
            setCustomAlert({ title: 'שגיאה', message: 'אירעה שגיאה ביצירת הטיוטה. נסה שוב מאוחר יותר.', type: 'error' })
        } finally {
            setIsGeneratingDraft(false)
        }
    }

    const handleCreateBuilding = async () => {
        if (!createBuildingName.trim() || !profile) return
        setIsUpdating(true)
        try {
            const { data: bldData, error: bldError } = await supabase.from('buildings').insert([{ name: createBuildingName }]).select().single()
            if (bldData && !bldError) {
                await supabase.from('profiles').update({ building_id: bldData.id, role: 'admin', approval_status: 'approved' }).eq('id', profile.id)
                playSystemSound('notification')
                setCreateBuildingName('')
                fetchData()
                setCustomAlert({ title: 'מזל טוב!', message: 'הבניין הוקם בהצלחה. כעת תוכל להזמין שכנים.', type: 'success' })
            }
        } finally { setIsUpdating(false) }
    }

    const handleJoinBuilding = async () => {
        if (!joinBuildingCode.trim() || !profile) return
        setIsUpdating(true)
        try {
            const { data: bldData, error } = await supabase.from('buildings').select('id, name').ilike('invite_code', joinBuildingCode.trim()).single()
            if (bldData && !error) {
                await supabase.from('profiles').update({ building_id: bldData.id, role: 'tenant', approval_status: 'pending' }).eq('id', profile.id)
                playSystemSound('notification')
                setJoinBuildingCode('')
                fetchData()
            } else {
                setCustomAlert({ title: 'שגיאה בהצטרפות', message: 'קוד הבניין שגוי או שהבניין אינו קיים במערכת.', type: 'error' })
            }
        } finally { setIsUpdating(false) }
    }

    const handleLeaveBuilding = async () => {
        setCustomConfirm({
            title: 'עזיבת הבניין',
            message: 'האם ברצונך להתנתק מהבניין הנוכחי? פעולה זו תסיר את גישתך לנתוני הקהילה.',
            onConfirm: async () => {
                setIsUpdating(true)
                await supabase.from('profiles').update({ building_id: null, role: 'tenant', approval_status: null }).eq('id', profile.id)
                playSystemSound('click')
                fetchData()
                setIsUpdating(false)
                setCustomConfirm(null)
            }
        })
    }

    const approveNeighbor = async (userId: string) => {
        await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', userId)
        playSystemSound('click')
        fetchData()
    }

    const rejectNeighbor = async (userId: string) => {
        setCustomConfirm({
            title: 'דחיית בקשה',
            message: 'האם לדחות את בקשת ההצטרפות של דייר זה?',
            onConfirm: async () => {
                await supabase.from('profiles').update({ building_id: null, approval_status: null }).eq('id', userId)
                playSystemSound('click')
                fetchData()
                setCustomConfirm(null)
            }
        })
    }

    const updateAvatarInDB = async (url: string) => {
        setIsUpdating(true)
        await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
        playSystemSound('notification')
        fetchData()
        setIsUpdating(false)
        setIsAvatarMenuOpen(false)
    }

    const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !profile) return
        setIsUpdating(true)
        setIsAvatarMenuOpen(false)
        const fileExt = file.name.split('.').pop()
        const filePath = `avatars/${profile.id}_${Date.now()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file)
        if (!uploadError) {
            const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
            await updateAvatarInDB(data.publicUrl)
        }
    }

    const resetToInitials = () => {
        updateAvatarInDB(`https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`)
    }

    const updateBuildingName = async () => {
        if (!building || !newBuildingName.trim()) return
        setIsUpdating(true)
        await supabase.from('buildings').update({ name: newBuildingName }).eq('id', building.id)
        playSystemSound('notification')
        fetchData()
        setIsUpdating(false)
    }

    const updatePersonalDetails = async () => {
        if (!profile) return
        setIsUpdating(true)
        await supabase.from('profiles').update({ apartment, floor, full_name: profile.full_name }).eq('id', profile.id)
        playSystemSound('notification')
        fetchData()
        setIsUpdating(false)
    }

    const toggleRole = async (userId: string, currentRole: string) => {
        const newRole = currentRole === 'admin' ? 'tenant' : 'admin'
        await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
        playSystemSound('click')
        fetchData()
    }

    const inviteNeighbors = () => {
        const code = building?.invite_code
        playSystemSound('click')
        const text = encodeURIComponent(`היי שכנים! 🏢\nהצטרפו לאפליקציית שכן+\n\nקוד ההצטרפות לבניין שלנו: *${code}*\n\nלהורדה: https://shechen-plus.com/join`)
        window.open(`https://wa.me/?text=${text}`, '_blank')
    }

    const copyBuildingCode = () => {
        const code = building?.invite_code
        navigator.clipboard.writeText(code || '')
        playSystemSound('click')
        setCustomAlert({ title: 'הועתק בהצלחה', message: 'קוד הבניין הועתק ללוח! שלח אותו לדיירים כדי שיצטרפו.', type: 'success' })
    }

    const formatWhatsAppLink = (phone: string) => {
        const cleanPhone = phone.replace(/\D/g, '')
        const baseUrl = cleanPhone.startsWith('0') ? `https://wa.me/972${cleanPhone.substring(1)}` : `https://wa.me/${cleanPhone}`
        return baseUrl;
    }

    if (isLoading) {
        return <div className="flex flex-col flex-1 w-full items-center justify-center pb-32 bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>
    }

    if (!profile) return null

    const isAdmin = profile.role === 'admin'
    const isPending = profile.approval_status === 'pending'
    const inviteCode = building?.invite_code
    
    const pendingNeighbors = neighbors.filter(n => n.approval_status?.trim() === 'pending' && n.id !== profile.id)
    const allAdmins = neighbors.filter(n => n.role === 'admin').sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const founderId = allAdmins.length > 0 ? allAdmins[0].id : null
    const isFounder = profile.id === founderId
    
    const approvedNeighbors = neighbors
        .filter(n => n.approval_status?.trim() !== 'pending' && n.id !== profile.id)
        .sort((a, b) => {
            if (a.role === 'admin' && b.role !== 'admin') return -1;
            if (a.role !== 'admin' && b.role === 'admin') return 1;
            return 0;
        });

    const displayedNeighbors = neighborTab === 'הכל' 
        ? approvedNeighbors 
        : neighborTab === 'הנהלה' 
        ? approvedNeighbors.filter(n => n.role === 'admin') 
        : approvedNeighbors.filter(n => n.role !== 'admin');

    return (
        <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-screen relative" dir="rtl">
            
            <div className="px-6 pt-6 pb-4 flex justify-between items-center sticky top-0 z-30">
                <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">הפרופיל שלי</h2>
                <Link href="/settings" className="w-10 h-10 bg-white/60 backdrop-blur-md rounded-full text-[#1D4ED8] hover:bg-white border border-white/50 transition active:scale-95 flex items-center justify-center shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                </Link>
            </div>

            <div className="px-6 space-y-6 relative z-10">
                
                {/* 1. פרטים אישיים ככרטיס צף בראש העמוד */}
                <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5 flex flex-col gap-6 relative">
                    
                    <div className="flex items-center gap-5">
                        <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                        
                        <div onClick={() => setIsAvatarMenuOpen(true)} className="relative w-[5.5rem] h-[5.5rem] shrink-0 cursor-pointer group">
                            <div className="w-full h-full rounded-full bg-white border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                <img src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-full h-full object-cover" />
                                {isUpdating && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div></div>}
                            </div>
                            {/* עיפרון עריכה - צד ימין למטה */}
                            <div className="absolute bottom-0 -right-1 bg-white p-1.5 rounded-full shadow-md border border-gray-100 text-[#1D4ED8] group-active:scale-90 transition z-20">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </div>
                        </div>

                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={profile.full_name}
                                onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                                className="text-2xl font-black text-slate-800 bg-transparent outline-none w-full pb-1 placeholder-slate-400/50 truncate"
                                placeholder="שם מלא"
                            />
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[10px] font-black px-3 py-1.5 rounded-full inline-flex items-center shadow-sm border ${!building ? 'bg-orange-50/80 text-orange-600 border-orange-100' : isPending ? 'bg-yellow-50/80 text-yellow-600 border-yellow-100' : isAdmin ? 'bg-[#1D4ED8]/10 text-[#1D4ED8] border-[#1D4ED8]/20' : 'bg-white/80 text-slate-500 border-white'}`}>
                                    {!building ? 'ללא קהילה' : isPending ? 'ממתין' : isAdmin ? 'מנהל הוועד' : 'דייר'}
                                </span>
                                
                                {/* כפתור AI ניסוח הודעות - רק אייקון דינמי ויפהפה */}
                                {building && !isPending && isAdmin && (
                                    <button 
                                        onClick={generateAdminDraft} 
                                        disabled={isGeneratingDraft}
                                        className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#1D4ED8] to-indigo-500 text-white flex items-center justify-center shadow-sm active:scale-95 transition hover:scale-105 disabled:opacity-50 disabled:scale-100"
                                        title="ניסוח הודעה דינמית לקהילה"
                                    >
                                        {isGeneratingDraft ? (
                                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"></path>
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white shadow-sm rounded-xl p-3.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">דירה</label>
                            <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-transparent text-base font-black outline-none text-slate-800 transition" placeholder="-" />
                        </div>
                        <div className="flex-1 bg-white/70 backdrop-blur-sm border border-white shadow-sm rounded-xl p-3.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 block">קומה</label>
                            <input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-transparent text-base font-black outline-none text-slate-800 transition" placeholder="-" />
                        </div>
                    </div>

                    <button onClick={updatePersonalDetails} disabled={isUpdating} className="w-full bg-[#1D4ED8] text-white text-sm font-bold py-4 rounded-xl shadow-md active:scale-95 transition disabled:opacity-50">
                        {isUpdating ? 'שומר נתונים...' : 'שמירת פרטים אישיים'}
                    </button>
                </div>

                {/* --- AI Floating Character & Bubble (Bottom Right) --- */}
                {building && !isPending && (
                    <div 
                        className={`fixed bottom-24 right-6 z-50 flex flex-col items-end pointer-events-none transition-all duration-700 ease-in-out ${isAiLoading || showAiBubble ? 'opacity-100 translate-y-0 visible' : 'opacity-0 translate-y-10 invisible'}`}
                    >
                        {/* בועת התובנות - ממוקמת אבסולוטית בדיוק מעל הדמות */}
                        {showAiBubble && !isAiLoading && (
                            <div className="absolute bottom-[80px] right-0 mb-3 bg-white/95 backdrop-blur-xl text-slate-800 p-4 rounded-[2rem] rounded-br-md shadow-[0_10px_40px_rgba(0,0,0,0.15)] text-[12px] font-bold w-[260px] leading-relaxed border border-gray-100 animate-in fade-in slide-in-from-bottom-2 duration-500 whitespace-pre-wrap text-right pointer-events-auto">
                                {aiInsight}
                            </div>
                        )}

                        {/* דמות ה-AI המרחפת (נטו החיה, בלי רקע עגול) */}
                        <button
                            onClick={() => {
                                if(showAiBubble) setShowAiBubble(false);
                                else if(!isAiLoading) setShowAiBubble(true);
                            }}
                            className={`w-20 h-20 bg-transparent flex items-center justify-center pointer-events-auto active:scale-95 transition-transform duration-300 ${isAiLoading ? 'animate-pulse' : 'animate-[bounce_3s_infinite]'}`}
                        >
                            {isAiLoading ? (
                                <div className="w-10 h-10 bg-white/50 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-white">
                                    <div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
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
                )}

                {/* --- מצב 1: משתמש ללא בניין --- */}
                {!building && !isPending && (
                    <div className="space-y-6">
                        <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5">
                            <h3 className="text-base font-black text-slate-800 mb-1">הצטרפות לקהילה</h3>
                            <p className="text-sm text-slate-500 mb-4">קוד זיהוי מהוועד:</p>
                            
                            <div className="flex gap-2">
                                <input type="text" value={joinBuildingCode} onChange={(e) => setJoinBuildingCode(e.target.value)} className="flex-1 min-w-0 bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-black outline-none focus:border-[#1D4ED8]/30 text-[#1D4ED8] text-center tracking-[0.2em] uppercase transition placeholder:font-sans placeholder:text-slate-400/40 placeholder:tracking-normal shadow-sm" placeholder="B-XXXX" dir="ltr"/>
                                <button onClick={handleJoinBuilding} disabled={isUpdating || !joinBuildingCode.trim()} className="shrink-0 bg-[#1D4ED8] text-white px-6 py-4 rounded-xl text-sm font-bold active:scale-95 transition shadow-sm disabled:opacity-50">
                                    הצטרפות
                                </button>
                            </div>
                        </div>

                        <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5">
                            <h3 className="text-base font-black text-slate-800 mb-1">הקמת קהילה חדשה</h3>
                            <p className="text-sm text-slate-500 mb-4">ועד הבית? פתח קהילה לניהול הבניין.</p>
                            <div className="flex flex-col gap-3">
                                <input type="text" value={createBuildingName} onChange={(e) => setCreateBuildingName(e.target.value)} className="w-full bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-bold outline-none focus:border-[#1D4ED8]/30 text-slate-800 transition shadow-sm" placeholder="שם הבניין (לדוג׳: אלון 8)"/>
                                <button onClick={handleCreateBuilding} disabled={isUpdating || !createBuildingName.trim()} className="w-full bg-slate-800 text-white py-4 rounded-xl text-sm font-bold active:scale-95 transition shadow-sm disabled:opacity-50 border border-slate-800">
                                    צור בניין חדש
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- מצב 2: משתמש ממתין לאישור --- */}
                {isPending && building && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5 flex flex-col gap-4">
                        <div className="bg-yellow-50/90 border border-yellow-100 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-yellow-500 shrink-0 shadow-sm">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <div className="pt-1">
                                <h3 className="text-base font-black text-slate-800 mb-1">ממתין לאישור הוועד</h3>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">בקשתך להצטרף אל <strong>{building.name}</strong> נשלחה. המתן לאישור.</p>
                            </div>
                        </div>

                        <button onClick={handleLeaveBuilding} className="w-full bg-red-50/80 text-red-500 border border-red-100 text-sm font-bold py-4 rounded-xl active:scale-95 transition flex items-center justify-center gap-2 shadow-sm">
                            ביטול ועזיבה
                        </button>
                    </div>
                )}

                {/* --- מצב 3: משתמש מאושר בבניין --- */}
                {building && !isPending && (
                    <div className="space-y-6">
                        
                        {/* ניהול שם הקהילה */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5">
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">פרטי הבניין</h4>
                            {isAdmin ? (
                                <div className="flex gap-2">
                                    <input type="text" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} className="flex-1 min-w-0 bg-white/80 border border-white rounded-xl px-4 py-4 text-base font-bold outline-none focus:border-[#1D4ED8]/30 text-slate-800 transition shadow-sm" placeholder="שם הבניין" />
                                    <button onClick={updateBuildingName} disabled={isUpdating || newBuildingName === building.name} className="shrink-0 bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 px-6 rounded-xl text-sm font-bold active:scale-95 transition shadow-sm disabled:opacity-50">
                                        עדכן
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-white/80 border border-white shadow-sm p-4 rounded-xl font-black text-slate-800">
                                    {building.name}
                                </div>
                            )}
                        </div>

                        {/* קוד הזמנה - עיצוב נקי וברור */}
                        {isAdmin && inviteCode && (
                            <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5">
                                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">קוד הצטרפות לבניין</h4>
                                
                                <div className="bg-white border border-gray-100 shadow-sm p-4 rounded-[1.5rem] flex items-center justify-between">
                                    <div>
                                        <p className="text-2xl font-black font-mono text-[#1D4ED8] tracking-[0.1em]">{inviteCode}</p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={copyBuildingCode} className="w-10 h-10 rounded-xl bg-[#2D5AF0] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                        </button>
                                        <button onClick={inviteNeighbors} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center">
                                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ממתינים לאישור (רק לוועד) */}
                        {isAdmin && pendingNeighbors.length > 0 && (
                            <div>
                                <h4 className="text-[11px] font-black text-orange-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                    <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span></span>
                                    ממתינים לאישור
                                </h4>
                                <div className="flex flex-col gap-3">
                                    {pendingNeighbors.map((n) => (
                                        <div key={n.id} className="flex items-center justify-between bg-white/80 border border-white shadow-sm p-3 rounded-[1.2rem]">
                                            <div className="flex items-center gap-3">
                                                <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-12 h-12 rounded-full bg-white object-cover border border-gray-100 shadow-sm" />
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{n.full_name}</p>
                                                    <p className="text-[10px] font-medium text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <button onClick={() => rejectNeighbor(n.id)} className="w-10 h-10 rounded-full bg-red-50/80 border border-red-100 text-red-500 flex items-center justify-center active:scale-95 transition shadow-sm">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                                <button onClick={() => approveNeighbor(n.id)} className="w-10 h-10 rounded-full bg-[#25D366] border border-[#25D366]/50 text-white flex items-center justify-center active:scale-95 transition shadow-sm">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* דיירי הבניין - ממוינים ומסוננים ע"י טאבים חכמים במראה קפסולה */}
                        <div>
                            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">רשימת דיירים</h4>
                            
                            {/* טאבים בסגנון קפסולה (הכל | הנהלה | דיירים) */}
                            <div className="flex bg-white/60 backdrop-blur-md p-1.5 rounded-full border border-white shadow-sm relative z-10 mb-4">
                                <button onClick={() => setNeighborTab('הכל')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${neighborTab === 'הכל' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                                    הכל
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${neighborTab === 'הכל' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'}`}>{approvedNeighbors.length}</span>
                                </button>
                                <button onClick={() => setNeighborTab('הנהלה')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${neighborTab === 'הנהלה' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                                    ועד
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${neighborTab === 'הנהלה' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'}`}>{approvedNeighbors.filter(n => n.role === 'admin').length}</span>
                                </button>
                                <button onClick={() => setNeighborTab('דיירים')} className={`flex-1 py-3 text-xs rounded-full transition-all flex items-center justify-center gap-1.5 ${neighborTab === 'דיירים' ? 'text-[#1D4ED8] font-black bg-white shadow-sm' : 'text-slate-500 font-bold hover:text-slate-700'}`}>
                                    דיירים
                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${neighborTab === 'דיירים' ? 'bg-[#1D4ED8]/10 text-[#1D4ED8]' : 'bg-gray-100 text-gray-500'}`}>{approvedNeighbors.filter(n => n.role !== 'admin').length}</span>
                                </button>
                            </div>

                            <div className="flex flex-col gap-3 animate-in fade-in duration-300">
                                {displayedNeighbors.length === 0 ? (
                                    <div className="text-center text-slate-500 text-sm font-medium py-6 bg-white/40 rounded-3xl border border-dashed border-white/80">לא נמצאו תוצאות.</div>
                                ) : (
                                    displayedNeighbors.map((n) => (
                                        <div key={n.id} className="flex items-center justify-between bg-white/80 border border-white shadow-sm p-3 rounded-[1.2rem] transition hover:bg-white">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-12 h-12 rounded-full bg-white shrink-0 object-cover border border-gray-100 shadow-sm" />
                                                <div className="truncate">
                                                    <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                                                        <span className="truncate">{n.full_name}</span>
                                                        {n.role === 'admin' && <span className="text-[9px] bg-[#1D4ED8]/10 text-[#1D4ED8] px-2 py-0.5 rounded-md font-black shrink-0">ועד</span>}
                                                    </p>
                                                    <p className="text-[10px] font-medium text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                                                </div>
                                            </div>

                                            <div className="flex gap-1.5 shrink-0 pl-1 items-center">
                                                {n.phone && (
                                                    <a href={formatWhatsAppLink(n.phone)} target="_blank" className="w-9 h-9 rounded-full bg-[#25D366] text-white shadow-sm active:scale-95 transition flex items-center justify-center border border-[#25D366]/50">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                                    </a>
                                                )}

                                                {isAdmin && n.id !== profile.id && (n.role !== 'admin' || isFounder) && (
                                                    <button onClick={() => toggleRole(n.id, n.role)} className={`text-[10px] font-black px-3 h-9 rounded-xl transition active:scale-95 flex items-center justify-center shadow-sm border ${n.role === 'admin' ? 'bg-red-50/80 text-red-500 border-red-100' : 'bg-white text-slate-500 border-gray-100 hover:bg-[#1D4ED8]/10 hover:text-[#1D4ED8] hover:border-[#1D4ED8]/30'}`}>
                                                        {n.role === 'admin' ? 'הסר ועד' : 'מינוי'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* עזיבת בניין */}
                        <div className="pt-2">
                            <button onClick={handleLeaveBuilding} className="w-full bg-white/60 backdrop-blur-sm border border-red-100 text-red-500 hover:bg-red-50 text-sm font-bold py-4 rounded-xl active:scale-95 transition flex items-center justify-center gap-2 shadow-sm">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                התנתקות מהבניין
                            </button>
                        </div>

                    </div>
                )}
            </div>

            {/* תפריט שינוי תמונת פרופיל */}
            {isAvatarMenuOpen && (
                <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex justify-center items-end">
                    <div className="bg-white/95 backdrop-blur-xl w-full max-w-md rounded-t-[2rem] p-6 pb-12 shadow-2xl animate-in slide-in-from-bottom-10 border-t border-white/50">
                        <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6"></div>
                        <div className="flex justify-between items-center mb-6 px-1">
                            <h3 className="font-black text-xl text-slate-800">תמונת פרופיל</h3>
                            <button onClick={() => setIsAvatarMenuOpen(false)} className="w-10 h-10 bg-gray-50 border border-gray-100 rounded-xl text-slate-500 hover:text-[#1D4ED8] transition active:scale-95 flex items-center justify-center shadow-sm">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <div className="flex flex-col gap-4">
                            <div className="bg-white/80 p-5 rounded-[1.5rem] border border-gray-100 shadow-sm">
                                <div className="grid grid-cols-4 gap-3">
                                    {animalAvatars.map((avatar, idx) => (
                                        <button key={idx} onClick={() => updateAvatarInDB(avatar)} className="aspect-square rounded-full bg-white border border-gray-100 hover:border-[#1D4ED8] hover:shadow-md transition active:scale-90 overflow-hidden flex items-center justify-center p-2 shadow-sm">
                                            <img src={avatar} className="w-full h-full object-contain drop-shadow-sm" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-2">
                                <button onClick={() => avatarInputRef.current?.click()} className="flex-[2] flex items-center justify-center gap-2 bg-[#1D4ED8]/10 text-[#1D4ED8] border border-[#1D4ED8]/20 py-4 rounded-xl font-bold active:scale-95 transition shadow-sm text-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                    מהגלריה
                                </button>
                                <button onClick={resetToInitials} className="flex-[1] flex items-center justify-center gap-2 bg-white shadow-sm text-slate-500 border border-gray-100 py-4 rounded-xl font-bold active:scale-95 transition text-sm hover:text-slate-800">
                                    איפוס
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- התראות מערכת וחלוניות אישור מעוצבות --- */}
            {customAlert && (
                <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
                        <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center shadow-sm ${customAlert.type === 'success' ? 'bg-[#059669]/10 text-[#059669]' : customAlert.type === 'error' ? 'bg-red-50 text-red-500' : 'bg-[#1D4ED8]/10 text-[#1D4ED8]'}`}>
                            {customAlert.type === 'success' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>}
                            {customAlert.type === 'error' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>}
                            {customAlert.type === 'info' && <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">{customAlert.title}</h3>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customAlert.message}</p>
                        <button onClick={() => setCustomAlert(null)} className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl active:scale-95 transition shadow-sm">סגירה</button>
                    </div>
                </div>
            )}

            {customConfirm && (
                <div className="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex justify-center items-center p-4">
                    <div className="bg-white/95 backdrop-blur-xl rounded-[2rem] p-6 w-full max-w-sm shadow-2xl text-center animate-in zoom-in-95 border border-white/50">
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 text-orange-500 shadow-sm">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <h3 className="text-xl font-black text-slate-800 mb-2">{customConfirm.title}</h3>
                        <p className="text-sm text-slate-500 mb-6 leading-relaxed">{customConfirm.message}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setCustomConfirm(null)} className="flex-1 bg-white text-slate-600 font-bold py-3.5 rounded-xl hover:bg-gray-50 transition active:scale-95 border border-gray-200 shadow-sm">ביטול</button>
                            <button onClick={customConfirm.onConfirm} className="flex-1 bg-[#1D4ED8] text-white font-bold py-3.5 rounded-xl transition shadow-sm active:scale-95">אישור</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
