import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// הסוגריים המסולסלים הוסרו מהייבוא
import AppManager from "../components/providers/AppManager";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "שכן+",
  description: "ניהול קהילה חכם",
  // הצבעה לקובץ המניפסט הסטטי ב-public
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "שכן+",
  },
  icons: {
    // שימוש ב-SVG התקני גם לאפל
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        {/* תגיות מטא חובה לאלץ מצב אפליקציה */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <AppManager>{children}</AppManager>
      </body>
    </html>
  );
}
