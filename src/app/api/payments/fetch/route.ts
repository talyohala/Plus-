import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// מעבר לזמן ריצה סטנדרטי ויציב (Node.js) ללא קריסות עוגיות
export async function GET() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    // 1. אימות משתמש מאובטח
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    // 2. משיכת פרופיל המשתמש
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id, role, apartment, avatar_url, saved_payment_methods')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || !profile.building_id) {
      return NextResponse.json({ error: 'Profile missing or not linked to a building' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // 3. שליפת תשלומים מאובטחת ומסוננת (שאילתה ראשונה)
    const { data: rawPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq(isAdmin ? 'building_id' : 'payer_id', isAdmin ? profile.building_id : profile.id)
      .neq('status', 'canceled')
      .order('created_at', { ascending: false });

    if (paymentsError) {
      throw paymentsError;
    }

    // 4. ריפוי עצמי: סנכרון תשלומים חסרים לדייר
    if (!isAdmin && rawPayments) {
      const { data: activeBuildingPayments } = await supabase
        .from('payments')
        .select('title, amount')
        .eq('building_id', profile.building_id)
        .eq('status', 'pending');

      if (activeBuildingPayments && activeBuildingPayments.length > 0) {
        const existingTitles = new Set(rawPayments.map(p => p.title));
        const uniqueBuildingTitles = Array.from(new Set(activeBuildingPayments.map(p => p.title)));
        const missingTitles = uniqueBuildingTitles.filter(title => !existingTitles.has(title));

        if (missingTitles.length > 0) {
          const inserts = missingTitles.map(title => {
            const amountObj = activeBuildingPayments.find(p => p.title === title);
            return {
              payer_id: profile.id,
              building_id: profile.building_id,
              title,
              amount: amountObj?.amount || 0,
              status: 'pending'
            };
          });

          await supabase.from('payments').insert(inserts);

          // FIX קריטי: יצירת שאילתה חדשה לחלוטין במקום למחזר את הקודמת!
          const { data: refreshedPayments } = await supabase
            .from('payments')
            .select('*')
            .eq('payer_id', profile.id)
            .neq('status', 'canceled')
            .order('created_at', { ascending: false });

          if (refreshedPayments) {
            rawPayments.length = 0;
            rawPayments.push(...refreshedPayments);
          }
        }
      }
    }

    // 5. מיפוי פרופילים בטוח בשרת (In-Memory Map)
    const enrichedPayments = [];
    if (rawPayments && rawPayments.length > 0) {
      const payerIds = Array.from(new Set(rawPayments.map(p => p.payer_id).filter(Boolean)));
      
      let profilesMap: Record<string, any> = {};
      
      if (payerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, apartment, avatar_url, role, phone')
          .in('id', payerIds);

        if (profilesData) {
          profilesData.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      for (const pay of rawPayments) {
        enrichedPayments.push({
          ...pay,
          profiles: profilesMap[pay.payer_id] || { full_name: 'דייר' }
        });
      }
    }

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('API Fetch Payments Error:', error?.message || error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
