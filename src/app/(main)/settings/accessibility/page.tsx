'use client'

export default function AccessibilityPage() {
  return (
    <div className="flex flex-col flex-1 w-full pb-24 px-4" dir="rtl">
      <div className="mb-6 mt-2">
        <h2 className="text-2xl font-black text-brand-dark">הצהרת נגישות</h2>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-xs text-brand-dark/90 leading-relaxed space-y-4">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm9 7h-6v13h-2v-6h-2v6H9V9H3V7h18v2z"></path>
          </svg>
        </div>
        
        <p>
          מפעילת האפליקציה רואה חשיבות עליונה במתן שירות שוויוני, מכובד ונגיש לכלל המשתמשים, לרבות אנשים עם מוגבלויות. אנו פועלים באופן שוטף להתאמת האפליקציה להוראות חוק שוויון זכויות לאנשים עם מוגבלות, התשנ"ח-1998, ולתקנות שהותקנו מכוחו.
        </p>

        <h3 className="font-bold text-brand-dark text-sm pt-2">רמת הנגישות ופעולות שבוצעו</h3>
        <p>
          אנו שואפים ליישם את הנחיות התקן הישראלי לנגישות תכנים באינטרנט (ת"י 5568) ברמה AA. להלן חלק מהפעולות שבוצעו:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li><strong>תאימות מסכים:</strong> תכנון רספונסיבי מלא המותאם למגוון רזולוציות ולמכשירים ניידים.</li>
          <li><strong>ניגודיות (Contrast):</strong> שימוש בצבעים בעלי יחס ניגודיות תקין להקלה על כבדי ראייה.</li>
          <li><strong>טקסט חלופי (Alt Text):</strong> שילוב חיווי טקסטואלי לתמונות ולאייקונים בעלי משמעות פונקציונלית.</li>
          <li><strong>הגדלת טקסט:</strong> תמיכה מלאה בהגדרות הגדלת הגופן במערכות ההפעלה (iOS / Android) ללא פגיעה בממשק.</li>
          <li><strong>ניווט עקבי:</strong> מבנה התפריטים והכפתורים שומר על עקביות לאורך כל מסכי האפליקציה (Bottom Navigation bar).</li>
        </ul>

        <h3 className="font-bold text-brand-dark text-sm pt-2">סייגים לנגישות ותוכן צד ג'</h3>
        <p>
          חרף מאמצינו להנגיש את כלל מרכיבי האפליקציה, ייתכן שיתגלו רכיבים או אזורים ספציפיים שאינם נגישים במלואם. כמו כן, האפליקציה מאפשרת העלאת תוכן גולשים (User Generated Content) כגון טקסטים חופשיים, תמונות ומדיה על ידי המשתמשים. המפעילה אינה יכולה להבטיח כי תכנים המועלים על ידי צדדים שלישיים יהיו נגישים באופן מלא.
        </p>

        <h3 className="font-bold text-brand-dark text-sm pt-2">יצירת קשר בנושא נגישות</h3>
        <p>
          אם במהלך הגלישה והשימוש באפליקציה נתקלתם בקושי או בפער נגישותי, אנו נשמח לקבל על כך משוב כדי שנוכל לתקן ולשפר את המערכת.
          ניתן לפנות לרכז הנגישות של המערכת באמצעות מערכת יצירת הקשר הפנימית באפליקציה או באמצעות ועד הבית הרשום של בניינכם.
        </p>
      </div>
    </div>
  )
}
