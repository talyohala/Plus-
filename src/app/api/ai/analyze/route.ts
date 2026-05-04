import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { description } = await req.json();
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      return NextResponse.json({ title: 'תקלה (ללא AI)', tags: ['כללי'] });
    }

    const prompt = `
    אתה מנהל ועד בית חכם. עליך לקרוא את תיאור התקלה שכתב הדייר, ולהחזיר אובייקט JSON בלבד עם:
    1. title: כותרת קצרה ומדויקת של עד 4 מילים.
    2. tags: מערך של 1 עד 2 תגיות סיווג בעברית (לדוגמה: ["מעלית", "דחוף"], ["ניקיון"]).
    
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
    const content = JSON.parse(data.choices[0].message.content);

    return NextResponse.json(content);
  } catch (error) {
    console.error('AI Error:', error);
    return NextResponse.json({ title: 'דיווח מהאפליקציה', tags: ['שגיאת מערכת'] });
  }
}
