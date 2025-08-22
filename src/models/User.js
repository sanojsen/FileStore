import clientPromise from '../lib/mongodb';
import bcrypt from 'bcryptjs';

export class User {
  static async create(userData) {
    try {
      console.log('User.create called with:', { name: userData.name, email: userData.email });
      const client = await clientPromise;
      const db = client.db('filestores');
      
      // Hash password before saving
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);
      console.log('Password hashed successfully');
      
      const user = {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('Inserting user into database...');
      const result = await db.collection('users').insertOne(user);
      console.log('User created with ID:', result.insertedId);
      
      return { ...user, _id: result.insertedId };
    } catch (error) {
      console.error('Error in User.create:', error);
      throw error;
    }
  }
  
  static async findByEmail(email) {
    try {
      console.log('User.findByEmail called with:', email);
      const client = await clientPromise;
      const db = client.db('filestores');
      
      const user = await db.collection('users').findOne({ email });
      console.log('Database query result:', user ? 'User found' : 'User not found');
      return user;
    } catch (error) {
      console.error('Error in User.findByEmail:', error);
      throw error;
    }
  }
  
  static async validatePassword(plainPassword, hashedPassword) {
    try {
      console.log('Password validation called');
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      console.log('Password validation result:', isValid);
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
