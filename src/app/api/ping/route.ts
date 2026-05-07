import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    status: 'awake', 
    message: 'The server is warm and ready! 🚀',
    time: new Date().toISOString() 
  });
}
