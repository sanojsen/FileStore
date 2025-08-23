import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

// Enhanced connection options to handle SSL/TLS issues
const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
};

let client;
let clientPromise;
if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}
// Mongoose connection for the new models
export const connectToDatabase = async () => {
  if (mongoose.connections[0].readyState) {
    return mongoose.connections[0];
  }
  
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    
    await mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Use IPv4, skip trying IPv6
      retryWrites: true,
      retryReads: true,
    });
    
    console.log('✅ MongoDB connected successfully');
    return mongoose.connections[0];
    
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // If it's an SSL error, provide helpful guidance
    if (error.message.includes('SSL') || error.message.includes('TLS')) {
      console.error('💡 This appears to be an SSL/TLS connection issue.');
      console.error('   Possible solutions:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify your MongoDB Atlas cluster is running');
      console.error('   3. Check if your IP is whitelisted in Atlas');
      console.error('   4. Verify the connection string is correct');
    }
    
    throw error;
  }
};
export default clientPromise;
