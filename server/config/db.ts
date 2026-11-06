import mongoose from 'mongoose';

let isConnected = false;

export function databaseConnectionOptions(environment = process.env.NODE_ENV) {
  const production = environment === 'production';
  return {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    // Production indexes and collections are prepared through reviewed operations, not app startup.
    // Preserve Mongoose's existing development/test initialization behavior.
    autoIndex: !production,
    autoCreate: !production,
  };
}

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
    const conn = await mongoose.connect(mongoUri, databaseConnectionOptions());

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
