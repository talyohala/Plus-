import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'edge';

// עמלת שירות קבועה שנגבית לטובת רווחי האפליקציה (Monetization)
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

    // 1. וידוא זהות המשתמש (Security Check)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, paymentMethodDetails }: ProcessPaymentRequest = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: 'Missing payment ID' }, { status: 400 });
    }

    // 2. משיכת נתוני התשלום המקוריים מהמסד
    const { data: paymentRecord, error: fetchError } = await supabase
      .from('payments')
      .select('amount, status, building_id, title')
      .eq('id', paymentId)
      .eq('payer_id', user.id)
      .single();

    if (fetchError || !paymentRecord) {
      return NextResponse.json({ error: 'Payment record not found or access denied' }, { status: 404 });
    }

    if (paymentRecord.status === 'paid') {
      return NextResponse.json({ error: 'Payment already processed' }, { status: 400 });
    }

    // 3. חישובים פיננסיים להכנסות
    const originalBuildingAmount = paymentRecord.amount;
    const totalChargedToUser = originalBuildingAmount + APP_SERVICE_FEE;

    // TODO: כאן בעתיד תתבצע קריאת ה-API האמיתית לחברת הסליקה (Stripe / Meshulam)
    // עם הסכום המלא: totalChargedToUser.
    console.log(`Processing charge of ₪${totalChargedToUser} (Building: ₪${originalBuildingAmount}, Fee: ₪${APP_SERVICE_FEE})`);

    // 4. עדכון סטטוס התשלום בשרת בלבד (Server-Side Validation)
    const { error: updateError } = await supabase
      .from('payments')
      .update({ 
        status: 'paid',
        // ניתן לשמור שדות תיעוד נוספים במידת הצורך
      })
      .eq('id', paymentId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ 
      success: true, 
      chargedAmount: totalChargedToUser,
      serviceFee: APP_SERVICE_FEE,
      message: 'Payment processed successfully via secure backend.'
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Payment Processing Failed:', err.message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
