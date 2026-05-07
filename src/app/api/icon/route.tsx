import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const size = parseInt(searchParams.get('size') || '512')

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(to bottom right, #1D4ED8, #3B82F6)',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: size * 0.2 + 'px',
          color: 'white',
          fontSize: size * 0.45,
          fontWeight: 900,
        }}
      >
        ש+
      </div>
    ),
    { width: size, height: size }
  )
}
