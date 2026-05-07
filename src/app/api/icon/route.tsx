import { ImageResponse } from 'next/og'
export const runtime = 'edge'
export async function GET() {
  return new ImageResponse(
    (
      <div style={{
        background: '#1D4ED8',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '100px'
      }}>
        <span style={{
          color: 'white',
          fontSize: '140px',
          fontWeight: '900',
          fontFamily: 'sans-serif',
          letterSpacing: '-5px'
        }}>שכן+</span>
      </div>
    ),
    { width: 512, height: 512 }
  )
}
