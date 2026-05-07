import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = parseInt(searchParams.get('size') || '512')

  return new ImageResponse(
    (
      <div
        style={{
          background: '#1D4ED8',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: size * 0.28,
          fontWeight: 900,
          fontFamily: 'sans-serif'
        }}
      >
        שכן+
      </div>
    ),
    { width: size, height: size }
  )
}
