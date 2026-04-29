'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('אנא הזן אימייל וסיסמה')
    
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
    else window.location.href = '/'
    setLoading(false)
  }

  const handleSignUp = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!email || !password) return alert('אנא הזן אימייל וסיסמה כדי להירשם')

    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      alert(error.message)
    } else {
      window.location.href = '/'
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md glass-panel p-8 rounded-[2.5rem] text-center shadow-sm">
        <h1 className="text-3xl font-black text-brand-blue mb-2">שכן<span className="text-2xl">+</span></h1>
        <p className="text-brand-gray mb-8 font-medium">הצטרפו לקהילת הבניין שלכם</p>
        
        <form onSubmit={handleLogin} className="space-y-4 text-right" dir="rtl">
          <div>
            <label className="block text-xs font-bold text-brand-dark mb-1 mr-2">אימייל</label>
            <input 
              type="email" 
              className="w-full p-4 rounded-2xl bg-white/50 border border-white focus:border-brand-blue outline-none transition text-left"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-brand-dark mb-1 mr-2">סיסמה (מינימום 6 תווים)</label>
            <input 
              type="password" 
              className="w-full p-4 rounded-2xl bg-white/50 border border-white focus:border-brand-blue outline-none transition text-left"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'טוען...' : 'התחברות'}
          </button>
        </form>

        <button 
          onClick={handleSignUp}
          disabled={loading}
          className="mt-6 text-sm text-brand-blue font-bold hover:underline disabled:opacity-50"
        >
          עוד לא רשומים? צרו חשבון חדש
        </button>
      </div>
    </main>
  )
}
