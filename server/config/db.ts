import mongoose from 'mongoose';

let isConnected = false;

export const connectDatabase = async (): Promise<boolean> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[VED DB WARNING] MONGODB_URI environment variable is not defined.');
    console.info('[VED DB INFO] Backend is operating with built-in seeded storage until MongoDB Atlas URI is provided.');
    return false;
  }

  if (isConnected) {
    return true;
  }

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    isConnected = conn.connection.readyState === 1;
    console.log(`[VED DB SUCCESS] Connected to MongoDB Atlas host: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error('[VED DB ERROR] Failed to connect to MongoDB Atlas:', error instanceof Error ? error.message : error);
    console.info('[VED DB INFO] Continuing with in-memory fallback store to ensure zero downtime.');
    return false;
  }
};

export const getDbStatus = () => ({
  isConnected,
  readyState: mongoose.connection.readyState,
  host: isConnected ? mongoose.connection.host : 'fallback-store',
});
