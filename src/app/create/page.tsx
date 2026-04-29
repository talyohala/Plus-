'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function CreatePost() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [userName, setUserName] = useState('שכן')
  const router = useRouter()

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) {
        // לוקח את החלק שלפני ה-@ באימייל כשם זמני
        setUserName(user.email.split('@')[0])
      }
    }
    fetchUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setLoading(true)

    const { error } = await supabase
      .from('posts')
      .insert([{ author_name: userName, content: content.trim() }])

    if (error) {
      alert(error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh() // מרענן את שרת ה-Next.js כדי שהפוסט יופיע מיד בפיד
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 pt-10">
      <div className="w-full max-w-md glass-panel p-6 rounded-3xl relative">
        
        {/* כפתור חזור */}
        <Link href="/" className="absolute top-6 left-6 text-brand-gray hover:text-brand-blue transition">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
        </Link>

        <h1 className="text-xl font-bold text-brand-dark mb-6 text-center">פרסום חדש לבניין</h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            className="w-full p-4 rounded-2xl bg-white/60 border border-white focus:border-brand-blue outline-none transition resize-none text-brand-dark"
            rows={5}
            placeholder="מה תרצו לשתף עם השכנים?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            autoFocus
          ></textarea>
          
          <button 
            type="submit" 
            disabled={loading || !content.trim()}
            className="w-full bg-brand-blue text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-200 hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'מפרסם...' : 'פרסם בפיד'}
          </button>
        </form>

      </div>
    </main>
  )
}
