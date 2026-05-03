import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// פונקציה לניתוח הודעות בעזרת הבינה המלאכותית של OpenAI
async function analyzeWithAI(message: string) {
  const openAiKey = Deno.env.get('OPENAI_API_KEY')
  
  // אם אין מפתח, נחזיר תשובת ברירת מחדל כדי לא לתקוע את המערכת
  if (!openAiKey) {
    return { type: 'תקלה', summary: 'דיווח ללא פענוח', tags: ['כללי'] }
  }

  const prompt = `
  אתה עוזר חכם לניהול ועד בית בישראל. הנה הודעה ששלח דייר בוואטסאפ.
  עליך לנתח את ההודעה ולהחזיר אובייקט JSON בלבד עם השדות הבאים:
  1. type: סוג ההודעה (חובה לבחור אחד: 'תקלה', 'הודעה', 'בקשה').
  2. summary: כותרת קצרה ותמציתית של ההודעה (עד 5 מילים).
  3. tags: מערך של תגיות רלוונטיות בעברית (לדוגמה: ['מעלית', 'דחוף'], ['ניקיון'], ['חניון']).
  
  הודעת הדייר: "${message}"
  `

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // מודל מהיר וזול שמתאים בטבעיות למשימות אלו
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' } // מכריח את המודל להחזיר JSON תקין
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content
    return JSON.parse(content)
  } catch (error) {
    console.error("שגיאה בפענוח:", error)
    return { type: 'תקלה', summary: 'שגיאה בפענוח הודעה', tags: ['שגיאה'] }
  }
}

serve(async (req) => {
  const { message, from_number } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '', 
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )
  
  // זיהוי הדייר לפי מספר טלפון
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', from_number)
    .single()

  if (!profile) return new Response("User not found", { status: 404 })

  // הפעלת מנוע הבינה המלאכותית
  const aiAnalysis = await analyzeWithAI(message)

  // אם המערכת זיהתה תקלה - פותחים קריאה אוטומטית לוועד
  if (aiAnalysis.type === 'תקלה') {
    await supabase.from('service_tickets').insert({
      user_id: profile.id,
      building_id: profile.building_id,
      title: aiAnalysis.summary,
      description: message,
      source: 'whatsapp',
      ai_tags: aiAnalysis.tags
    })
  }

  // מחזירים תשובה (בהמשך נחבר את זה שישלח חזרה הודעת וואטסאפ לדייר)
  return new Response("OK", { status: 200 })
})
