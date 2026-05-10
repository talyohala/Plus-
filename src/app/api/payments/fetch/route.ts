import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error('API Fetch Error: Missing environment variables.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // קליינט משתמש (אימות מול עוגיות)
    const supabaseUser = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
      },
    });

    // קליינט אדמין לעקיפת RLS ושליפת שמות השכנים בבניין
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // 1. אימות
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    // 2. משיכת פרופיל אישי
    const { data: profile, error: profErr } = await supabaseUser
      .from('profiles')
      .select('id, full_name, building_id, role, apartment, avatar_url, saved_payment_methods')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !profile.building_id) {
      return NextResponse.json({ error: 'Profile missing or unlinked' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // 3. שליפת תשלומים
    let paymentsQuery = supabaseUser
      .from('payments')
      .select('*')
      .neq('status', 'canceled')
      .order('created_at', { ascending: false });

    if (isAdmin) {
      paymentsQuery = paymentsQuery.eq('building_id', profile.building_id);
    } else {
      paymentsQuery = paymentsQuery.eq('payer_id', profile.id);
    }

    const { data: rawPayments, error: payErr } = await paymentsQuery;
    if (payErr) throw payErr;

    // 4. סנכרון תשלומים אוטומטי לדייר
    if (!isAdmin && rawPayments) {
      const { data: activeBuildingPayments } = await supabaseUser
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

          await supabaseUser.from('payments').insert(inserts);
          
          const { data: refreshed } = await supabaseUser
            .from('payments')
            .select('*')
            .eq('payer_id', profile.id)
            .neq('status', 'canceled')
            .order('created_at', { ascending: false });

          if (refreshed) {
            rawPayments.length = 0;
            rawPayments.push(...refreshed);
          }
        }
      }
    }

    // 5. מיפוי שמות מלא של הבניין באמצעות מפתח האדמין שהזנת
    const { data: buildingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, apartment, avatar_url, role, phone')
      .eq('building_id', profile.building_id);

    const profilesMap: Record<string, any> = {};
    if (buildingProfiles) {
      buildingProfiles.forEach(p => {
        profilesMap[p.id] = p;
      });
    }

    // 6. העשרת התשלומים בשמות האמיתיים
    const enrichedPayments = (rawPayments || []).map(pay => ({
      ...pay,
      profiles: profilesMap[pay.payer_id] || { 
        full_name: pay.payer_id === profile.id ? profile.full_name : 'דייר בבניין', 
        apartment: pay.payer_id === profile.id ? profile.apartment : '?' 
      }
    }));

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('API Fetch Fatal Error:', error.message || error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
