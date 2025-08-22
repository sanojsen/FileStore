import dotenv from 'dotenv';
import mongoose from 'mongoose';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function checkUsers() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected successfully!');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const users = await usersCollection.find().toArray();
    
    console.log('Users in database:');
    users.forEach(user => {
      console.log({
        id: user._id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt
      });
    });
    
    await mongoose.disconnect();
    console.log('Check completed');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUsers();
