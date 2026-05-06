import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { description, mode } = body;
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      return NextResponse.json({ title: 'אין מפתח API', tags: ['הגדרות'], text: 'חסר מפתח API במערכת.' });
    }

    // --- מצב 1: רובוט התובנות של הארנק הפיננסי (משתמש במודל gpt-4o החכם) ---
    if (mode === 'insight') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // שדרוג למודל פרימיום לתשובות אנושיות וחכמות
          messages: [{ role: 'user', content: description }]
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);
      
      return NextResponse.json({ text: data.choices[0].message.content });
    }

    // --- מצב 2: סיווג תקלות (הלוגיקה המקורית והיציבה שלך) ---
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
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message);

    const content = JSON.parse(data.choices[0].message.content);
    return NextResponse.json(content);

  } catch (error: any) {
    console.error('Internal API Error:', error);
    return NextResponse.json({ title: 'שגיאת שרת', tags: ['שגיאה'], text: 'המערכת כרגע מסנכרנת נתונים...' });
  }
}
