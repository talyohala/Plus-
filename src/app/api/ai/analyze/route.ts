import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'edge';

interface AnalyzeRequestBody {
  description: string;
  mode?: 'insight' | 'classify';
  payload?: any;
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

    const { data: { authError } } = await supabase.auth.getUser();
    if (authError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: AnalyzeRequestBody = await req.json();
    const { description, mode, payload } = body;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      return NextResponse.json({ error: 'Missing API Key' }, { status: 500 });
    }

    const model = 'gpt-4o-mini';

    // --- מצב 1: ניתוח תובנות עמוק (Super Insight) ---
    if (mode === 'insight') {
      let finalPrompt = description;
      
      // אם התקבל עץ נתונים פיננסי מלא, נבצע ניתוח מקיף
      if (payload && Array.isArray(payload.payments)) {
        const totalCollected = payload.payments.filter((p: any) => p.status === 'paid').reduce((s: any, p: any) => s + p.amount, 0);
        const pendingItems = payload.payments.filter((p: any) => p.status === 'pending' || p.status === 'pending_approval');
        const totalPending = pendingItems.reduce((s: any, p: any) => s + p.amount, 0);
        
        const detailsList = pendingItems.map((p: any) => `- ${p.profiles?.full_name || 'דייר'}: ${p.title} (${p.amount} ש"ח)`).join('\n');

        finalPrompt = `
        אתה רובוט פיננסי חכם המשמש כעוזר האישי של ${payload.userName} (תפקיד: ${payload.role === 'admin' ? 'מנהל ועד הבית' : 'דייר בבניין'}).
        הנה תמונת המצב המדויקת של הקופה כרגע:
        - סך הכל נאסף בקופה: ${totalCollected} ש"ח.
        - סך הכל חסר לגבייה: ${totalPending} ש"ח (${pendingItems.length} דרישות פתוחות).
        
        פירוט התשלומים הפתוחים שממתינים:
        ${detailsList || 'אין תשלומים פתוחים כרגע.'}

        הוראות ניסוח קפדניות:
        נתח את הנתונים, שים לב למי שילם ולמי חסר, ונסח הודעת עדכון חכמה ומדהימה מגוף ראשון.
        כתוב בדיוק 3 שורות קצרות, עם ירידת שורה ביניהן (\n).
        אל תשתמש במילה חוב. הוסף אימוג'י רלוונטי בכל שורה.
        `;
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: finalPrompt }],
          temperature: 0.5,
          max_tokens: 300
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);

      return NextResponse.json({ text: data.choices[0].message.content });
    }

    // --- מצב 2: סיווג תקלות ---
    const prompt = `
      אתה מנהל ועד בית חכם. עליך לקרוא את תיאור התקלה שכתב הדייר, ולהחזיר אובייקט JSON בלבד עם:
      1. title: כותרת קצרה ומדויקת של עד 4 מילים.
      2. tags: מערך של 1 עד 2 תגיות סיווג בעברית. חובה להשתמש באחת מהתגיות הבאות אם התקלה קשורה אליהן: ["חשמלאי", "אינסטלטור", "מנקה", "טכנאי מעליות", "גנן", "מנעולן", "מסגר", "שיפוצניק", "איטום", "הדברה", "אינטרקום", "כיבוי אש", "משאבות", "גז", "כללי"].
      תיאור הדייר: "${description}"
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message);

    return NextResponse.json(JSON.parse(data.choices[0].message.content));

  } catch (error: any) {
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}
