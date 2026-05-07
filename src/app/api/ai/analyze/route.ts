import { NextResponse } from 'next/server';

// השדרוג הסופר-חכם: מעבר למנוע Edge במקום Node.js המיושן
// זה מבטל את ה-"Cold Start" (זמן ההתעוררות של השרת) וגורם לתשובות להיות כמעט מיידיות!
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { description, mode } = body;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      console.error('AI Route Error: Missing OPENAI_API_KEY');
      return NextResponse.json({ 
        title: 'אין מפתח API', 
        tags: ['הגדרות'], 
        text: 'חסר מפתח API במערכת.' 
      });
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

    // --- מצב 2: סיווג תקלות ---
    const prompt = `
      אתה מנהל ועד בית חכם. עליך לקרוא את תיאור התקלה שכתב הדייר, ולהחזיר אובייקט JSON בלבד עם:
      1. title: כותרת קצרה ומדויקת של עד 4 מילים.
      2. tags: מערך של 1 עד 2 תגיות סיווג בעברית. **חובה** להשתמש באחת מהתגיות הבאות אם התקלה קשורה אליהן: ["חשמלאי", "אינסטלטור", "מנקה", "טכנאי מעליות", "גנן", "מנעולן", "מסגר", "שיפוצניק", "איטום", "הדברה", "אינטרקום", "כיבוי אש", "משאבות", "גז", "כללי"].
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

  } catch (error: any) {
    console.error('Internal API Error:', error.message);
    return NextResponse.json({ 
      title: 'שגיאת שרת', 
      tags: ['שגיאה'], 
      text: 'קהילת הבניין שלך מסונכרנת. המתן מספר שניות לרענון התובנות ✨' 
    });
  }
}
