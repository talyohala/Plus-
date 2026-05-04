'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
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
  
  const [newBuildingName, setNewBuildingName] = useState('')
  const [createBuildingName, setCreateBuildingName] = useState('')
  const [joinBuildingCode, setJoinBuildingCode] = useState('')
  
  const [apartment, setApartment] = useState('')
  const [floor, setFloor] = useState('')
  
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (prof) {
        setProfile(prof)
        setApartment(prof.apartment || '')
        setFloor(prof.floor || '')

        if (prof.building_id) {
          const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
          if (bld) {
            if (!bld.invite_code) {
              const newCode = 'B-' + Math.random().toString(36).substring(2, 6).toUpperCase();
              await supabase.from('buildings').update({ invite_code: newCode }).eq('id', bld.id);
              bld.invite_code = newCode;
            }
            setBuilding(bld)
            setNewBuildingName(bld.name)
          }

          const { data: nbs } = await supabase.from('profiles')
            .select('*')
            .eq('building_id', prof.building_id)
            .order('created_at', { ascending: false })
          if (nbs) setNeighbors(nbs)
        } else {
          setBuilding(null)
          setNeighbors([])
        }
      }
    } catch (error) {
      console.error("שגיאה בטעינת הנתונים:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase.channel('profile_realtime_v25')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buildings' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const handleCreateBuilding = async () => {
    if (!createBuildingName.trim() || !profile) return
    setIsUpdating(true)
    try {
      const { data: bldData, error: bldError } = await supabase
        .from('buildings')
        .insert([{ name: createBuildingName }])
        .select()
        .single()

      if (bldData && !bldError) {
        await supabase.from('profiles').update({ building_id: bldData.id, role: 'admin', approval_status: 'approved' }).eq('id', profile.id)
        playSystemSound('notification')
        alert('הקהילה הוקמה בהצלחה. הנך מנהל הוועד.')
        setCreateBuildingName('')
        fetchData()
      } else {
        alert("שגיאה בהקמת הבניין: " + bldError?.message)
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleJoinBuilding = async () => {
    if (!joinBuildingCode.trim() || !profile) return
    setIsUpdating(true)
    try {
      const { data: bldData, error } = await supabase.from('buildings').select('id, name').ilike('invite_code', joinBuildingCode.trim()).single()

      if (bldData && !error) {
        await supabase.from('profiles').update({ building_id: bldData.id, role: 'tenant', approval_status: 'pending' }).eq('id', profile.id)
        playSystemSound('notification')
        alert(`בקשת הצטרפות לבניין "${bldData.name}" נשלחה לוועד. המתן לאישור.`)

        const { data: adminProf } = await supabase.from('profiles').select('id').eq('building_id', bldData.id).eq('role', 'admin').single()
        if (adminProf) {
          await supabase.from('notifications').insert([{ receiver_id: adminProf.id, sender_id: profile.id, type: 'system', title: 'בקשת הצטרפות חדשה', content: `${profile.full_name} מבקש/ת להצטרף לבניין. המתן לאישור.`, link: '/profile' }])
        }
        setJoinBuildingCode('')
        fetchData()
      } else {
        alert("קוד הבניין שגוי או שהבניין אינו קיים במערכת.")
      }
    } finally {
      setIsUpdating(false)
    }
  }

  // הפונקציה החדשה לעזיבת בניין
  const handleLeaveBuilding = async () => {
    if(confirm("האם אתה בטוח שברצונך לעזוב את הקהילה? לא תהיה לך יותר גישה לנתוני הבניין.")) {
      setIsUpdating(true)
      await supabase.from('profiles').update({ building_id: null, role: 'tenant', approval_status: 'approved' }).eq('id', profile.id)
      playSystemSound('click')
      fetchData()
      setIsUpdating(false)
    }
  }

  const approveNeighbor = async (userId: string) => {
    await supabase.from('profiles').update({ approval_status: 'approved' }).eq('id', userId)
    await supabase.from('notifications').insert([{ receiver_id: userId, sender_id: profile.id, type: 'system', title: 'בקשתך אושרה!', content: 'ברוך הבא לקהילת הבניין. כעת תוכל לצפות בלוח המודעות ולהשתתף.', link: '/' }])
    playSystemSound('click')
    fetchData()
  }

  const rejectNeighbor = async (userId: string) => {
    if(confirm("האם לדחות את בקשת ההצטרפות?")) {
      await supabase.from('profiles').update({ building_id: null, approval_status: 'approved' }).eq('id', userId)
      playSystemSound('click')
      fetchData()
    }
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
    } else {
      alert("שגיאה בהעלאת התמונה.")
      setIsUpdating(false)
    }
  }

  const resetToInitials = () => {
    updateAvatarInDB(`https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`)
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
    const text = encodeURIComponent(`שלום שכנים!\nהקמתי את קהילת הבניין שלנו באפליקציית שכן+ 🏢\n\nהורידו את האפליקציה והזינו את קוד הבניין הבא כדי להצטרף אלינו:\n*${code}*\n\nנתראה בפנים!`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const copyBuildingCode = () => {
    const code = building?.invite_code
    navigator.clipboard.writeText(code || '')
    playSystemSound('click')
    alert('קוד הבניין הועתק ללוח!')
  }

  if (isLoading) {
    return <div className="flex flex-col flex-1 w-full items-center justify-center pb-32 bg-[#F8FAFC]"><div className="w-10 h-10 border-4 border-[#E3F2FD] border-t-[#1D4ED8] rounded-full animate-spin"></div><p className="mt-4 font-bold text-[#1D4ED8]">טוען נתונים...</p></div>
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin'
  const isPending = profile.approval_status === 'pending'
  const inviteCode = building?.invite_code

  const pendingNeighbors = neighbors.filter(n => n.approval_status === 'pending')
  const approvedNeighbors = neighbors.filter(n => n.approval_status === 'approved')

  return (
    <div className="flex flex-col flex-1 w-full pb-32 bg-[#F8FAFC] min-h-[100dvh]" dir="rtl">
      
      {/* הדר עליון נקי */}
      <div className="px-5 pt-6 pb-2 flex justify-between items-center sticky top-0 bg-[#F8FAFC]/90 backdrop-blur-md z-30">
        <h2 className="text-2xl font-black text-slate-800">הפרופיל שלי</h2>
        <Link href="/settings" className="w-10 h-10 bg-white rounded-full border border-slate-100 shadow-sm text-slate-400 hover:text-[#1D4ED8] transition active:scale-95 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </Link>
      </div>

      <div className="px-5 mt-4 space-y-6">
        
        {/* אזור פרטים אישיים - משולב בצורה חלקה ללא מסגרות כבדות */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5">
            <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            
            <div onClick={() => setIsAvatarMenuOpen(true)} className="relative w-[5.5rem] h-[5.5rem] shrink-0 cursor-pointer group block">
              <div className="w-full h-full rounded-[1.5rem] border-[3px] border-white bg-[#E3F2FD] shadow-[0_4px_15px_rgb(29,78,216,0.1)] overflow-hidden relative flex items-center justify-center">
                <img src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-full h-full object-cover" />
                {isUpdating && <div className="absolute inset-0 bg-white/60 flex items-center justify-center"><div className="w-5 h-5 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div></div>}
              </div>
              <div className="absolute -bottom-1 -left-1 bg-white p-1.5 rounded-full shadow-md text-[#1D4ED8] group-active:scale-90 transition z-20">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </div>
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                className="text-xl font-black text-slate-800 bg-transparent outline-none w-full border-b border-transparent focus:border-[#E3F2FD] transition-colors pb-1"
                placeholder="שם מלא"
              />
              <span className={`text-[10px] font-bold px-3 py-1 rounded-full mt-1.5 inline-block shadow-sm ${!building ? 'bg-orange-50 text-orange-600 border border-orange-100' : isPending ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' : isAdmin ? 'bg-[#E3F2FD] text-[#1D4ED8] border border-[#BFDBFE]' : 'bg-slate-50 text-slate-600 border border-slate-200'}`}>
                {!building ? 'ללא בניין' : isPending ? 'ממתין לאישור' : isAdmin ? 'מנהל הוועד' : 'דייר בבניין'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">דירה</label>
              <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-transparent text-lg font-black text-slate-800 outline-none placeholder-slate-300" placeholder="-" />
            </div>
            <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">קומה</label>
              <input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-transparent text-lg font-black text-slate-800 outline-none placeholder-slate-300" placeholder="-" />
            </div>
          </div>
          
          <button onClick={updatePersonalDetails} disabled={isUpdating} className="w-full bg-[#1D4ED8] text-white text-sm font-bold py-3.5 rounded-[1.2rem] shadow-md active:scale-95 transition disabled:opacity-50">
            {isUpdating ? 'שומר נתונים...' : 'שמירת פרטים אישיים'}
          </button>
        </div>

        <div className="h-px bg-slate-200/60 w-full my-2"></div>

        {/* --- מצב 1: למשתמש אין בניין (הצטרפות או יצירה) --- */}
        {!building && !isPending && (
          <div className="space-y-6">
            <div className="bg-white border border-[#E3F2FD] rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center text-[#1D4ED8]">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">הצטרפות לקהילה</h3>
                  <p className="text-xs text-slate-500 font-medium">הזן את קוד הבניין שקיבלת מהוועד</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input type="text" value={joinBuildingCode} onChange={(e) => setJoinBuildingCode(e.target.value)} className="w-full bg-[#F8FAFC] border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-black outline-none focus:border-[#1D4ED8] text-slate-800 text-center tracking-[0.2em] uppercase transition" placeholder="לדוג': B-X7K9" dir="ltr"/>
                <button onClick={handleJoinBuilding} disabled={isUpdating || !joinBuildingCode.trim()} className="w-full bg-[#E3F2FD] text-[#1D4ED8] py-3.5 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50">
                  {isUpdating ? 'מחפש...' : 'שליחת בקשת הצטרפות'}
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E3F2FD] rounded-[2rem] p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-[#E3F2FD] rounded-full flex items-center justify-center text-[#1D4ED8]">
                   <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">הקמת בניין חדש</h3>
                  <p className="text-xs text-slate-500 font-medium">פתח קהילה חדשה כראש הוועד</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <input type="text" value={createBuildingName} onChange={(e) => setCreateBuildingName(e.target.value)} className="w-full bg-[#F8FAFC] border border-slate-100 rounded-xl px-4 py-3.5 text-sm font-bold outline-none focus:border-[#1D4ED8] text-slate-800 transition" placeholder="שם הבניין (לדוג׳: מגדלי אלון 8)"/>
                <button onClick={handleCreateBuilding} disabled={isUpdating || !createBuildingName.trim()} className="w-full bg-[#E3F2FD] text-[#1D4ED8] py-3.5 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50">
                  {isUpdating ? 'מקים קהילה...' : 'הקם קהילה כמנהל'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* --- מצב 2: משתמש ממתין לאישור --- */}
        {isPending && building && (
          <div className="space-y-4">
            <div className="bg-white border border-yellow-200 rounded-[2rem] p-6 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-yellow-50 rounded-full flex items-center justify-center text-yellow-500 shrink-0">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800 mb-1">ממתין לאישור הוועד</h3>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-4">בקשתך להצטרף אל <strong>{building.name}</strong> נשלחה. ברגע שיאשרו אותך התוכן יוצג כאן.</p>
              </div>
            </div>
            
            {/* כפתור ביטול בקשה ועזיבת בניין */}
            <button onClick={handleLeaveBuilding} className="w-full bg-white border border-red-100 text-red-500 text-sm font-bold py-3.5 rounded-xl hover:bg-red-50 active:scale-95 transition shadow-sm flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              ביטול ועזיבת הבניין
            </button>
          </div>
        )}

        {/* --- מצב 3: משתמש מאושר בבניין --- */}
        {building && !isPending && (
          <div className="space-y-6">
            
            {/* פרטי קהילה והזמנה (לוועד יש כפתור וואטסאפ ושליטה) */}
            <section className="bg-white border border-[#E3F2FD] rounded-[2rem] p-5 shadow-sm">
              <h4 className="text-xs font-black text-slate-400 mb-4 px-1 uppercase tracking-wider">ניהול הקהילה</h4>
              
              {isAdmin ? (
                <div className="flex gap-2">
                  <input type="text" value={newBuildingName} onChange={(e) => setNewBuildingName(e.target.value)} className="flex-1 min-w-0 bg-[#F8FAFC] border border-slate-100 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] transition text-slate-800 font-bold" placeholder="שם הבניין" />
                  <button onClick={updateBuildingName} disabled={isUpdating || newBuildingName === building.name} className="shrink-0 bg-[#1D4ED8] text-white px-5 py-3.5 rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50 shadow-sm">
                    {isUpdating ? 'שומר...' : 'עדכן'}
                  </button>
                </div>
              ) : (
                <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 font-black text-slate-800 text-center">
                  {building.name}
                </div>
              )}

              {/* קוד הזמנה - מוצג רק לוועד */}
              {isAdmin && inviteCode && (
                <div className="mt-5 pt-5 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">קוד הצטרפות</p>
                      <p className="text-xl font-black font-mono text-[#1D4ED8] tracking-widest">{inviteCode}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={copyBuildingCode} className="px-3 h-11 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs font-bold active:scale-95 transition flex items-center justify-center">
                        העתקה
                      </button>
                      <button onClick={inviteNeighbors} className="w-11 h-11 bg-[#25D366] text-white rounded-xl shadow-md active:scale-95 transition flex items-center justify-center">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

          {/* שכנים ממתינים לאישור */}
          {isAdmin && pendingNeighbors.length > 0 && (
            <section className="bg-white border border-[#E3F2FD] rounded-[2rem] p-5 shadow-sm">
              <h4 className="text-[11px] font-black text-orange-500 uppercase pr-1 tracking-wider mb-4 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span></span>
                ממתינים לאישור ({pendingNeighbors.length})
              </h4>
              <div className="flex flex-col gap-3">
                {pendingNeighbors.map((n) => (
                  <div key={n.id} className="flex items-center justify-between bg-[#F8FAFC] p-3 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-10 h-10 rounded-[12px] border border-white shadow-sm" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{n.full_name}</p>
                        <p className="text-[10px] font-medium text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => rejectNeighbor(n.id)} className="w-9 h-9 rounded-xl bg-white border border-red-100 text-red-500 flex items-center justify-center shadow-sm active:scale-95 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                      <button onClick={() => approveNeighbor(n.id)} className="w-9 h-9 rounded-xl bg-[#25D366] text-white shadow-md flex items-center justify-center active:scale-95 transition">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* שכנים מאושרים בבניין */}
          <section className="bg-white border border-[#E3F2FD] rounded-[2rem] p-5 shadow-sm">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-4 pr-1">דיירי הבניין ({approvedNeighbors.length})</h4>
            <div className="flex flex-col gap-3">
              {approvedNeighbors.length === 0 ? (
                <div className="text-center text-slate-400 text-xs font-medium py-4">אין דיירים נוספים בבניין.</div>
              ) : (
                approvedNeighbors.map((n) => (
                  <div key={n.id} className="flex items-center justify-between bg-white border border-slate-100 p-3 rounded-2xl shadow-sm hover:shadow-md transition">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-10 h-10 rounded-[12px] border border-[#E3F2FD] shrink-0" />
                      <div className="truncate">
                        <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
                          <span className="truncate">{n.full_name}</span>
                          {n.role === 'admin' && <span className="text-[9px] bg-[#E3F2FD] text-[#1D4ED8] px-1.5 py-0.5 rounded-md shrink-0">ועד</span>}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                      </div>
                    </div>
                    
                    {/* הרשאות ואייקוני קשר לדיירים (מוצג לוועד או לדייר עצמו) */}
                    <div className="flex gap-1.5 shrink-0 pl-1">
                      {isAdmin && n.id !== profile.id && (
                        <button onClick={() => toggleRole(n.id, n.role)} className={`text-[10px] font-black px-2.5 h-8 rounded-lg transition active:scale-95 flex items-center justify-center ${n.role === 'admin' ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-500 hover:bg-[#E3F2FD] hover:text-[#1D4ED8]'}`}>
                          {n.role === 'admin' ? 'הסר ועד' : 'מינוי'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* כפתור התנתקות מבניין - זמין לכולם */}
          <button onClick={handleLeaveBuilding} className="w-full bg-white border border-slate-200 text-slate-500 hover:text-red-500 hover:border-red-100 hover:bg-red-50 text-sm font-bold py-3.5 rounded-[1.2rem] active:scale-95 transition shadow-sm flex items-center justify-center gap-2 mt-4">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            התנתקות ועזיבת הבניין
          </button>

        </div>
      )}

      {/* תפריט שינוי תמונת פרופיל */}
      {isAvatarMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[2.5rem] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            <div className="flex justify-between items-center mb-6 px-1">
              <h3 className="font-black text-xl text-slate-800">תמונת פרופיל</h3>
              <button onClick={() => setIsAvatarMenuOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-500 hover:bg-slate-100 transition active:scale-95 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="bg-[#F8FAFC] p-5 rounded-[2rem] border border-[#E3F2FD]">
                <div className="grid grid-cols-4 gap-3">
                  {animalAvatars.map((avatar, idx) => (
                    <button key={idx} onClick={() => updateAvatarInDB(avatar)} className="aspect-square rounded-[1.2rem] bg-white border border-transparent hover:border-[#1D4ED8] transition active:scale-90 overflow-hidden flex items-center justify-center p-2 shadow-sm">
                      <img src={avatar} className="w-full h-full object-contain drop-shadow-sm" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3 mt-2">
                <button onClick={() => avatarInputRef.current?.click()} className="flex-[2] flex items-center justify-center gap-2 bg-[#E3F2FD] text-[#1D4ED8] py-4 rounded-[1.2rem] font-bold active:scale-95 transition shadow-sm text-sm border border-[#BFDBFE]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  מהגלריה
                </button>
                <button onClick={resetToInitials} className="flex-[1] flex items-center justify-center gap-2 bg-slate-50 text-slate-500 border border-slate-200 py-4 rounded-[1.2rem] font-bold active:scale-95 transition shadow-sm text-sm">
                  <span className="font-serif font-black text-lg leading-none -mt-1">א</span>
                  איפוס
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
