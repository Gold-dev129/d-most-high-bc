import readline from 'readline';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { USER_ROLES } from '../config/constants.js';

dotenv.config();

const askQuestion = (rl, query) => {
  return new Promise((resolve) => rl.question(query, resolve));
};

const createAdmin = async () => {
  console.log('\n==================================================');
  console.log('  DMOSTHIGH E-COMMERCE - CREATE INITIAL ADMIN');
  console.log('==================================================\n');

  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI is not set in your .env file.');
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoURI, { serverSelectionTimeoutMS: 5000 });
    console.log('✅ Connected to MongoDB.');
  } catch (err) {
    console.error(`❌ Could not connect to MongoDB: ${err.message}`);
    console.error('Please ensure MongoDB is running or configure a valid MONGODB_URI in your .env file.');
    process.exit(1);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    // Check for CLI flags first (e.g. node createAdmin.js --name "Admin" --email "admin@example.com" --password "secret")
    const args = process.argv.slice(2);
    let name = '';
    let email = '';
    let phone = '';
    let password = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--name' && args[i + 1]) name = args[++i];
      if (args[i] === '--email' && args[i + 1]) email = args[++i];
      if (args[i] === '--phone' && args[i + 1]) phone = args[++i];
      if (args[i] === '--password' && args[i + 1]) password = args[++i];
    }

    if (!name) {
      name = (await askQuestion(rl, 'Enter Admin Name (e.g. Admin User): ')).trim();
    }
    if (!email) {
      email = (await askQuestion(rl, 'Enter Admin Email: ')).trim().toLowerCase();
    }
    if (!phone) {
      phone = (await askQuestion(rl, 'Enter Admin Phone Number: ')).trim();
    }
    if (!password) {
      password = (await askQuestion(rl, 'Enter Admin Password (min 6 chars): ')).trim();
    }

    if (!name || !email || !password) {
      console.error('\n❌ Name, email, and password are all required.');
      process.exit(1);
    }

    if (password.length < 6) {
      console.error('\n❌ Password must be at least 6 characters long.');
      process.exit(1);
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.role === USER_ROLES.ADMIN) {
        console.log(`\nℹ️ User "${email}" is already an administrator.`);
      } else {
        existingUser.role = USER_ROLES.ADMIN;
        await existingUser.save();
        console.log(`\n✅ Existing user "${email}" has been successfully promoted to ADMIN.`);
      }
    } else {
      const newAdmin = await User.create({
        name,
        email,
        phone: phone || '08000000000',
        password,
        role: USER_ROLES.ADMIN,
      });

      console.log('\n==================================================');
      console.log('✅ Admin account created successfully!');
      console.log(`Name:  ${newAdmin.name}`);
      console.log(`Email: ${newAdmin.email}`);
      console.log(`Role:  ${newAdmin.role}`);
      console.log('==================================================\n');
    }
  } catch (error) {
    console.error(`\n❌ Failed to create admin: ${error.message}`);
  } finally {
    rl.close();
    await mongoose.disconnect();
    process.exit(0);
  }
};

createAdmin();
