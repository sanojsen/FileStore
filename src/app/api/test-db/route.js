import { NextResponse } from 'next/server';
import { User } from '../../../models/User';

export async function GET() {
  try {
    console.log('Testing database connection...');
    
    // Try to find a user by a common email
    const testUser = await User.findByEmail('sanojsen@gmail.com');
    
    if (testUser) {
      return NextResponse.json({
        success: true,
        message: 'Database connection successful',
        userFound: true,
        userEmail: testUser.email,
        userName: testUser.name,
        hasPassword: !!testUser.password
      });
    } else {
      return NextResponse.json({
        success: true,
        message: 'Database connection successful',
        userFound: false
      });
    }
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
