import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Security/Config Error: Missing Supabase environment variables.');
}

// יצירת קליינט מאובטח לצד לקוח עם הגדרות עוגיות (Cookies) מתקדמות
export const supabase = createBrowserClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    cookieOptions: {
      name: 'sb-auth-token',
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
  }
);
