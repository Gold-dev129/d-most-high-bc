import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoURI = process.env.MONGODB_URI;

  if (!mongoURI) {
    console.error('❌ MONGODB_URI is not defined in environment variables.');
    process.exit(1);
  }

  const attemptConnect = async (retries = 3) => {
    try {
      const conn = await mongoose.connect(mongoURI, {
        serverSelectionTimeoutMS: 3000,
        connectTimeoutMS: 3000,
      });
      console.log(`✅ MongoDB Connected: ${conn.connection.host} [Database: ${conn.connection.name}]`);
    } catch (error) {
      console.error(`❌ MongoDB Connection Error: ${error.message}`);
      if (retries > 0) {
        console.log(`🔄 Retrying MongoDB connection in 2 seconds... (${retries} retries remaining)`);
        setTimeout(() => attemptConnect(retries - 1), 2000);
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️ Tip: Ensure MongoDB service is running or check internet connectivity to Atlas.');
        }
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        }
      }
    }
  };

  await attemptConnect();
};
