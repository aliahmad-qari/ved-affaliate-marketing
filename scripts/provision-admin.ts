import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { AdminUser } from '../server/models/AdminUser.ts';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
const fullName = process.env.ADMIN_NAME?.trim();

if (!email || !password || !fullName || password.length < 12) {
  throw new Error('Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD (minimum 12 characters) for provisioning.');
}
if (!process.env.MONGODB_URI) {
  throw new Error('MONGODB_URI is required to provision an admin.');
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const existing = await AdminUser.findOne({ email }).exec();
  if (!existing && await AdminUser.countDocuments() >= 3) {
    throw new Error('The maximum of 3 Admin users has been reached.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await AdminUser.findOneAndUpdate(
    { email },
    { $set: { fullName, passwordHash, status: 'ACTIVE' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  console.log(`Admin provisioned for ${email}. No password was printed.`);
} finally {
  await mongoose.disconnect();
}