import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const testDb = async () => {
  console.log('Testing connection to MongoDB Atlas...');
  console.log('URI:', process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@'));

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`✅ SUCCESS! Connected to MongoDB Atlas.`);
    console.log(`Host: ${conn.connection.host}`);
    console.log(`Database Name: ${conn.connection.name}`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Connection failed: ${error.message}`);
    process.exit(1);
  }
};

testDb();
