'use client'
import { useState } from 'react'

const faqs = [
  { q: "כיצד אוכל להתחבר לבניין המגורים שלי?", a: "בעת ההרשמה עליך להזין קוד בניין או לבקש קישור הזמנה ישיר מוועד הבית." },
  { q: "האם פרטי כרטיס האשראי שלי שמורים בצורה בטוחה?", a: "כן. פרטי האשראי אינם נשמרים בשרתים שלנו בשום שלב, אלא עוברים סליקה מאובטחת תחת התקן המחמיר ביותר דרך חברת סליקה מוכרת." },
  { q: "כיצד אוכל לעדכן את מספר הדירה והקומה?", a: "היכנסו ללשונית 'הפרופיל שלי' ולחצו על הכפתור 'עדכון פרטים מזהים'." },
  { q: "האם אוכל למחוק מודעה שפרסמתי?", a: "כן, בלחיצה על סמל הפעולות (שלוש נקודות) ליד המודעה, תופיע אפשרות המחיקה." }
]

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const openWhatsAppSupport = () => {
    window.open(`https://wa.me/972500000000?text=${encodeURIComponent("שלום לצוות התמיכה הטכנית של שכן+, אני זקוק לעזרה באפליקציה.")}`, '_blank')
  }

  return (
    <div className="flex flex-col flex-1 w-full pb-24 px-4" dir="rtl">
      <div className="mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">תמיכה טכנית ושאלות</h2>
        <p className="text-xs text-brand-gray mt-1">אנחנו כאן לרשותכם לכל שאלה או תקלה טכנית.</p>
      </div>

      <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-3xl p-6 mb-8 text-center">
        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-brand-blue">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
        </div>
        <h3 className="font-black text-brand-dark text-lg mb-2">זקוקים לעזרה מיידית?</h3>
        <p className="text-sm text-brand-gray mb-5">צוות הפיתוח זמין בהודעות לטיפול בתקלות טכניות.</p>
        <button onClick={openWhatsAppSupport} className="w-full bg-[#25D366] text-white font-bold py-3.5 rounded-xl shadow-[0_4px_15px_rgba(37,211,102,0.3)] active:scale-95 transition flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          שליחת הודעה לצוות
        </button>
      </div>

      <h3 className="font-black text-brand-dark text-lg mb-3">שאלות נפוצות</h3>
      <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
        {faqs.map((faq, idx) => (
          <div key={idx} className="border-b border-gray-50 last:border-0">
            <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full text-right p-4 font-bold text-sm text-brand-dark flex justify-between items-center hover:bg-gray-50 transition">
              {faq.q}
              <svg className={`w-5 h-5 text-brand-blue transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            {openFaq === idx && (
              <div className="p-4 pt-0 text-sm text-brand-gray bg-gray-50/50">
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
