import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import campaignRoutes from './routes/campaignRoutes.ts';
import supportRoutes from './routes/supportRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import partnerRoutes from './routes/partnerRoutes.ts';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.ts';
import { getDbStatus } from './config/db.ts';

export const createApp = (): Express => {
  const app = express();

  // Middleware
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (_req, res) => {
    const dbStatus = getDbStatus();
    res.status(200).json({
      success: true,
      service: 'VED AFFILIATE PVT. LIMITED API',
      status: 'healthy',
      milestone: 'MILESTONE_3',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    });
  });

  // Public Routes
  app.use('/api/public/campaigns', campaignRoutes);
  app.use('/api/public/support', supportRoutes);

  // Authentication & Partner Profile Routes (Milestone 2)
  app.use('/api/auth', authRoutes);
  app.use('/api/partner', partnerRoutes);

  // Error handling
  app.use('/api/*', notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};

export const app = createApp();
