'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

// קולקציית האווטארים החדשה והמשודרגת - מפורטים, יפים ומתאימים לשני המינים
const predefinedAvatars = [
  'https://api.dicebear.com/8.x/adventurer/svg?seed=NeighborFemale1&backgroundColor=eef2ff', // שכנה 1
  'https://api.dicebear.com/8.x/adventurer/svg?seed=NeighborMale1&backgroundColor=eef2ff',   // שכן 1
  'https://api.dicebear.com/8.x/adventurer/svg?seed=NeighborFemale2&backgroundColor=eef2ff', // שכנה 2
  'https://api.dicebear.com/8.x/adventurer/svg?seed=NeighborMale2&backgroundColor=eef2ff'    // שכן 2
]

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [neighbors, setNeighbors] = useState<any[]>([])
  
  const [newBuildingName, setNewBuildingName] = useState('')
  const [apartment, setApartment] = useState('')
  const [floor, setFloor] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false)
  
  const router = useRouter()
  const avatarInputRef = useRef<HTMLInputElement>(null)

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

    const channel = supabase.channel('profile_realtime_v7')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buildings' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    
    setIsUpdating(true);
    setIsAvatarMenuOpen(false);
    
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${profile.id}_${Date.now()}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage
      .from('chat_uploads')
      .upload(filePath, file);
      
    if (!uploadError) {
      const { data } = supabase.storage.from('chat_uploads').getPublicUrl(filePath);
      await updateAvatarInDB(data.publicUrl);
    } else {
      alert("שגיאה בהעלאת התמונה: " + uploadError.message);
      setIsUpdating(false);
    }
  }

  const updateAvatarInDB = async (url: string) => {
    setIsUpdating(true);
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id);
    fetchData();
    setIsUpdating(false);
    setIsAvatarMenuOpen(false);
  }

  const resetToInitials = () => {
    updateAvatarInDB(`https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`);
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
    alert("הפרטים המזהים עודכנו")
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
            
            <input type="file" ref={avatarInputRef} accept="image/*" className="hidden" onChange={handleAvatarUpload} />

            <div onClick={() => setIsAvatarMenuOpen(true)} className="relative w-24 h-24 shrink-0 cursor-pointer group block">
               <div className="w-full h-full rounded-full border-4 border-white bg-brand-blue/5 shadow-md overflow-hidden relative">
                 <img 
                   src={profile.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${profile.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} 
                   className="w-full h-full object-cover" 
                 />
                 {isUpdating && (
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                     <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   </div>
                 )}
               </div>
               
               <div className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.15)] border border-gray-100 text-brand-blue group-active:scale-90 transition z-20">
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
               </div>
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-black text-brand-dark leading-tight">{profile.full_name}</h3>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg mt-1 inline-block ${isAdmin ? 'bg-brand-blue/10 text-brand-blue' : 'bg-gray-100 text-brand-dark'}`}>
                {isAdmin ? 'מנהל קהילה / ועד בית' : 'דייר בבניין'}
              </span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col gap-3 shadow-inner">
             <div className="flex gap-3">
                <div className="flex-1">
                   <label className="text-[10px] font-bold text-brand-gray mb-1 block">מספר דירה</label>
                   <input type="text" value={apartment} onChange={e => setApartment(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue text-brand-dark shadow-sm" placeholder="12" />
                </div>
                <div className="flex-1">
                   <label className="text-[10px] font-bold text-brand-gray mb-1 block">קומה</label>
                   <input type="text" value={floor} onChange={e => setFloor(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-blue text-brand-dark shadow-sm" placeholder="3" />
                </div>
             </div>
             <button onClick={updatePersonalDetails} className="w-full bg-brand-dark text-white text-xs font-bold py-3 rounded-xl hover:bg-gray-800 active:scale-95 transition shadow-sm">
               עדכן פרטים מזהים בבניין
             </button>
          </div>
        </div>
      </div>

      {isAdmin && building && (
        <div className="px-4 space-y-8">
          <div className="flex items-center justify-between">
             <h4 className="text-sm font-black text-brand-dark uppercase pr-1 tracking-wider">כלי ניהול קהילה</h4>
             <button onClick={inviteNeighbors} className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-xl hover:bg-[#25D366]/20 transition active:scale-95">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                הזמן שכנים לוואטסאפ
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
                      src={n.avatar_url || `https://api.dicebear.com/8.x/initials/svg?seed=${n.full_name}&backgroundColor=eef2ff&textColor=1e3a8a`} 
                      className="w-11 h-11 rounded-full border border-gray-100 object-cover shrink-0"
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
                      className={`text-[10px] font-black px-3.5 py-2 rounded-xl transition active:scale-95 shadow-sm whitespace-nowrap shrink-0 ml-1 ${
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

      <div className="px-4 mt-12 mb-6">
        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-gray-100 text-gray-500 font-bold py-4 rounded-2xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition active:scale-95 shadow-sm"
        >
          התנתק מהמערכת
        </button>
      </div>

      {/* מודל בחירת תמונת פרופיל */}
      {isAvatarMenuOpen && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-center items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-8 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-black text-lg text-brand-dark">תמונת פרופיל</h3>
              <button onClick={() => setIsAvatarMenuOpen(false)} className="p-2 bg-gray-100 rounded-full text-brand-dark hover:bg-gray-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="flex flex-col gap-4">
              
              {/* אזור הדמויות השכונתיות - עבר למעלה */}
              <div className="border border-gray-100 bg-gray-50 p-4 rounded-2xl shadow-inner">
                <p className="text-[11px] font-bold text-brand-gray mb-3.5 text-center tracking-wide uppercase">בחר דמות שכונתית בעיצוב נקי</p>
                <div className="grid grid-cols-4 gap-3">
                  {predefinedAvatars.map((avatar, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => updateAvatarInDB(avatar)} 
                      className="aspect-square rounded-2xl bg-white border border-gray-200 hover:border-brand-blue/50 hover:shadow-md transition active:scale-90 overflow-hidden flex items-center justify-center shadow-sm"
                    >
                       <img src={avatar} className="w-14 h-14 object-contain p-0.5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* בחירה מהגלריה - עבר למטה */}
              <button onClick={() => avatarInputRef.current?.click()} className="w-full flex items-center justify-center gap-2.5 bg-brand-blue text-white py-4 rounded-2xl font-bold shadow-sm active:scale-95 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                בחר תמונה מהמכשיר שלך
              </button>

              <button onClick={resetToInitials} className="w-full flex items-center justify-center gap-2 bg-gray-50 text-brand-dark border border-gray-200 py-3.5 rounded-2xl font-bold mt-1 hover:bg-gray-100 active:scale-95 transition shadow-sm">
                <span className="font-serif font-black text-lg leading-none -mt-0.5">א</span>
                אפס לראשי תיבות רשמיים
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
