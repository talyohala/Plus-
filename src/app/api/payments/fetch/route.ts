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
      console.error('API Fetch Configuration Error');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseUser = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          try {
            return cookieStore.get(name)?.value;
          } catch (e) {
            return undefined;
          }
        },
      },
    });

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 401 });
    }

    const { data: profile, error: profErr } = await supabaseUser
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profErr || !profile || !profile.building_id) {
      return NextResponse.json({ error: 'Profile unlinked' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

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

    const { data: buildingProfiles } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('building_id', profile.building_id);

    const profilesMap: Record<string, any> = {};
    if (buildingProfiles) {
      buildingProfiles.forEach(p => {
        // אבטחת מידע קפדנית: חושפים החוצה רק את השדות שחייבים בשביל ה-UI (והוואטסאפ)
        profilesMap[p.id] = {
          full_name: p.full_name,
          apartment: p.apartment,
          avatar_url: p.avatar_url,
          role: p.role,
          phone: p.phone
        };
      });
    }

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
    console.error('API Fetch Payments Fatal Error:', error.message || error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
