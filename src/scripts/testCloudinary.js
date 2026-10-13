import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

async function testCloudinary() {
  console.log('Testing Cloudinary connection with:');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  console.log('API Key:', process.env.CLOUDINARY_API_KEY);

  try {
    const result = await cloudinary.api.ping();
    console.log('✅ SUCCESS! Cloudinary ping returned:', JSON.stringify(result));
  } catch (error) {
    console.error('❌ Cloudinary connection failed:', error.message);
  }
}

testCloudinary();
