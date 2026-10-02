import mongoose from 'mongoose';

let isConnected = false;

export const connectDatabase = async (): Promise<boolean> => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn('[VED DB WARNING] MONGODB_URI environment variable is not defined.');
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
    return false;
  }
};

export const getDbStatus = () => {
  const connected = mongoose.connection.readyState === 1;
  return {
    isConnected: connected,
    readyState: mongoose.connection.readyState,
    host: connected ? mongoose.connection.host : 'disconnected',
  };
};
