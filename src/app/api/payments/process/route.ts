import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// הוסרה הגדרת ה-edge כדי לפתור את האזהרה ב-Vercel
export const dynamic = 'force-dynamic';

const APP_SERVICE_FEE = 1.50;

interface ProcessPaymentRequest {
  paymentId: string;
  paymentMethodDetails: {
    type: string;
    last4?: string;
  };
}

export async function POST(req: Request) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, paymentMethodDetails }: ProcessPaymentRequest = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
    }

    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('amount, status, building_id, title')
      .eq('id', paymentId)
      .eq('payer_id', user.id)
      .single();

    if (fetchError || !paymentRecord) {
      return NextResponse.json({ error: 'Payment record not found' }, { status: 404 });
    }

    if (paymentRecord.status === 'paid') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
    }

    const originalBuildingAmount = paymentRecord.amount;
    const totalChargedToUser = originalBuildingAmount + APP_SERVICE_FEE;

    console.log(`Processing charge of ₪${totalChargedToUser} (Building: ₪${originalBuildingAmount}, Fee: ₪${APP_SERVICE_FEE})`);

    const { error: updateError } = await supabase
      .from('payments')
      .update({ status: 'paid' })
      .eq('id', paymentId);

    if (updateError) throw updateError;

    return NextResponse.json({ 
      success: true, 
      chargedAmount: totalChargedToUser,
      serviceFee: APP_SERVICE_FEE,
      message: 'Payment processed successfully.'
    });

  } catch (error: any) {
    console.error('Payment Processing Failed:', error.message || error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
