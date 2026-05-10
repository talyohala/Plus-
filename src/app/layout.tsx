import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppManager from "../components/providers/AppManager";

const inter = Inter({ subsets: ["latin"] });

// ביטול מוחלט של קאש סטטי למניעת זליגת סשן בין דפדפנים
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const viewport: Viewport = {
  themeColor: "#1D4ED8",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "שכן+",
  description: "ניהול קהילה חכם",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "שכן+",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .catch(err => console.log('SW registration skipped'));
            });
          }
        `}} />
      </head>
      <body className={inter.className}>
        <AppManager>{children}</AppManager>
      </body>
    </html>
  );
}
