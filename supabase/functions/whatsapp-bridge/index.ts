import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface AIAnalysisResponse {
  type: 'תקלה' | 'הודעה' | 'בקשה' | 'שגיאה';
  summary: string;
  tags: string[];
}

async function analyzeWithAI(message: string): Promise<AIAnalysisResponse> {
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!openAiKey) {
    console.error('WhatsApp Bridge Error: OPENAI_API_KEY is missing.');
    return { type: 'תקלה', summary: 'דיווח כללי (ללא פענוח)', tags: ['כללי'] };
  }

  const prompt = `
  אתה עוזר חכם לניהול ועד בית בישראל. הנה הודעה ששלח דייר בוואטסאפ.
  עליך לנתח את ההודעה ולהחזיר אובייקט JSON בלבד עם השדות הבאים:
  1. type: סוג ההודעה (חובה לבחור אחד: 'תקלה', 'הודעה', 'בקשה').
  2. summary: כותרת קצרה ותמציתית של ההודעה (עד 5 מילים).
  3. tags: מערך של תגיות רלוונטיות בעברית (לדוגמה: ['מעלית', 'דחוף'], ['ניקיון']).
  
  הודעת הדייר: "${message}"
  `;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content) as AIAnalysisResponse;
  } catch (error) {
    console.error("AI Analysis Failed:", error);
    return { type: 'תקלה', summary: 'שגיאה בפענוח הודעה', tags: ['שגיאה'] };
  }
}

serve(async (req) => {
  try {
    const { message, from_number } = await req.json();

    if (!message || !from_number) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables missing.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // חיפוש פרופיל הדייר לפי מספר הטלפון
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, building_id')
      .eq('phone', from_number)
      .single();

    if (profileError || !profile) {
      console.warn(`User request rejected: Phone ${from_number} not found.`);
      return new Response(JSON.stringify({ error: "Phone number not registered" }), { 
        status: 404, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    // ניתוח ההודעה בעזרת AI
    const aiAnalysis = await analyzeWithAI(message);

    // פתיחת קריאת שירות במידה וזוהתה תקלה
    if (aiAnalysis.type === 'תקלה') {
      const { error: insertError } = await supabase.from('service_tickets').insert({
        user_id: profile.id,
        building_id: profile.building_id,
        title: aiAnalysis.summary,
        description: message,
        source: 'whatsapp',
        status: 'פתוח',
        ai_tags: aiAnalysis.tags
      });

      if (insertError) {
        throw insertError;
      }
    }

    return new Response(JSON.stringify({ success: true, action: aiAnalysis.type }), { 
      status: 200, 
      headers: { "Content-Type": "application/json" } 
    });

  } catch (error: unknown) {
    const err = error as Error;
    console.error("Bridge Critical Error:", err.message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { 
      status: 500, 
      headers: { "Content-Type": "application/json" } 
    });
  }
});
