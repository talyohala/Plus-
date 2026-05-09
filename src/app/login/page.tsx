'use client'
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('אנא הזן אימייל וסיסמה');
    
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      // רענון השרת לקריאת העוגייה ומעבר חלק
      router.refresh();
      router.push('/');
    }
  };

  const handleSignUp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email || !password) return alert('אנא הזן אימייל וסיסמה כדי להירשם');

    setLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    
    if (error) {
      alert(error.message);
      setLoading(false);
    } else {
      router.refresh();
      router.push('/');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100" dir="rtl">
      <div className="w-full max-w-md glass-panel p-8 rounded-[2.5rem] text-center shadow-sm bg-white/80 backdrop-blur-md border border-white">
        <h1 className="text-3xl font-black text-[#1D4ED8] mb-2">שכן<span className="text-2xl text-slate-800">+</span></h1>
        <p className="text-slate-500 mb-8 font-medium">הצטרפו לקהילת הבניין שלכם</p>
        
        <form onSubmit={handleLogin} className="space-y-4 text-right">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 mr-2">אימייל</label>
            <input 
              type="email" 
              className="w-full p-4 rounded-2xl bg-white/50 border border-gray-200 focus:border-[#1D4ED8] outline-none transition text-left shadow-inner"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 mr-2">סיסמה (מינימום 6 תווים)</label>
            <input 
              type="password" 
              className="w-full p-4 rounded-2xl bg-white/50 border border-gray-200 focus:border-[#1D4ED8] outline-none transition text-left shadow-inner"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#1D4ED8] text-white font-bold py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
          >
            {loading ? 'מתחבר למערכת...' : 'התחברות'}
          </button>
        </form>

        <button 
          onClick={handleSignUp}
          disabled={loading}
          className="mt-6 text-sm text-[#1D4ED8] font-bold hover:underline disabled:opacity-50"
        >
          עוד לא רשומים? צרו חשבון חדש
        </button>
      </div>
    </main>
  );
}
