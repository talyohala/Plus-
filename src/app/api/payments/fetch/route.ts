import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    
    // קליינט רגיל ומאובטח - ללא צורך במפתח אדמין שגורם לקריסות
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, building_id, role, apartment, avatar_url, saved_payment_methods')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.building_id) {
      return NextResponse.json({ error: 'Profile error' }, { status: 403 });
    }

    const isAdmin = profile.role === 'admin';

    // משיכת תשלומים (מנהל רואה הכל, דייר רואה את שלו)
    let query = supabase.from('payments').select('*').neq('status', 'canceled').order('created_at', { ascending: false });
    
    if (isAdmin) {
      query = query.eq('building_id', profile.building_id);
    } else {
      query = query.eq('payer_id', profile.id);
    }

    const { data: payments, error: payError } = await query;
    if (payError) throw payError;

    // סנכרון תשלומים לדיירים (Self-Healing)
    if (!isAdmin && payments) {
      const { data: activeBuildingPayments } = await supabase
        .from('payments')
        .select('title, amount')
        .eq('building_id', profile.building_id)
        .eq('status', 'pending');

      if (activeBuildingPayments && activeBuildingPayments.length > 0) {
        const existingTitles = new Set(payments.map(p => p.title));
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
          
          // משיכה מחודשת אחרי סנכרון
          const { data: refreshed } = await supabase.from('payments').select('*').eq('payer_id', profile.id).neq('status', 'canceled').order('created_at', { ascending: false });
          if (refreshed) {
            payments.length = 0;
            payments.push(...refreshed);
          }
        }
      }
    }

    // שליפת פרופילים (השמות) - עובד כעת בזכות חוק ה-RLS במסד
    const payerIds = Array.from(new Set((payments || []).map(p => p.payer_id).filter(Boolean)));
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

    const enrichedPayments = (payments || []).map(pay => ({
      ...pay,
      profiles: profilesMap[pay.payer_id] || { full_name: 'דייר (חסר הרשאה במסד)', apartment: '?' }
    }));

    return NextResponse.json({
      profile,
      payments: enrichedPayments
    });

  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: 'Server Error', details: error.message }, { status: 500 });
  }
}
