import dotenv from 'dotenv';
import path from 'path';
import express from 'express';
import { app } from './app.ts';
import { connectDatabase } from './config/db.ts';
import { ensureSeededData } from './controllers/campaignController.ts';

dotenv.config();

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

export const startServer = async () => {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters in production.');
    }
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI must be configured in production.');
    }
  }

  // Connect to MongoDB Atlas
  const connected = await connectDatabase();
  if (!connected && process.env.NODE_ENV === 'production') {
    throw new Error('MongoDB is unavailable; refusing to start with volatile storage in production.');
  }
  if (connected) {
    await ensureSeededData();
  }

  // If in production and dist exists, serve frontend static files
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`VED AFFILIATE PVT. LIMITED API Server running`);
    console.log(`Port: ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`====================================================`);
  });

  return server;
};

// Start if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Fatal server start error:', err);
    process.exit(1);
  });
}
