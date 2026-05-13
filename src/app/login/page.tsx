'use client'
import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import { playSystemSound } from '../../components/providers/AppManager';

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  const router = useRouter();

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/');
    });
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    playSystemSound('click');
    setLoading(true);
    setError('');
    try {
      if (isLogin) {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        playSystemSound('notification');
        router.push('/');
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName } }
        });
        if (signUpError) throw signUpError;
        playSystemSound('notification');
        router.push('/');
      }
    } catch (err: any) {
      setError(err.message === 'Invalid login credentials' ? 'פרטי ההתחברות שגויים' : 'אירעה שגיאה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;800;900&display=swap');
        
        /* דריסת הרקע התכלת של השלמה אוטומטית בדפדפן */
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 50px white inset !important;
            -webkit-text-fill-color: #1e293b !important;
            transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center relative overflow-hidden" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
        
        {/* --- רקע עליון כחול --- */}
        <div className="absolute top-0 left-0 right-0 h-[45vh] bg-gradient-to-br from-[#1D4ED8] to-[#3B82F6] rounded-b-[45px] shadow-[0_15px_40px_rgba(29,78,216,0.2)] overflow-hidden">
          <div className="absolute top-[-30%] left-1/2 -translate-x-1/2 w-[120vw] max-w-[600px] aspect-square rounded-full border-[1.5px] border-white/15" />
        </div>

        {/* --- תוכן מרכזי --- */}
        <div className="relative z-10 w-full max-w-sm flex flex-col items-center pt-20 px-5 pb-10 flex-1 justify-center">
          
          {/* לוגו לבן ונקי */}
          <div className="text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <h1 className="text-[54px] font-black text-white tracking-tighter leading-none mb-1">
              שכן<span className="text-white">+</span>
            </h1>
            <p className="text-[11px] font-bold text-white/70 tracking-[0.2em] uppercase">ניהול קהילה מתקדם</p>
          </div>

          {/* כרטיסיית זכוכית מרחפת */}
          {mounted && (
            <div className="w-full bg-white/95 backdrop-blur-2xl border border-white/60 rounded-[2.5rem] p-7 shadow-[0_20px_50px_rgba(29,78,216,0.12)] animate-in fade-in slide-in-from-bottom-8 duration-700">
              
              {/* טאבים קפסולה */}
              <div className="flex bg-slate-100/80 p-1.5 rounded-full mb-8 relative border border-slate-200/50">
                <div 
                  className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-all duration-300 ease-out ${isLogin ? 'right-1.5' : 'right-[calc(50%+3px)]'}`} 
                />
                <button 
                  type="button"
                  onClick={() => { playSystemSound('click'); setIsLogin(true); setError(''); }}
                  className={`flex-1 py-2.5 text-[15px] font-bold z-10 transition-colors ${isLogin ? 'text-[#1D4ED8]' : 'text-slate-400'}`}
                >
                  התחברות
                </button>
                <button 
                  type="button"
                  onClick={() => { playSystemSound('click'); setIsLogin(false); setError(''); }}
                  className={`flex-1 py-2.5 text-[15px] font-bold z-10 transition-colors ${!isLogin ? 'text-[#1D4ED8]' : 'text-slate-400'}`}
                >
                  הרשמה
                </button>
              </div>

              {/* טופס */}
              <form onSubmit={handleAuth} className="space-y-4">
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${!isLogin ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <input 
                    type="text" placeholder="שם מלא" value={fullName} onChange={(e) => setFullName(e.target.value)} required={!isLogin}
                    className="w-full bg-white border border-slate-200 rounded-full py-3.5 px-5 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1D4ED8]/70 focus:ring-0 transition-all duration-300"
                  />
                </div>
                <input 
                  type="email" placeholder="דואר אלקטרוני" value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full bg-white border border-slate-200 rounded-full py-3.5 px-5 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1D4ED8]/70 focus:ring-0 transition-all duration-300"
                />
                <input 
                  type="password" placeholder="סיסמה" value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full bg-white border border-slate-200 rounded-full py-3.5 px-5 text-[15px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#1D4ED8]/70 focus:ring-0 transition-all duration-300"
                />
                {error && <div className="bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold p-3 rounded-2xl text-center mt-2">{error}</div>}
                <button type="submit" disabled={loading} className="w-full bg-gradient-to-l from-[#1D4ED8] to-[#3B82F6] text-white font-bold text-[16px] rounded-full py-4 mt-6 shadow-[0_8px_20px_rgba(29,78,216,0.25)] active:scale-[0.98] transition-all flex justify-center items-center min-h-[54px]">
                  {loading ? <div className="w-5 h-5 border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" /> : (isLogin ? 'כניסה למערכת' : 'יצירת חשבון')}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
