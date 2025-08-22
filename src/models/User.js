import clientPromise from '../lib/mongodb';
import bcrypt from 'bcryptjs';
export class User {
  static async create(userData) {
    try {
      const client = await clientPromise;
      const db = client.db('filestores');
      // Hash password before saving
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      const user = {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const result = await db.collection('users').insertOne(user);
      return { ...user, _id: result.insertedId };
    } catch (error) {
      console.error('Error in User.create:', error);
      throw error;
    }
  }
  static async findByEmail(email) {
    try {
      const client = await clientPromise;
      const db = client.db('filestores');
      const user = await db.collection('users').findOne({ email });
      return user;
    } catch (error) {
      console.error('Error in User.findByEmail:', error);
      throw error;
    }
  }
  static async validatePassword(plainPassword, hashedPassword) {
    try {
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      return isValid;
    } catch (error) {
      console.error('Error in password validation:', error);
      return false;
    }
  }
  static async findById(id) {
    const client = await clientPromise;
    const db = client.db('filestores');
    return await db.collection('users').findOne({ _id: id });
  }
}