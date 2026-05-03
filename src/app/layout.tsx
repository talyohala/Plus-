import './globals.css';
import AppManager from '../components/providers/AppManager';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <AppManager>
          {children}
        </AppManager>
      </body>
    </html>
  );
}
