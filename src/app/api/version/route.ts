
import { NextResponse } from 'next/server';

// This value is set once when the server starts.
const serverStartupTime = new Date().toISOString();

export async function GET() {
  return NextResponse.json({ version: serverStartupTime });
}
