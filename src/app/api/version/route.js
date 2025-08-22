import { NextResponse } from 'next/server';
import packageJson from '../../../../package.json';

export async function GET() {
  try {
    return NextResponse.json({ 
      version: packageJson.version,
      name: packageJson.name
    });
  } catch (error) {
    console.error('Error getting version:', error);
    return NextResponse.json(
      { error: 'Failed to get version' },
      { status: 500 }
    );
  }
}
