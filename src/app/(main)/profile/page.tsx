'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

// 4 אווטרים מעוצבים בסגנון נקי שמתאים למערכת SaaS
const PRESET_AVATARS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Nala&backgroundColor=e0f2fe',  // כחול מותג בהיר
  'https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=dcfce7', // ירוק הצלחה
  'https://api.dicebear.com/7.x/notionists/svg?seed=Aneka&backgroundColor=fef08a', // צהוב מודרני
  'https://api.dicebear.com/7.x/notionists/svg?seed=Leo&backgroundColor=ffedd5'    // כתום חם
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [neighbors, setNeighbors] = useState<any[]>([])
  
  const [newBuildingName, setNewBuildingName] = useState('')
  const [apartment, setApartment] = useState('')
  const [floor, setFloor] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  
  // ניהול תמונת פרופיל
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const router = useRouter()

  const fetchData = async () => {
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
          setBuilding(bld)
          setNewBuildingName(bld.name)
        }

        const { data: nbs } = await supabase.from('profiles')
          .select('*')
          .eq('building_id', prof.building_id)
          .order('full_name')
        if (nbs) setNeighbors(nbs)
      }
    }
  }

  useEffect(() => {
    fetchData()

    const channel = supabase.channel('profile_realtime_v6')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buildings' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // פונקציה לעדכון תמונת פרופיל (מאווטר או מתמונה שהועלתה)
  const updateAvatar = async (url: string) => {
    if (!profile) return
    setIsUploadingAvatar(true)
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    if (!error) {
      setProfile({ ...profile, avatar_url: url })
      setIsAvatarModalOpen(false)
    } else {
      alert("שגיאה בעדכון התמונה: " + error.message)
    }
    setIsUploadingAvatar(false)
  }

  // העלאת תמונה אישית מהמכשיר
  const handleCustomAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return
    
    setIsUploadingAvatar(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `avatars/${profile.id}_${Date.now()}.${fileExt}`
    
    const { error: uploadError } = await supabase.storage.from('chat_uploads').upload(filePath, file)
    
    if (!uploadError) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath)
      await updateAvatar(data.publicUrl)
    } else {
      alert("שגיאה בהעלאת התמונה")
      setIsUploadingAvatar(false)
    }
  }

  const updateBuildingName = async () => {
    if (!building || !newBuildingName.trim()) return
    setIsUpdating(true)
    const { error } = await supabase.from('buildings').update({ name: newBuildingName }).eq('id', building.id)
    if (!error) {
      setBuilding({ ...building, name: newBuildingName })
    }
    setIsUpdating(false)
  }

  const updatePersonalDetails = async () => {
    if (!profile) return
    setIsUpdating(true)
    await supabase.from('profiles').update({ apartment, floor }).eq('id', profile.id)
    setIsUpdating(false)
  }

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'tenant' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    fetchData()
  }

  const makeMeAdmin = async () => {
    if (!profile) return
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', profile.id)
    fetchData()
  }

  const inviteNeighbors = () => {
    const text = encodeURIComponent(`היי שכנים! פתחתי לנו אפליקציה חדשה לניהול הבניין שלנו (${building?.name || ''}). להצטרפות חפשו "שכן+"!`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile) return null

  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex flex-col flex-1 w-full pb-32" dir="rtl">
      
      <div className="px-4 mb-6 mt-2 flex justify-between items-center">
        <h2 className="text-2xl font-black text-brand-dark">פרופיל</h2>
        {!isAdmin && (
          <button onClick={makeMeAdmin} className="text-[10px] bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-lg active:scale-95 transition">
            קח סמכויות ניהול (לביקורת)
          </button>
        )}
      </div>

      <div className="px-4 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-4">
            
            {/* אזור התמונה הלחיץ */}
            <div onClick={() => setIsAvatarModalOpen(true)} className="relative w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center border-2 border-brand-blue/20 shadow-sm overflow-hidden shrink-0 cursor-pointer active:scale-95 transition group">
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
                className="w-full h-full object-cover p-1" 
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              </div>
              <div className="absolute bottom-0 right-0 bg-brand-blue text-white p-1 rounded-full border border-white shadow-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-black text-brand-dark">{profile.full_name}</h3>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg mt-1 inline-block ${isAdmin ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-100 text-brand-dark'}`}>
                {isAdmin ? 'מנהל קהילה / ועד בית' : 'דייר בבניין'}
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-3">
             <div className="flex gap-3">
                <div className="flex-1">
                   <label className="text-[10px] font-bold text-brand-gray mb-1 block">מספר דירה</label>
                   <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue text-brand-dark" placeholder="לדוג׳: 12" />
                </div>
                <div className="flex-1">
                   <label className="text-[10px] font-bold text-brand-gray mb-1 block">קומה</label>
                   <input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue text-brand-dark" placeholder="לדוג׳: 3" />
                </div>
             </div>
             <button onClick={updatePersonalDetails} className="w-full bg-brand-dark text-white text-xs font-bold py-2.5 rounded-xl hover:bg-gray-800 active:scale-95 transition">
               עדכן פרטים מזהים בבניין
             </button>
          </div>
        </div>
      </div>

      {isAdmin && building && (
        <div className="px-4 space-y-8">
          
          <div className="flex items-center justify-between">
             <h4 className="text-sm font-black text-brand-dark uppercase pr-1">כלי ניהול קהילה</h4>
             <button onClick={inviteNeighbors} className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-xl hover:bg-[#25D366]/20 transition active:scale-95">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                הזמן שכנים
             </button>
          </div>
          
          <section className="bg-brand-blue/5 border border-brand-blue/10 rounded-3xl p-5 shadow-sm">
            <label className="text-xs font-bold text-brand-dark mb-2 block">שם הקבוצה / הבניין שיוצג לכולם</label>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                value={newBuildingName} 
                onChange={(e) => setNewBuildingName(e.target.value)}
                className="w-full bg-white border border-brand-blue/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark"
                placeholder="לדוג׳: בניין אלון 8"
              />
              <button 
                onClick={updateBuildingName}
                disabled={isUpdating || newBuildingName === building.name}
                className="w-full bg-brand-blue text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50 shadow-[0_4px_15px_rgba(0,68,204,0.2)]"
              >
                {isUpdating ? 'מעדכן...' : 'עדכן שם בניין'}
              </button>
            </div>
          </section>

          <section>
            <h4 className="text-[11px] font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">שכנים בבניין וניהול הרשאות</h4>
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              {neighbors.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <img 
                      src={n.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${n.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
                      className="w-10 h-10 rounded-full border border-gray-200 p-0.5 shrink-0 object-cover"
                    />
                    <div>
                      <p className="text-sm font-bold text-brand-dark leading-tight flex items-center gap-1.5 flex-wrap">
                        {n.full_name}
                        {n.role === 'admin' && (
                          <span className="text-[9px] bg-brand-blue/10 text-brand-blue px-1.5 py-0.5 rounded-md whitespace-nowrap">מנהל ועד</span>
                        )}
                      </p>
                      <p className="text-[10px] text-brand-gray font-medium mt-0.5">
                        {n.apartment ? `דירה ${n.apartment}` : 'דירה לא הוזנה'} {n.floor ? `| קומה ${n.floor}` : ''}
                      </p>
                    </div>
                  </div>
                  
                  {n.id !== profile.id && (
                    <button 
                      onClick={() => toggleRole(n.id, n.role)}
                      className={`text-[10px] font-black px-3 py-2 rounded-xl transition active:scale-95 shadow-sm whitespace-nowrap shrink-0 ml-1 ${
                        n.role === 'admin' 
                        ? 'bg-red-50 text-red-500 hover:bg-red-100 border border-red-100' 
                        : 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20 border border-brand-blue/20'
                      }`}
                    >
                      {n.role === 'admin' ? 'הסר מוועד' : 'מנה לוועד'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="px-4 mt-12">
        <button 
          onClick={handleLogout}
          className="w-full bg-gray-50 border border-gray-200 text-brand-dark font-bold py-4 rounded-2xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition active:scale-95 shadow-sm"
        >
          התנתק מהמערכת
        </button>
      </div>

      {/* מודל החלפת תמונת פרופיל */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg text-brand-dark">תמונת פרופיל</h3>
              <button onClick={() => setIsAvatarModalOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-6">
              {/* העלאת תמונה אישית */}
              <div>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleCustomAvatarUpload} />
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploadingAvatar}
                  className="w-full bg-brand-blue/5 border border-brand-blue/20 text-brand-blue font-bold py-4 rounded-2xl hover:bg-brand-blue/10 active:scale-95 transition flex items-center justify-center gap-2"
                >
                  {isUploadingAvatar ? (
                     <span className="animate-pulse">מעלה תמונה...</span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                      העלה תמונה מהמכשיר
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-px bg-gray-100 flex-1"></div>
                <span className="text-xs font-bold text-brand-gray">או בחר אווטר</span>
                <div className="h-px bg-gray-100 flex-1"></div>
              </div>

              {/* גלריית אווטרים מובנים */}
              <div className="grid grid-cols-4 gap-3">
                {PRESET_AVATARS.map((avatarUrl, index) => (
                  <button 
                    key={index} 
                    disabled={isUploadingAvatar}
                    onClick={() => updateAvatar(avatarUrl)}
                    className="w-full aspect-square rounded-2xl bg-gray-50 border-2 border-transparent hover:border-brand-blue/30 active:scale-90 transition p-1 overflow-hidden"
                  >
                    <img src={avatarUrl} className="w-full h-full object-cover rounded-xl" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
