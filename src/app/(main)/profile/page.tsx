'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [neighbors, setNeighbors] = useState<any[]>([])
  
  // States for updates
  const [newBuildingName, setNewBuildingName] = useState('')
  const [apartment, setApartment] = useState('')
  const [floor, setFloor] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // משיכת הפרופיל שלי
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      setApartment(prof.apartment || '')
      setFloor(prof.floor || '')
      
      // משיכת פרטי הבניין
      if (prof.building_id) {
        const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
        if (bld) {
          setBuilding(bld)
          setNewBuildingName(bld.name)
        }

        // משיכת כל השכנים בבניין
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

    const channel = supabase.channel('profile_realtime_v2')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'buildings' }, fetchData)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // עדכון שם הבניין (רק למנהל)
  const updateBuildingName = async () => {
    if (!building || !newBuildingName.trim()) return
    setIsUpdating(true)
    const { error } = await supabase.from('buildings').update({ name: newBuildingName }).eq('id', building.id)
    if (!error) {
      setBuilding({ ...building, name: newBuildingName })
    }
    setIsUpdating(false)
  }

  // עדכון פרטים אישיים (דירה וקומה)
  const updatePersonalDetails = async () => {
    if (!profile) return
    setIsUpdating(true)
    await supabase.from('profiles').update({ apartment, floor }).eq('id', profile.id)
    alert("הפרטים עודכנו בהצלחה!")
    setIsUpdating(false)
  }

  // הפיכת שכן למנהל או לדייר רגיל (רק המנהל יכול)
  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'tenant' : 'admin'
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    fetchData()
  }

  // כפתור קסם לבדיקות: הופך אותך למנהל מידית אם אתה לא
  const makeMeAdmin = async () => {
    if (!profile) return
    await supabase.from('profiles').update({ role: 'admin' }).eq('id', profile.id)
    fetchData()
  }

  // שיתוף בוואטסאפ - הזמנת שכנים
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
      
      {/* כותרת נקייה */}
      <div className="px-4 mb-6 mt-2 flex justify-between items-center">
        <h2 className="text-2xl font-black text-brand-dark">פרופיל</h2>
        
        {/* כפתור קסם לבדיקות: אם אתה לא מנהל, יופיע כפתור שהופך אותך לאחד */}
        {!isAdmin && (
          <button onClick={makeMeAdmin} className="text-[10px] bg-red-50 text-red-500 font-bold px-3 py-1.5 rounded-lg active:scale-95 transition">
            קח סמכויות ניהול (לביקורת)
          </button>
        )}
      </div>

      {/* כרטיס משתמש אישי + פרטי דירה */}
      <div className="px-4 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center border-2 border-brand-blue/20 shadow-sm overflow-hidden shrink-0">
              <img 
                src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
                className="w-full h-full object-cover p-1" 
              />
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

      {/* אזור ניהול - מוצג אך ורק למנהלים */}
      {isAdmin && building && (
        <div className="px-4 space-y-8">
          
          <div className="flex items-center justify-between">
             <h4 className="text-sm font-black text-brand-dark uppercase pr-1">כלי ניהול קהילה</h4>
             <button onClick={inviteNeighbors} className="flex items-center gap-1.5 text-xs font-bold text-[#25D366] bg-[#25D366]/10 px-3 py-1.5 rounded-xl hover:bg-[#25D366]/20 transition active:scale-95">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                הזמן שכנים
             </button>
          </div>
          
          {/* שינוי שם הבניין הקבוצתי */}
          <section className="bg-brand-blue/5 border border-brand-blue/10 rounded-3xl p-5 shadow-sm">
            <label className="text-xs font-bold text-brand-dark mb-2 block">שם הקבוצה / הבניין שיוצג לכולם</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                value={newBuildingName} 
                onChange={(e) => setNewBuildingName(e.target.value)}
                className="flex-1 bg-white border border-brand-blue/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition shadow-sm text-brand-dark"
                placeholder="לדוג׳: בניין אלון 8"
              />
              <button 
                onClick={updateBuildingName}
                disabled={isUpdating || newBuildingName === building.name}
                className="bg-brand-blue text-white px-5 py-3 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50 shadow-[0_4px_15px_rgba(0,68,204,0.2)]"
              >
                {isUpdating ? 'מעדכן...' : 'עדכן שם'}
              </button>
            </div>
          </section>

          {/* ניהול הרשאות ושכנים */}
          <section>
            <h4 className="text-[11px] font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">שכנים בבניין וניהול הרשאות</h4>
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              {neighbors.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3">
                    <img 
                      src={n.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${n.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
                      className="w-10 h-10 rounded-full border border-gray-200 p-0.5"
                    />
                    <div>
                      <p className="text-sm font-bold text-brand-dark leading-tight flex items-center gap-1">
                        {n.full_name}
                        {n.role === 'admin' && <svg className="w-3.5 h-3.5 text-brand-blue" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 2a1 1 0 011 1v1.323l3.954 1.582 1.599-.8a1 1 0 01.894 1.79l-1.233.616 1.738 5.42a1 1 0 01-.285 1.05A3.989 3.989 0 0115 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.715-5.349L11 6.477V16h2a1 1 0 110 2H7a1 1 0 110-2h2V6.477L6.237 7.582l1.715 5.349a1 1 0 01-.285 1.05A3.989 3.989 0 015 15a3.989 3.989 0 01-2.667-1.019 1 1 0 01-.285-1.05l1.738-5.42-1.233-.617a1 1 0 01.894-1.788l1.599.799L9 4.323V3a1 1 0 011-1z" clipRule="evenodd"></path></svg>}
                      </p>
                      <p className="text-[10px] text-brand-gray font-medium mt-0.5">
                        {n.apartment ? `דירה ${n.apartment}` : 'דירה לא הוזנה'} {n.floor ? `| קומה ${n.floor}` : ''}
                      </p>
                    </div>
                  </div>
                  
                  {n.id !== profile.id && (
                    <button 
                      onClick={() => toggleRole(n.id, n.role)}
                      className={`text-[10px] font-black px-3 py-1.5 rounded-xl transition active:scale-95 shadow-sm ${
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

      {/* אזור התנתקות */}
      <div className="px-4 mt-12">
        <button 
          onClick={handleLogout}
          className="w-full bg-gray-50 border border-gray-200 text-brand-dark font-bold py-4 rounded-2xl hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition active:scale-95 shadow-sm"
        >
          התנתק מהמערכת
        </button>
      </div>

    </div>
  )
}
