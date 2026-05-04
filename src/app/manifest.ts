import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'שכן+ | מנהל בניין דיגיטלי',
    short_name: 'שכן+',
    description: 'האפליקציה החכמה לניהול ועד הבית',
    start_url: '/',
    display: 'standalone',
    background_color: '#F0F2F5',
    theme_color: '#2D5AF0',
    dir: 'rtl',
    lang: 'he',
    icons: [
      {
        src: 'https://api.dicebear.com/8.x/shapes/svg?seed=shachen&backgroundColor=2D5AF0',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: 'https://api.dicebear.com/8.x/shapes/svg?seed=shachen&backgroundColor=2D5AF0',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}
