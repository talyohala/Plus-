import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase.from('profiles').select('building_id').eq('id', user.id).single();
    if (!profile?.building_id) {
      return NextResponse.json({ error: 'Building not found' }, { status: 403 });
    }

    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: 'Missing text' }, { status: 400 });

    const systemPrompt = `
      אתה מערכת ניהול בניין סופר-חכמה (Building OS). נתח את בקשת הדייר וסווג אותה.
      Intent אפשריים: "TICKET", "MARKETPLACE", "CHAT".
      החזר אך ורק אובייקט JSON תקני:
      {
        "intent": "TICKET" | "MARKETPLACE" | "CHAT",
        "title": "כותרת קצרה של עד 4 מילים",
        "category": "קטגוריה מדויקת (אינסטלציה, חשמל, בקשת שכן, כללי וכו')",
        "responseMsg": "תשובה קצרה לדייר בעברית עם אימוג'י 1"
      }
    `;

    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: text }],
        temperature: 0.2,
        response_format: { type: 'json_object' }
      })
    });

    if (!aiRes.ok) throw new Error('AI Provider Error');
    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    if (result.intent === 'TICKET') {
      await supabase.from('service_tickets').insert([{ building_id: profile.building_id, user_id: user.id, title: result.title, description: text, ai_category: result.category, status: 'פתוח', source: 'magic_input' }]);
    } else if (result.intent === 'MARKETPLACE') {
      await supabase.from('marketplace_items').insert([{ building_id: profile.building_id, user_id: user.id, title: result.title, description: text, category: 'בקשות שכנים', status: 'available' }]);
    } else {
      await supabase.from('messages').insert([{ building_id: profile.building_id, user_id: user.id, content: text, read_by: [] }]);
    }

    return NextResponse.json({ success: true, action: result.intent, message: result.responseMsg });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
