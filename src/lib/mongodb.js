import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local');
}
const options = {};
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
    await mongoose.connect(uri, {
      bufferCommands: false,
    });
    return mongoose.connections[0];
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};
export default clientPromise;