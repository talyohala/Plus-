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

    // 1. אימות משתמש בסיסי
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. שליפת פרופיל המשתמש המבקש
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !profile.building_id) {
      return NextResponse.json({ error: 'No building connection found' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // 3. שליפת תשלומים
    let query = supabase.from('payments').select('*').neq('status', 'canceled');
    
    if (isAdmin) {
      // ראש ועד רואה את כל תשלומי הבניין
      query = query.eq('building_id', profile.building_id);
    } else {
      // דייר רואה רק את שלו
      query = query.eq('payer_id', profile.id);
    }

    const { data: payments, error: payError } = await query.order('created_at', { ascending: false });
    if (payError) throw payError;

    // 4. שליפת "ספר טלפונים" של הבניין לצורך הצלבה
    // השאילתה הזו תעבוד עכשיו בזכות ה-SQL Policy שהרצנו בשלב 1
    const { data: buildingNeighbors } = await supabase
      .from('profiles')
      .select('id, full_name, apartment, avatar_url, role, phone')
      .eq('building_id', profile.building_id);

    const neighborsMap: Record<string, any> = {};
    if (buildingNeighbors) {
      buildingNeighbors.forEach(n => {
        neighborsMap[n.id] = n;
      });
    }

    // 5. העשרת הנתונים - כאן מתבצע הקסם שבו המנהל רואה את השמות של כולם
    const enrichedPayments = (payments || []).map(pay => {
      const payerInfo = neighborsMap[pay.payer_id];
      return {
        ...pay,
        profiles: payerInfo || {
          full_name: 'שכן בבניין',
          apartment: '?',
          avatar_url: null
        }
      };
    });

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('Payments Fetch Final Error:', error.message);
    return NextResponse.json({ error: 'Internal Error', details: error.message }, { status: 500 });
  }
}
