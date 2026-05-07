import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'שכן+',
    short_name: 'שכן+',
    description: 'האפליקציה החכמה לניהול ועד הבית',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAFC',
    theme_color: '#1D4ED8',
    icons: [
      {
        src: 'https://api.dicebear.com/8.x/initials/png?seed=%D7%A9%D7%A4&backgroundColor=1D4ED8&textColor=ffffff',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://api.dicebear.com/8.x/initials/png?seed=%D7%A9%D7%A4&backgroundColor=1D4ED8&textColor=ffffff',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
