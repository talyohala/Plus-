import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

// מוח הניתוח: מקבל טקסט חופשי ומחזיר פעולה מובנית
export async function POST(req: Request) {
  try {
    const { text, userId, buildingId } = await req.json();
    if (!text || !userId || !buildingId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // פרומפט חכם שמאלץ את ה-AI להחזיר מבנה נתונים מדויק (JSON)
    const systemPrompt = `
      You are an advanced Building OS AI Assistant.
      Analyze the user's input and classify it into one of the following intents:
      1. "TICKET" - Reporting an issue, broken item, leak, damage, or request for repair.
      2. "MARKETPLACE" - Borrowing, lending, selling, giving away, or neighborly help requests (e.g. cables, tools, parking).
      3. "CHAT" - General updates, neighborly chat, questions, or non-actionable chatter.

      Respond ONLY in this exact JSON format, with no extra text or markdown:
      {
        "intent": "TICKET" | "MARKETPLACE" | "CHAT",
        "title": "Short title summary (up to 5 words)",
        "category": "Extracted category (e.g. אינסטלציה, חשמל, מעליות, בקשת שכן, כללי)",
        "responseMsg": "A short confirmation message to the user in Hebrew (1 sentence, max 1 emoji)"
      }
    `;

    // קריאה לשרת ה-AI (מותאם למודל שלך)
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });

    if (!aiRes.ok) {
      throw new Error('AI Provider Error');
    }

    const aiData = await aiRes.json();
    const result = JSON.parse(aiData.choices[0].message.content);

    // ביצוע הפעולה האוטומטית במסד הנתונים בהתאם לניתוח!
    if (result.intent === 'TICKET') {
      await supabase.from('service_tickets').insert([{
        building_id: buildingId,
        user_id: userId,
        title: result.title,
        description: text,
        ai_category: result.category,
        status: 'פתוח',
        source: 'magic_input'
      }]);
    } else if (result.intent === 'MARKETPLACE') {
      await supabase.from('marketplace_items').insert([{
        building_id: buildingId,
        seller_id: userId,
        title: result.title,
        description: text,
        category: 'בקשות שכנים',
        status: 'available'
      }]);
    } else {
      // ברירת מחדל: שליחה לצ'אט הבניין
      await supabase.from('messages').insert([{
        building_id: buildingId,
        user_id: userId,
        content: text,
        read_by: []
      }]);
    }

    return NextResponse.json({ 
      success: true, 
      action: result.intent,
      message: result.responseMsg 
    });

  } catch (error: any) {
    console.error('Omni Router Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
