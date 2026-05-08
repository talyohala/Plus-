'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { playSystemSound } from '../../../components/providers/AppManager'

export default function SettingsPage() {
    const [profile, setProfile] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(true)
    const router = useRouter()

    const [customAlert, setCustomAlert] = useState<{ title: string, message: string, type: 'success' | 'error' | 'info' } | null>(null)
    const [customConfirm, setCustomConfirm] = useState<{ title: string, message: string, onConfirm: () => void } | null>(null)

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
                if (prof) setProfile(prof)
            }
            setIsLoading(false)
        }
        fetchProfile()
    }, [])

    const handleLogout = async () => {
        setCustomConfirm({
            title: 'התנתקות',
            message: 'האם אתה בטוח שברצונך להתנתק מהחשבון?',
            onConfirm: async () => {
                playSystemSound('click')
                await supabase.auth.signOut()
                router.push('/login')
            }
        })
    }

    const handleDeleteAccount = () => {
        setCustomConfirm({
            title: 'מחיקת חשבון לצמיתות',
            message: 'פעולה זו תמחק את כל הנתונים שלך מהמערכת ולא ניתנת לביטול. האם להמשיך?',
            onConfirm: async () => {
                playSystemSound('click')
                // מחיקת חשבון דורשת הרשאות שרת, כאן אנחנו עושים יציאה כברירת מחדל + התראה
                // אפשר להוסיף קריאה ל-Edge Function שמוחקת את היוזר ב-Supabase
                setCustomAlert({ 
                    title: 'בקשתך התקבלה', 
                    message: 'החשבון נמצא בתהליך מחיקה. המערכת תנתק אותך כעת.', 
                    type: 'info' 
                })
                setTimeout(async () => {
                    await supabase.auth.signOut()
                    router.push('/login')
                }, 3000)
                setCustomConfirm(null)
            }
        })
    }

    const contactSupport = () => {
        playSystemSound('click')
        const text = encodeURIComponent("היי צוות שכן+, אשמח לעזרה לגבי האפליקציה.")
        window.open(`https://wa.me/972500000000?text=${text}`, '_blank') // תחליף למספר שלך
    }

    if (isLoading) {
        return <div className="flex flex-col flex-1 w-full items-center justify-center min-h-[100dvh] bg-transparent"><div className="w-12 h-12 border-4 border-[#1D4ED8]/30 border-t-[#1D4ED8] rounded-full animate-spin"></div></div>
    }

    return (
        <div className="flex flex-col flex-1 w-full pb-32 bg-transparent min-h-[100dvh] relative" dir="rtl">
            <div className="px-6 pt-6 pb-4 flex justify-between items-center sticky top-0 z-30 bg-transparent">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center bg-white/60 backdrop-blur-md rounded-full text-slate-500 hover:text-[#1D4ED8] transition-all active:scale-95 border border-white/50 shadow-sm">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                    <h2 className="text-2xl font-black text-slate-800 drop-shadow-sm">הגדרות</h2>
                </div>
            </div>

            <div className="px-5 mt-4 space-y-6">
                
                {/* פרופיל קצר */}
                {profile && (
                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] p-5 flex items-center gap-4">
                        <img src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=EFF6FF&textColor=1D4ED8`} className="w-14 h-14 rounded-full border-2 border-white shadow-sm object-cover" />
                        <div>
                            <h3 className="font-black text-lg text-slate-800">{profile.full_name}</h3>
                            <p className="text-sm font-medium text-slate-500">{profile.phone}</p>
                        </div>
                    </div>
                )}

                {/* תמיכה ומידע */}
                <div>
                    <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 px-2">כללי</h4>
                    <div className="bg-white/60 backdrop-blur-xl border border-white/50 shadow-sm rounded-[1.5rem] overflow-hidden">
                        <button onClick={contactSupport} className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white/80 transition active:scale-[0.98]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#1D4ED8]/10 text-[#1D4ED8] flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                </div>
                                <span className="font-bold text-slate-700">תמיכה טכנית</span>
                            </div>
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                        </button>
                        
                        <div className="h-px w-full bg-slate-100"></div>

                        <div className="w-full flex items-center justify-between p-4 bg-white/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                </div>
                                <span className="font-bold text-slate-700">גרסת אפליקציה</span>
                            </div>
                            <span className="text-sm font-black text-slate-400 font-mono">v2.0.0</span>
                        </div>
                    </div>
                </div>

                {/* אזור סכנה */}
                <div>
                    <h4 className="text-[11px] font-black text-rose-400 uppercase tracking-wider mb-3 px-2">חשבון</h4>
                    <div className="bg-white/60 backdrop-blur-xl border border-rose-100/50 shadow-sm rounded-[1.5rem] overflow-hidden">
                        <button onClick={handleLogout} className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-rose-50/50 transition active:scale-[0.98]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                                </div>
                                <span className="font-bold text-slate-700">התנתקות מהחשבון</span>
                            </div>
                        </button>
                        
                        <div className="h-px w-full bg-slate-100"></div>

                        <button onClick={handleDeleteAccount} className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-rose-50 transition active:scale-[0.98]">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </div>
                                <span className="font-bold text-rose-600">מחיקת חשבון לצמיתות</span>
                            </div>
                        </button>
                    </div>
                </div>

            </div>

            {/* --- חלוניות אישור והתראה --- */}
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
                        <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-orange-50 text-orange-500 shadow-sm"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>
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
