import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { description, mode, image } = await req.json();
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) return NextResponse.json({ error: 'Bad Request' }, { status: 400 });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s for vision

    // מודול ראייה ממוחשבת (Vision AI)
    if (mode === 'vision' && image) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { 
              role: 'system', 
              content: 'אתה מנהל אחזקה מומחה. עליך לנתח את התמונה. החזר אך ורק אובייקט JSON חוקי עם השדות: "description" (תיאור קצר, ברור ומקצועי בעברית של התקלה שאתה רואה, משפט אחד), ו-"urgency" (בחר אחד: "low", "medium", "high" בהתאם לחומרת התקלה).' 
            },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: 'מה התקלה בתמונה?' },
                { type: 'image_url', image_url: { url: image } }
              ] 
            }
          ],
          response_format: { type: 'json_object' }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      return NextResponse.json(JSON.parse(data.choices[0].message.content));
    }

    if (mode === 'insight') {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: 'אתה יועץ חכם לוועד בית בישראל. היה תמציתי ומדויק.' }, { role: 'user', content: description }],
          temperature: 0.5,
          max_tokens: 300
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      return NextResponse.json({ text: data.choices[0].message.content });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: `נתח את התקלה. החזר JSON: {"title":"כותרת קצרה","tags":["תגית1","תגית2"]}` }, { role: 'user', content: description }],
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));

  } catch (error: any) {
    console.error('AI Fallback Triggered:', error.name);
    return NextResponse.json(
      { text: "המערכת מנטרת את הבניין במלואו ✨", title: "תקלה כללית", tags: ["כללי"] },
      { status: 200 }
    );
  }
}
