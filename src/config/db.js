import mongoose from 'mongoose';

export const connectDB = async () => {
  const rawMongoURI = process.env.MONGODB_URI;

  if (!rawMongoURI) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  // Strip potential surrounding quotes if pasted into dashboard with quotes
  const mongoURI = rawMongoURI.trim().replace(/^["']|["']$/g, '');

  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 15000,
        connectTimeoutMS: 15000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);
      return;
    } catch (error) {
      console.error(`❌ MongoDB Connection Error (attempt ${attempt}/${maxRetries}): ${error.message}`);
      if (attempt < maxRetries) {
        console.log(`🔄 Retrying MongoDB connection in 3 seconds...`);
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } else {
        if (process.env.NODE_ENV === 'production') {
          console.error('❌ Failed to connect to MongoDB after multiple attempts. Check Atlas Network Access (0.0.0.0/0).');
          process.exit(1);
        } else {
          console.warn('⚠️ Tip: Ensure MongoDB service is running or check internet connectivity to Atlas.');
        }
      }
    }
  }
};
