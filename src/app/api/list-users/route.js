import { NextResponse } from 'next/server';
import clientPromise from '../../../lib/mongodb';

export async function GET() {
  try {
    console.log('Listing all users in database...');
    
    const client = await clientPromise;
    const db = client.db('filestores');
    
    // Get all users (without passwords for security)
    const users = await db.collection('users').find({}, { 
      projection: { password: 0 } // Exclude password field
    }).toArray();
    
    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      users: users
    });
  } catch (error) {
    console.error('Error listing users:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
