const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function clearDatabase() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('🗑️  Starting database cleanup...');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`, collections.map(c => c.name));
    
    // Clear each collection
    for (const collection of collections) {
      const result = await db.collection(collection.name).deleteMany({});
      console.log(`✅ Cleared ${collection.name}: ${result.deletedCount} documents deleted`);
    }
    
    console.log('🎉 Database cleared successfully!');
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await client.close();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('⚠️  Are you sure you want to DELETE ALL DATA from the database? Type "yes" to confirm: ', (answer) => {
  if (answer.toLowerCase() === 'yes') {
    clearDatabase();
  } else {
    console.log('❌ Operation cancelled.');
  }
  rl.close();
});
