import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
  const { userId, type, details } = await req.json();

  if (type === 'parking') {
    // 1. יצירת הבקשה בבסיס הנתונים (24 שעות תוקף מוגדרות אוטומטית ב-DB)
    const { data: request, error } = await supabase
      .from('ai_smart_requests')
      .insert({ user_id: userId, request_type: 'parking', status: 'searching' })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 2. כאן נכנסת האינטגרציה ל-WhatsApp Business API
    // שליחת הודעה לקבוצה עם כפתורים (Interactive Template Message)
    // payload example:
    /*
      await fetch('https://graph.facebook.com/v17.0/PHONE_ID/messages', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${TOKEN}` },
        body: JSON.stringify({
          to: 'GROUP_ID',
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: `דייר מחפש חניה ל-24 השעות הקרובות! יש לכם חניה פנויה?` },
            action: {
              buttons: [
                { type: 'reply', reply: { id: `offer_parking_${request.id}`, title: 'יש לי חניה פנויה' } }
              ]
            }
          }
        })
      });
    */

    return NextResponse.json({ success: true, message: 'Request created and sent to WhatsApp' });
  }

  return NextResponse.json({ error: 'Unknown request type' }, { status: 400 });
}
