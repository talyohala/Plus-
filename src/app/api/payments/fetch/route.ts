import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    // 1. אימות משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. שליפת פרופיל המשתמש הנוכחי
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, building_id, role, apartment, avatar_url')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.building_id) {
      return NextResponse.json({ error: 'No building linked' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // 3. שליפת תשלומים (מנהל רואה הכל, דייר רק שלו)
    let payQuery = supabase.from('payments').select('*').neq('status', 'canceled');
    
    if (isAdmin) {
      payQuery = payQuery.eq('building_id', profile.building_id);
    } else {
      payQuery = payQuery.eq('payer_id', profile.id);
    }

    const { data: payments, error: payError } = await payQuery.order('created_at', { ascending: false });

    if (payError) throw payError;

    // 4. שליפת כלל הפרופילים בבניין כדי לבצע הצלבה (Mapping)
    // הערה: אם הרצת את ה-SQL למעלה, השאילתה הזו תחזיר את כל השמות.
    const { data: allProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, apartment, avatar_url, role, phone')
      .eq('building_id', profile.building_id);

    const profilesMap: Record<string, any> = {};
    if (allProfiles) {
      allProfiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    // 5. בניית אובייקט תגובה עשיר ומאובטח
    const enrichedPayments = (payments || []).map(pay => ({
      ...pay,
      profiles: profilesMap[pay.payer_id] || { 
        full_name: profile.id === pay.payer_id ? profile.full_name : 'דייר בבניין', 
        apartment: profile.id === pay.payer_id ? profile.apartment : '?' 
      }
    }));

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('Final Secure Fetch Error:', error.message);
    return NextResponse.json({ error: 'Server Error', details: error.message }, { status: 500 });
  }
}
