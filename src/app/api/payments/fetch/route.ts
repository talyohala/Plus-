import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // התיקון הקריטי: ב-Next.js 16+ קריאת העוגיות חייבת להיות אסינכרונית (await)
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { 
            return cookieStore.get(name)?.value; 
          },
        },
      }
    );

    // 1. אימות משתמש
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized access', details: authError?.message }, { status: 401 });
    }

    // 2. שליפת פרופיל
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, building_id, role, apartment, avatar_url, saved_payment_methods')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found', details: profileError?.message }, { status: 404 });
    }

    if (!profile.building_id) {
      return NextResponse.json({ error: 'User is not linked to any building' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // 3. שליפת תשלומים נקייה
    const { data: rawPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('*')
      .eq(isAdmin ? 'building_id' : 'payer_id', profile.building_id)
      .neq('status', 'canceled')
      .order('created_at', { ascending: false });

    if (paymentsError) {
      return NextResponse.json({ error: 'Database payments fetch failed', details: paymentsError.message }, { status: 500 });
    }

    const filteredPayments = isAdmin 
      ? rawPayments || [] 
      : (rawPayments || []).filter(p => p.payer_id === profile.id);

    // 4. סנכרון תשלומים חסרים (רק לדייר)
    if (!isAdmin && filteredPayments) {
      const { data: activeBuildingPayments } = await supabase
        .from('payments')
        .select('title, amount')
        .eq('building_id', profile.building_id)
        .eq('status', 'pending');

      if (activeBuildingPayments && activeBuildingPayments.length > 0) {
        const existingTitles = new Set(filteredPayments.map(p => p.title));
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

          const { error: insertErr } = await supabase.from('payments').insert(inserts);
          
          if (!insertErr) {
            const { data: refreshedPayments } = await supabase
              .from('payments')
              .select('*')
              .eq('payer_id', profile.id)
              .neq('status', 'canceled')
              .order('created_at', { ascending: false });

            if (refreshedPayments) {
              filteredPayments.length = 0;
              filteredPayments.push(...refreshedPayments);
            }
          }
        }
      }
    }

    // 5. מיפוי פרופילים (שמות השכנים)
    const enrichedPayments = [];
    const payerIds = Array.from(new Set(filteredPayments.map(p => p.payer_id).filter(Boolean)));
    
    const profilesMap: Record<string, any> = {};
    
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

    for (const pay of filteredPayments) {
      enrichedPayments.push({
        ...pay,
        profiles: profilesMap[pay.payer_id] || { full_name: 'דייר' }
      });
    }

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('API Fetch Payments Fatal Error:', error?.message || error);
    return NextResponse.json({ 
      error: 'Unexpected runtime error', 
      details: error?.message || String(error) 
    }, { status: 500 });
  }
}
