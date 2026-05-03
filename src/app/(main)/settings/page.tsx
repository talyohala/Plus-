'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function SettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  
  // ניהול מצבים מקומיים
  const [soundsEnabled, setSoundsEnabled] = useState(true)
  const [pushEnabled, setPushEnabled] = useState(true)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(false)
  const [highContrast, setHighContrast] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [biometrics, setBiometrics] = useState(false)
  const [language, setLanguage] = useState('he')
  const [hidePhone, setHidePhone] = useState(false)
  const [notifChat, setNotifChat] = useState(true)
  const [notifPayments, setNotifPayments] = useState(true)

  // ניהול חלונות קופצים (מודלים)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    
    // טעינת הגדרות שמורות מזיכרון המכשיר
    setSoundsEnabled(localStorage.getItem('setting_sounds') !== 'false')
    setPushEnabled(localStorage.getItem('setting_push') !== 'false')
    setEmailEnabled(localStorage.getItem('setting_email') !== 'false')
    setSmsEnabled(localStorage.getItem('setting_sms') === 'true')
    setHighContrast(localStorage.getItem('setting_contrast') === 'true')
    setDarkMode(localStorage.getItem('setting_dark_mode') === 'true')
    setBiometrics(localStorage.getItem('setting_biometrics') === 'true')
    setLanguage(localStorage.getItem('setting_lang') || 'he')
    setHidePhone(localStorage.getItem('setting_hide_phone') === 'true')
    setNotifChat(localStorage.getItem('setting_notif_chat') !== 'false')
    setNotifPayments(localStorage.getItem('setting_notif_payments') !== 'false')
  }, [])

  const toggleSetting = (key: string, currentVal: boolean, setter: any) => {
    const newVal = !currentVal
    setter(newVal)
    localStorage.setItem(key, String(newVal))
  }

  const changeLanguage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    setLanguage(val)
    localStorage.setItem('setting_lang', val)
  }

  const handleLogout = async () => {
    if (confirm('האם אתה בטוח שברצונך להתנתק מהמערכת?')) {
      await supabase.auth.signOut()
      router.push('/login')
    }
  }

  const handleExportData = async () => {
    if (!user) return
    setIsExporting(true)
    
    const { data: payments } = await supabase.from('payments').select('*').eq('payer_id', user.id)
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"
    csvContent += "מזהה,עבור,סכום,סטטוס,תאריך\n"
    
    if (payments) {
      payments.forEach(p => {
        const statusHeb = p.status === 'paid' ? 'שולם' : p.status === 'pending' ? 'ממתין' : 'פטור'
        csvContent += `${p.id},${p.title},${p.amount},${statusHeb},${new Date(p.created_at).toLocaleDateString('he-IL')}\n`
      })
    }

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `נתוני_חשבון_שכן_פלוס.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    setIsExporting(false)
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ToggleRow = ({ label, icon, color, isChecked, onToggle, isSubItem = false }: any) => (
    <button onClick={onToggle} className={`w-full flex items-center justify-between p-4 transition ${isSubItem ? 'bg-gray-50/50 pl-8 border-t border-gray-50' : 'border-b border-gray-50 hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        {!isSubItem && (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${color}`}>{icon}</div>
        )}
        <span className={`font-bold text-brand-dark ${isSubItem ? 'text-xs' : 'text-sm'}`}>{label}</span>
      </div>
      <div className={`w-11 h-6 rounded-full relative transition-colors ${isChecked ? 'bg-brand-blue' : 'bg-gray-200'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${isChecked ? 'left-1' : 'left-6'}`}></div>
      </div>
    </button>
  )

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      <div className="px-4 mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">הגדרות המערכת</h2>
      </div>

      <div className="px-4 space-y-6">
        
        {/* כללי ואבטחה */}
        <section>
          <h3 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">כללי ואבטחה</h3>
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <Link href="/profile" className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition active:bg-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </div>
                <span className="text-sm font-bold text-brand-dark">עריכת פרופיל אישי</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </Link>

            <div className="flex items-center justify-between p-4 border-b border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"></path></svg>
                </div>
                <span className="text-sm font-bold text-brand-dark">שפת המערכת</span>
              </div>
              <select value={language} onChange={changeLanguage} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-dark outline-none focus:border-brand-blue">
                <option value="he">עברית</option>
                <option value="en">אנגלית</option>
                <option value="ru">רוסית</option>
                <option value="ar">ערבית</option>
              </select>
            </div>

            <ToggleRow 
              label="הסתרת מספר טלפון משכנים" 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>}
              color="bg-gray-100 text-gray-600"
              isChecked={hidePhone}
              onToggle={() => toggleSetting('setting_hide_phone', hidePhone, setHidePhone)}
            />

            <ToggleRow 
              label="כניסה ביומטרית (פנים/אצבע)" 
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>}
              color="bg-indigo-50 text-indigo-500"
              isChecked={biometrics}
              onToggle={() => toggleSetting('setting_biometrics', biometrics, setBiometrics)}
            />
          </div>
        </section>

        {/* ערוצי התראות */}
        <section>
          <h3 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">ערוצי התראות</h3>
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <ToggleRow label="התראות קופצות למכשיר" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>} color="bg-orange-50 text-orange-500" isChecked={pushEnabled} onToggle={() => toggleSetting('setting_push', pushEnabled, setPushEnabled)} />
            
            {/* הרחבת התראות אם דלוק */}
            {pushEnabled && (
              <>
                <ToggleRow label="הודעות אישיות" isChecked={notifChat} onToggle={() => toggleSetting('setting_notif_chat', notifChat, setNotifChat)} isSubItem={true} />
                <ToggleRow label="דרישות תשלום מהוועד" isChecked={notifPayments} onToggle={() => toggleSetting('setting_notif_payments', notifPayments, setNotifPayments)} isSubItem={true} />
              </>
            )}

            <ToggleRow label="קבלות ודוחות לדואר אלקטרוני" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>} color="bg-blue-50 text-blue-500" isChecked={emailEnabled} onToggle={() => toggleSetting('setting_email', emailEnabled, setEmailEnabled)} />
            <ToggleRow label="הודעות דחופות במסרון (SMS)" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>} color="bg-emerald-50 text-emerald-500" isChecked={smsEnabled} onToggle={() => toggleSetting('setting_sms', smsEnabled, setSmsEnabled)} />
          </div>
        </section>

        {/* מראה ושמע */}
        <section>
          <h3 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">מראה ושמע</h3>
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <ToggleRow label="מצב לילה (תצוגה כהה)" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>} color="bg-[#1E293B] text-white" isChecked={darkMode} onToggle={() => toggleSetting('setting_dark_mode', darkMode, setDarkMode)} />
            <ToggleRow label="צלילי מערכת" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path></svg>} color="bg-green-50 text-green-500" isChecked={soundsEnabled} onToggle={() => toggleSetting('setting_sounds', soundsEnabled, setSoundsEnabled)} />
            <ToggleRow label="ניגודיות גבוהה (נגישות)" icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>} color="bg-purple-50 text-purple-500" isChecked={highContrast} onToggle={() => toggleSetting('setting_contrast', highContrast, setHighContrast)} />
          </div>
        </section>

        {/* מידע ותמיכה */}
        <section>
          <h3 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">מידע ותמיכה</h3>
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <Link href="/settings/support" className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-500 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                </div>
                <span className="text-sm font-bold text-brand-dark">תמיכה טכנית ושאלות נפוצות</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
            <Link href="/settings/terms" className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div>
                <span className="text-sm font-bold text-brand-dark">תקנון ותנאי שימוש</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
            <Link href="/settings/accessibility" className="flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
                <span className="text-sm font-bold text-brand-dark">הצהרת נגישות</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
            <Link href="/settings/about" className="flex items-center justify-between p-4 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 text-gray-500 flex items-center justify-center"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                <span className="text-sm font-bold text-brand-dark">אודות המערכת</span>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </Link>
          </div>
        </section>

        {/* ניהול נתונים */}
        <section>
          <h3 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">ניהול נתונים אישיים</h3>
          <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
            <button onClick={handleExportData} disabled={isExporting} className="w-full flex items-center justify-between p-4 border-b border-gray-50 hover:bg-gray-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </div>
                <span className="text-sm font-bold text-brand-dark">{isExporting ? 'מכין קובץ נתונים...' : 'ייצוא הנתונים שלי למכשיר'}</span>
              </div>
            </button>
            <button onClick={() => setShowDeleteModal(true)} className="w-full flex items-center justify-between p-4 hover:bg-red-50 transition group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center group-hover:bg-red-100 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </div>
                <span className="text-sm font-bold text-red-500">מחיקת חשבון לצמיתות</span>
              </div>
            </button>
          </div>
        </section>

        {/* התנתקות */}
        <button onClick={handleLogout} className="w-full bg-white border border-gray-200 text-brand-dark font-bold py-4 rounded-3xl hover:bg-gray-50 transition active:scale-95 shadow-sm mt-4">
          התנתקות מהמערכת
        </button>

      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 mx-auto text-red-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="font-black text-xl text-center text-brand-dark mb-2">אזהרה: מחיקת חשבון</h3>
            <p className="text-sm text-center text-brand-gray mb-6 leading-relaxed">
              פעולה זו תמחק לצמיתות את המשתמש שלך, לרבות כל הפוסטים וההיסטוריה. לא ניתן לשחזר מידע זה. האם להמשיך?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 bg-gray-100 text-brand-dark font-bold py-3.5 rounded-2xl hover:bg-gray-200 transition active:scale-95">
                ביטול
              </button>
              <button onClick={handleDeleteAccount} className="flex-1 bg-red-500 text-white font-bold py-3.5 rounded-2xl hover:bg-red-600 transition shadow-sm active:scale-95">
                מחיקה סופית
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
