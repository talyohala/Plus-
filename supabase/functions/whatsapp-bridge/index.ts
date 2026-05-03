import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// פונקציית דמו לחיבור עתידי ל-AI (OpenAI / Claude)
async function analyzeWithAI(message: string) {
  // כאן תהיה הלוגיקה האמיתית. כרגע נחזיר דמו:
  return { type: 'תקלה', summary: 'דיווח מהיר מ-WhatsApp', tags: ['כללי'] }
}

serve(async (req) => {
  const { message, from_number } = await req.json()

  // 1. זיהוי המשתמש לפי מספר הטלפון
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') || '', 
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
  )
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('phone', from_number)
    .single()

  if (!profile) return new Response("User not found", { status: 404 })

  // 2. מנוע AI (מנתח האם מדובר ב: 'תקלה', 'הודעה' או 'בקשה')
  const aiAnalysis = await analyzeWithAI(message)

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

  return new Response("OK", { status: 200 })
})
