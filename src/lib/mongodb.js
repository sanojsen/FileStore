import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

// Production-optimized connection options
const options = {
  maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
  minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
  serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 30000 : 10000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  maxIdleTimeMS: 30000,
  family: 4, // Use IPv4, skip trying IPv6
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  compressors: ['snappy', 'zlib'],
  heartbeatFrequencyMS: 10000,
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
// Mongoose connection for the new models with production optimizations
export const connectToDatabase = async () => {
  // Check if already connected
  if (mongoose.connections[0].readyState === 1) {
    return mongoose.connections[0];
  }
  
  // Check if connection is in progress
  if (mongoose.connections[0].readyState === 2) {
    // Connection is connecting, wait for it
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 30000);
      
      mongoose.connections[0].once('connected', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      mongoose.connections[0].once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    return mongoose.connections[0];
  }
  
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔌 Attempting to connect to MongoDB...');
    }
    
    const mongooseOptions = {
      bufferCommands: true,
      maxPoolSize: process.env.NODE_ENV === 'production' ? 20 : 10,
      minPoolSize: process.env.NODE_ENV === 'production' ? 5 : 1,
      serverSelectionTimeoutMS: process.env.NODE_ENV === 'production' ? 30000 : 10000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxIdleTimeMS: 30000,
      family: 4,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      compressors: ['snappy', 'zlib'],
    };
    
    await mongoose.connect(uri, mongooseOptions);
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ MongoDB connected successfully');
    }
    
    // Set up connection event listeners for production monitoring
    mongoose.connection.on('error', (error) => {
      console.error('❌ MongoDB connection error:', error);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    return mongoose.connections[0];
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    
    // Enhanced error handling for production
    if (process.env.NODE_ENV !== 'production') {
      // If it's an SSL error, provide helpful guidance
      if (error.message.includes('SSL') || error.message.includes('TLS')) {
        console.error('💡 This appears to be an SSL/TLS connection issue.');
        console.error('   Possible solutions:');
        console.error('   1. Check your internet connection');
        console.error('   2. Verify your MongoDB Atlas cluster is running');
        console.error('   3. Check if your IP is whitelisted in Atlas');
        console.error('   4. Verify the connection string is correct');
      }
    }
    
    throw error;
  }
};
export default clientPromise;
