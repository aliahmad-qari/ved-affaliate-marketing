import express, { Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import campaignRoutes from './routes/campaignRoutes.ts';
import supportRoutes from './routes/supportRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import partnerRoutes from './routes/partnerRoutes.ts';
import adminAuthRoutes from './routes/adminAuthRoutes.ts';
import adminRoutes from './routes/adminRoutes.ts';
import vendorWebhookRoutes from './routes/vendorWebhookRoutes.ts';
import { notFoundHandler, globalErrorHandler } from './middleware/errorHandler.ts';
import { getDbStatus } from './config/db.ts';

const getAllowedOrigins = (): Set<string> => {
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim().replace(/\/$/, ''))
    .filter(Boolean);
  const localOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return new Set([...configuredOrigins, ...localOrigins]);
};

export const createApp = (): Express => {
  const app = express();

  // Middleware
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        connectSrc: ["'self'", 'https:'],
      },
    },
  }));
  app.use(
    cors({
      origin(origin, callback) {
        callback(null, !origin || getAllowedOrigins().has(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use((req, res, next) => {
    const origin = req.get('origin');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (isMutation && origin && !getAllowedOrigins().has(origin)) {
      res.status(403).json({ success: false, message: 'Request origin is not allowed.' });
      return;
    }
    next();
  });

  app.use(cookieParser());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Health Check
  app.get('/api/health', (_req, res) => {
    const dbStatus = getDbStatus();
    res.status(dbStatus.isConnected ? 200 : 503).json({
      success: dbStatus.isConnected,
      service: 'VED AFFILIATE PVT. LIMITED API',
      status: dbStatus.isConnected ? 'healthy' : 'unavailable',
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
  app.use('/api/admin/auth', adminAuthRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/webhooks', vendorWebhookRoutes);

  // Error handling
  app.use('/api/*', notFoundHandler);
  app.use(globalErrorHandler);

  return app;
};

export const app = createApp();
