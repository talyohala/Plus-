'use client'

export default function AboutPage() {
  return (
    <div className="flex flex-col flex-1 w-full pb-24 px-4 items-center" dir="rtl">
      
      <div className="mt-16 mb-10 text-center flex-1">
        <h1 className="text-6xl font-black text-brand-blue leading-none mb-1 relative -top-1">שכן<span className="text-brand-dark">+</span></h1>
      </div>

      <h2 className="text-2xl font-black text-brand-dark mb-1">אודות המערכת</h2>
      <p className="text-sm font-bold text-brand-blue mb-8">גרסה 1.0.0</p>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-sm text-brand-dark/80 leading-relaxed text-center w-full">
        <p className="mb-4">
          אפליקציית <strong>שכן+</strong> פותחה מתוך חזון לשנות את פני המגורים המשותפים בישראל, ולהפוך בנייני דירות לקהילות מחוברות, חכמות ויעילות.
        </p>
        <p>
          המערכת מספקת תשתית הוליסטית המשלבת פתרונות גבייה חכמים לוועד הבית, לצד רשת חברתית מקומית המאפשרת לדיירים לתקשר, לשתף המלצות על בעלי מקצוע, לפתוח קריאות שירות בזמן אמת ולהעניק עזרה הדדית.
        </p>
      </div>
      
      <div className="mt-10 text-[10px] text-gray-400 font-bold tracking-widest uppercase">
        © כל הזכויות שמורות {new Date().getFullYear()}
      </div>
    </div>
  )
}
