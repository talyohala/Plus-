import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'edge';

interface AnalyzeRequestBody {
  description: string;
  mode?: 'insight' | 'classify';
}

export async function POST(req: Request) {
  try {
    // משיכת עוגיות ישירה ונקייה מתוך ה-Headers (אפס שגיאות Promise Unwrapping)
    const cookieHeader = req.headers.get('cookie') || '';
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const match = cookieHeader.match(new RegExp(`(^| )${name}=([^;]+)`));
            return match ? decodeURIComponent(match[2]) : undefined;
          },
        },
      }
    );

    const { data: { authError } } = await supabase.auth.getUser();
    if (authError) {
      console.warn('Unauthorized AI API access attempt.');
      return NextResponse.json(
        { title: 'גישה נדחתה', tags: ['אבטחה'], text: 'אינך מורשה לבצע פעולה זו.' },
        { status: 401 }
      );
    }

    const body: AnalyzeRequestBody = await req.json();
    const { description, mode } = body;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      console.error('AI Route Error: Missing OPENAI_API_KEY');
      return NextResponse.json(
        { title: 'שגיאת הגדרות', tags: ['מערכת'], text: 'חסר מפתח API בשרת.' },
        { status: 500 }
      );
    }

    if (!description || typeof description !== 'string') {
      return NextResponse.json(
        { title: 'קלט לא תקין', tags: ['שגיאה'], text: 'אנא ספק תיאור תקין.' },
        { status: 400 }
      );
    }

    const model = 'gpt-4o-mini';

    if (mode === 'insight') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: description }],
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error('OpenAI Insight Error:', data.error);
        throw new Error(data.error?.message || 'OpenAI request failed');
      }

      return NextResponse.json({ text: data.choices[0].message.content });
    }

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
    if (!response.ok) {
      console.error('OpenAI Classify Error:', data.error);
      throw new Error(data.error?.message || 'OpenAI request failed');
    }

    const content = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(content);

  } catch (error: unknown) {
    const err = error as Error;
    console.error('Internal API Error:', err.message);
    return NextResponse.json(
      { title: 'שגיאת שרת', tags: ['שגיאה'], text: 'המערכת עמוסה כרגע. אנא נסה שוב בעוד מספר שניות ✨' },
      { status: 500 }
    );
  }
}
