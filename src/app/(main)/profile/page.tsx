'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../lib/supabase'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [fullName, setFullName] = useState('')
  const [apartment, setApartment] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        if (data) {
          setFullName(data.full_name || '')
          setApartment(data.apartment || '')
        }
      }
      setLoading(false)
    }
    getProfile()
  }, [])

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      apartment,
      avatar_url: `https://api.dicebear.com/7.x/notionists/svg?seed=${fullName}&backgroundColor=e2e8f0`
    })
    
    if (error) alert(error.message)
    else alert('הפרופיל עודכן בהצלחה!')
    setLoading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="glass-panel p-6 rounded-3xl mt-4">
      <h2 className="text-xl font-bold text-brand-dark mb-6 text-center">הפרופיל שלי</h2>
      
      <form onSubmit={updateProfile} className="space-y-4 text-right" dir="rtl">
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1 mr-2">שם מלא</label>
          <input 
            type="text" 
            className="w-full p-4 rounded-2xl bg-white/60 border border-white focus:border-brand-blue outline-none transition"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-brand-dark mb-1 mr-2">מספר דירה</label>
          <input 
            type="text" 
            className="w-full p-4 rounded-2xl bg-white/60 border border-white focus:border-brand-blue outline-none transition"
            value={apartment}
            onChange={(e) => setApartment(e.target.value)}
            required
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
        >
          {loading ? 'שומר...' : 'שמור שינויים'}
        </button>
      </form>

      <button onClick={handleLogout} className="w-full mt-4 text-red-500 font-bold py-4 rounded-2xl bg-white/50 border border-red-100 hover:bg-red-50 transition">
        התנתק
      </button>
    </div>
  )
}
