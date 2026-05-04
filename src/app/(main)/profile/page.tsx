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
    const channel = supabase.channel('profile_realtime_v18')
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
        alert(`בקשת הצטרפות לבניין "${bldData.name}" נשלחה לוועד לאישור.`)

        const { data: adminProf } = await supabase.from('profiles').select('id').eq('building_id', bldData.id).eq('role', 'admin').single()
        if (adminProf) {
          await supabase.from('notifications').insert([{ receiver_id: adminProf.id, sender_id: profile.id, type: 'system', title: 'בקשת הצטרפות חדשה', content: `${profile.full_name} מבקש/ת להצטרף לבניין. المתן לאישור בעמוד הפרופיל.`, link: '/profile' }])
        }
        fetchData()
      } else {
        alert("קוד הבניין שגוי או שהבניין אינו קיים במערכת.")
      }
    } finally {
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
    return <div className="flex flex-col flex-1 w-full items-center justify-center pb-32"><div className="w-10 h-10 border-4 border-slate-200 border-t-[#1D4ED8] rounded-full animate-spin"></div><p className="mt-4 font-bold text-[#1D4ED8]">טוען נתונים...</p></div>
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin'
  const isPending = profile.approval_status === 'pending'
  const inviteCode = building?.invite_code

  const pendingNeighbors = neighbors.filter(n => n.approval_status === 'pending')
  const approvedNeighbors = neighbors.filter(n => n.approval_status === 'approved')

  return (
    <div className="flex flex-col flex-1 w-full pb-32" dir="rtl">
      
      {/* הדר מקורי נקי עם כפתור הגדרות */}
      <div className="px-4 mb-6 mt-2 flex justify-between items-center">
        <h2 className="text-2xl font-black text-slate-800">הפרופיל שלי</h2>
        <Link href="/settings" className="p-2 bg-white rounded-full border border-slate-200 shadow-sm text-slate-400 hover:text-[#1D4ED8] transition active:scale-95">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        </Link>
      </div>

      {/* אזור פרטים אישיים - בדיוק כמו במקור, רק עם הצבעים החדשים */}
      <div className="px-4 mb-8">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            
            <div onClick={() => setIsAvatarMenuOpen(true)} className="relative w-24 h-24 shrink-0 cursor-pointer group block">
              <div className="w-full h-full rounded-full border-4 border-white bg-[#E3F2FD] shadow-sm overflow-hidden relative flex items-center justify-center">
                <img src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-full h-full object-cover" />
                {isUpdating && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-[#1D4ED8] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] border border-slate-100 text-[#1D4ED8] group-active:scale-90 transition z-20">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </div>
            </div>

            <div className="flex-1">
              <input
                type="text"
                value={profile.full_name}
                onChange={(e) => setProfile({...profile, full_name: e.target.value})}
                className="text-xl font-black text-slate-800 leading-tight bg-transparent outline-none w-full border-b border-dashed border-slate-200 focus:border-[#1D4ED8]"
                placeholder="שם מלא"
              />
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg mt-2 inline-block ${!building ? 'bg-orange-50 text-orange-600' : isPending ? 'bg-yellow-50 text-yellow-600' : isAdmin ? 'bg-[#E3F2FD] text-[#1D4ED8]' : 'bg-slate-100 text-slate-600'}`}>
                {!building ? 'ללא בניין' : isPending ? 'ממתין לאישור ועד' : isAdmin ? 'מנהל קהילה / ועד בית' : 'דייר מאושר'}
              </span>
            </div>
          </div>

          <div className="bg-[#F8FAFC] p-4 rounded-2xl border border-slate-100 flex flex-col gap-4 shadow-inner">
            <div className="flex flex-col gap-3">
              <div className="w-full">
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">מספר דירה</label>
                <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1D4ED8] text-slate-800 shadow-sm" placeholder="מספר דירה" />
              </div>
              <div className="w-full">
                <label className="text-[10px] font-bold text-slate-400 mb-1 block">קומה</label>
                <input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#1D4ED8] text-slate-800 shadow-sm" placeholder="מספר קומה" />
              </div>
            </div>
            <button onClick={updatePersonalDetails} disabled={isUpdating} className="w-full bg-[#1D4ED8] text-white text-xs font-bold py-3.5 rounded-xl hover:bg-blue-700 active:scale-95 transition shadow-sm disabled:opacity-50">
              {isUpdating ? 'שומר נתונים...' : 'עדכון פרטים מזהים'}
            </button>
          </div>
        </div>
      </div>

      {/* ממתין לאישור (מקורי) */}
      {isPending && building && (
        <div className="px-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-6 shadow-sm text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-yellow-500">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">ממתין לאישור הנהלת הבניין</h3>
            <p className="text-sm text-slate-600 mb-0">
              בקשתך להצטרף לקהילת <strong>{building.name}</strong> נשלחה למנהל הוועד. הגישה תפתח מיד עם אישורו.
            </p>
          </div>
        </div>
      )}

      {/* הצטרפות לבניין קיים או יצירת חדש (המבנה המקורי בצבעים הנקיים) */}
      {!building && !isPending && (
        <div className="px-4 space-y-4 mb-8">
          <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <h3 className="text-lg font-black text-slate-800 mb-2">הצטרפות לקהילה קיימת</h3>
            <p className="text-sm text-slate-500 mb-4">קיבלת קוד מזהה מהוועד? הזן אותו כאן כדי לבקש הצטרפות.</p>
            <div className="flex flex-col gap-3">
              <input
                type="text"
                value={joinBuildingCode}
                onChange={(e) => setJoinBuildingCode(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-[#1D4ED8] text-slate-800 text-center tracking-widest font-mono font-bold uppercase"
                placeholder="הכנס קוד (לדוג': B-X7K9)"
                dir="ltr"
              />
              <button
                onClick={handleJoinBuilding}
                disabled={isUpdating || !joinBuildingCode.trim()}
                className="w-full bg-[#1D4ED8] text-white px-5 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50"
              >
                {isUpdating ? 'מחפש...' : 'שלח בקשת הצטרפות לוועד'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 py-2 opacity-50">
            <div className="h-px bg-slate-300 flex-1"></div>
            <span className="text-xs font-bold text-slate-400">או פתיחת קהילה חדשה</span>
            <div className="h-px bg-slate-300 flex-1"></div>
          </div>

          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-6 shadow-xl relative overflow-hidden text-white">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -ml-10 -mt-10 pointer-events-none"></div>
            <h3 className="text-lg font-black mb-2 relative z-10">הקמת בניין חדש</h3>
            <p className="text-sm text-slate-400 mb-4 relative z-10">אתה ועד הבית? פתח קהילה חדשה ונהל את אישורי השכנים והתשלומים.</p>
            <div className="flex flex-col gap-3 relative z-10">
              <input
                type="text"
                value={createBuildingName}
                onChange={(e) => setCreateBuildingName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-white text-white placeholder-slate-400"
                placeholder="שם הבניין (לדוג׳: מגדלי אלון 8)"
              />
              <button
                onClick={handleCreateBuilding}
                disabled={isUpdating || !createBuildingName.trim()}
                className="w-full bg-[#E3F2FD] text-[#1D4ED8] px-5 py-3.5 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50"
              >
                {isUpdating ? 'מקים קהילה...' : 'הקם קהילה והפוך למנהל'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* פרטי הקהילה לוועד (המבנה המקורי, כפתור מסודר) */}
      {building && !isPending && (
        <div className="px-4 space-y-6">
          <section className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-black text-slate-800">פרטי הקהילה</h4>
            </div>

            {isAdmin ? (
              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={newBuildingName}
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  className="flex-1 w-full min-w-0 bg-[#F8FAFC] border border-slate-100 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#1D4ED8] transition text-slate-800 font-bold"
                />
                <button
                  onClick={updateBuildingName}
                  disabled={isUpdating || newBuildingName === building.name}
                  className="shrink-0 bg-[#E3F2FD] text-[#1D4ED8] px-5 py-3 rounded-xl text-xs font-bold active:scale-95 transition disabled:opacity-50"
                >
                  {isUpdating ? 'שומר...' : 'עדכן'}
                </button>
              </div>
            ) : (
              <div className="bg-[#F8FAFC] p-4 rounded-xl border border-slate-100 text-center font-bold text-slate-800">
                {building.name}
              </div>
            )}

            {/* הצגת הקוד אך ורק לוועד */}
            {isAdmin && (
              <div className="mt-5 pt-5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">קוד הצטרפות לבניין</p>
                  <p className="text-lg font-black font-mono text-[#1D4ED8] tracking-widest">{inviteCode}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button onClick={copyBuildingCode} className="text-xs font-bold text-[#1D4ED8] bg-[#E3F2FD] px-3 h-10 rounded-xl active:scale-95 transition">
                    העתקה
                  </button>
                  {/* כפתור הווצאפ המקורי והמדויק מהתקלות */}
                  <button onClick={inviteNeighbors} className="w-10 h-10 rounded-xl bg-[#25D366] text-white shadow-md active:scale-95 transition flex items-center justify-center pointer-events-auto">
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* שכנים ממתינים לאישור */}
          {isAdmin && pendingNeighbors.length > 0 && (
            <section>
              <h4 className="text-sm font-black text-orange-500 uppercase pr-1 tracking-wider mb-3 flex items-center gap-2">
                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span></span>
                ממתינים לאישור ({pendingNeighbors.length})
              </h4>
              <div className="bg-orange-50 border border-orange-100 rounded-3xl overflow-hidden shadow-sm">
                {pendingNeighbors.map((n) => (
                  <div key={n.id} className="flex items-center justify-between p-4 border-b border-orange-100/50 last:border-0">
                    <div className="flex items-center gap-3">
                      <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-10 h-10 rounded-xl border border-white shadow-sm" />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{n.full_name}</p>
                        <p className="text-[10px] text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => rejectNeighbor(n.id)} className="w-8 h-8 rounded-full bg-white text-red-500 border border-red-100 flex items-center justify-center shadow-sm active:scale-95 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                      <button onClick={() => approveNeighbor(n.id)} className="w-8 h-8 rounded-full bg-[#25D366] text-white shadow-md flex items-center justify-center active:scale-95 transition">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* שכנים מאושרים בבניין */}
          {isAdmin && (
            <section>
              <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3 pr-1">ניהול הרשאות דיירים מאושרים ({approvedNeighbors.length})</h4>
              <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                {approvedNeighbors.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs font-medium">אין דיירים נוספים בבניין.</div>
                ) : (
                  approvedNeighbors.map((n) => (
                    <div key={n.id} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition">
                      <div className="flex items-center gap-3">
                        <img src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} className="w-10 h-10 rounded-xl border border-slate-100 shrink-0" />
                        <div>
                          <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                            {n.full_name} {n.role === 'admin' && <span className="text-[9px] bg-[#E3F2FD] text-[#1D4ED8] px-1.5 py-0.5 rounded-md">מנהל ועד</span>}
                          </p>
                          <p className="text-[10px] text-slate-500">דירה {n.apartment || '?'} | קומה {n.floor || '?'}</p>
                        </div>
                      </div>
                      {n.id !== profile.id && (
                        <button onClick={() => toggleRole(n.id, n.role)} className={`text-[10px] font-black px-3 py-2 rounded-xl transition active:scale-95 shadow-sm ${n.role === 'admin' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-[#E3F2FD] text-[#1D4ED8]'}`}>
                          {n.role === 'admin' ? 'הסרת סמכות' : 'מינוי לוועד'}
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {/* תפריט בחירת אווטאר */}
      {isAvatarMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-[40px] p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6 px-2">
              <h3 className="font-black text-xl text-slate-800">בחירת תמונת פרופיל</h3>
              <button onClick={() => setIsAvatarMenuOpen(false)} className="p-2 bg-slate-50 rounded-full text-slate-800 hover:bg-slate-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-5">
              <div className="bg-[#E3F2FD]/50 p-5 rounded-[32px] border border-[#E3F2FD]">
                <div className="grid grid-cols-4 gap-3">
                  {animalAvatars.map((avatar, idx) => (
                    <button key={idx} onClick={() => updateAvatarInDB(avatar)} className="aspect-square rounded-[20px] bg-white border-2 border-transparent hover:border-[#1D4ED8] hover:shadow-lg transition active:scale-90 overflow-hidden flex items-center justify-center p-1.5 shadow-sm">
                      <img src={avatar} className="w-full h-full object-contain drop-shadow-sm" />
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="flex flex-col gap-3 mt-2">
                <button onClick={() => avatarInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-white text-[#1D4ED8] border-2 border-[#1D4ED8]/20 py-4 rounded-[20px] font-bold hover:bg-[#E3F2FD]/50 active:scale-95 transition shadow-sm">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  בחירה מגלריית התמונות
                </button>
                <button onClick={resetToInitials} className="w-full flex items-center justify-center gap-2 bg-slate-50 text-slate-800 border border-slate-200 py-4 rounded-[20px] font-bold hover:bg-slate-100 active:scale-95 transition shadow-sm">
                  <span className="font-serif font-black text-lg leading-none -mt-1">א</span>
                  איפוס לראשי תיבות
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
