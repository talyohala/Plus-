'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [building, setBuilding] = useState<any>(null)
  const [neighbors, setNeighbors] = useState<any[]>([])
  const [newBuildingName, setNewBuildingName] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const router = useRouter()

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. משיכת הפרופיל שלי
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (prof) {
      setProfile(prof)
      
      // 2. משיכת פרטי הבניין
      if (prof.building_id) {
        const { data: bld } = await supabase.from('buildings').select('*').eq('id', prof.building_id).single()
        if (bld) {
          setBuilding(bld)
          setNewBuildingName(bld.name)
        }

        // 3. משיכת כל השכנים בבניין (רק אם אני מנהל)
        if (prof.role === 'admin') {
          const { data: nbs } = await supabase.from('profiles')
            .select('*')
            .eq('building_id', prof.building_id)
            .order('full_name')
          if (nbs) setNeighbors(nbs)
        }
      }
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateBuildingName = async () => {
    if (!building || !newBuildingName.trim()) return
    setIsUpdating(true)
    const { error } = await supabase.from('buildings').update({ name: newBuildingName }).eq('id', building.id)
    if (!error) {
      setBuilding({ ...building, name: newBuildingName })
      alert("שם הבניין עודכן בהצלחה!")
    }
    setIsUpdating(false)
  }

  const toggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'tenant' : 'admin'
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (!error) {
      setNeighbors(prev => prev.map(n => n.id === userId ? { ...n, role: newRole } : n))
      if (userId === profile.id) {
        setProfile({ ...profile, role: newRole })
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile) return null

  return (
    <div className="flex flex-col flex-1 w-full pb-24" dir="rtl">
      
      {/* כותרת נקייה */}
      <div className="px-4 mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">פרופיל</h2>
      </div>

      {/* כרטיס משתמש */}
      <div className="px-4 mb-8">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-brand-blue/10 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden">
            <img 
              src={profile.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${profile.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
              className="w-full h-full object-cover p-2" 
            />
          </div>
          <div>
            <h3 className="text-xl font-black text-brand-dark">{profile.full_name}</h3>
            <p className="text-sm font-bold text-brand-blue">{profile.role === 'admin' ? 'מנהל בניין / ועד' : 'דייר בבניין'}</p>
          </div>
        </div>
      </div>

      {/* הגדרות ניהול (רק למנהל) */}
      {profile.role === 'admin' && (
        <div className="px-4 space-y-8">
          
          {/* שינוי שם הבניין */}
          <section>
            <h4 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">הגדרות בניין</h4>
            <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-3xl p-5">
              <label className="text-xs font-bold text-brand-dark mb-2 block">שם הקבוצה / הבניין</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newBuildingName} 
                  onChange={(e) => setNewBuildingName(e.target.value)}
                  className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-blue transition"
                />
                <button 
                  onClick={updateBuildingName}
                  disabled={isUpdating}
                  className="bg-brand-blue text-white px-4 py-3 rounded-xl text-sm font-bold active:scale-95 transition disabled:opacity-50"
                >
                  {isUpdating ? 'שומר...' : 'שמור'}
                </button>
              </div>
            </div>
          </section>

          {/* ניהול שכנים */}
          <section>
            <h4 className="text-xs font-black text-brand-gray uppercase tracking-wider mb-3 pr-1">ניהול הרשאות שכנים</h4>
            <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
              {neighbors.map((n) => (
                <div key={n.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-3">
                    <img 
                      src={n.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${n.full_name}&backgroundColor=transparent&textColor=1e3a8a`} 
                      className="w-10 h-10 rounded-full bg-gray-50 p-1"
                    />
                    <div>
                      <p className="text-sm font-bold text-brand-dark">{n.full_name}</p>
                      <p className="text-[10px] text-brand-gray font-medium">{n.role === 'admin' ? 'מנהל' : 'דייר'}</p>
                    </div>
                  </div>
                  
                  {/* כפתור החלפת תפקיד */}
                  {n.id !== profile.id && (
                    <button 
                      onClick={() => toggleRole(n.id, n.role)}
                      className={`text-[10px] font-black px-3 py-1.5 rounded-lg transition active:scale-90 ${
                        n.role === 'admin' 
                        ? 'bg-red-50 text-red-500' 
                        : 'bg-brand-blue/10 text-brand-blue'
                      }`}
                    >
                      {n.role === 'admin' ? 'בטל ניהול' : 'מנה נוסף'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* יציאה */}
      <div className="px-4 mt-12">
        <button 
          onClick={handleLogout}
          className="w-full bg-gray-50 text-gray-400 font-bold py-4 rounded-2xl hover:bg-red-50 hover:text-red-500 transition active:scale-95"
        >
          התנתק מהמערכת
        </button>
      </div>

    </div>
  )
}
