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
import { getPublicStats } from './controllers/publicStatsController.ts';
import { publicSiteSettings } from './controllers/siteSettingsController.ts';
import rateLimit from 'express-rate-limit';
import { getPublicSuccessfulLeads } from './controllers/publicLeaderboardController.ts';

const getAllowedOrigins = (): Set<string> => {
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
  // The public customer registration page is served by the API, but the
  // branded site may submit it from either canonical production hostname.
  // Keep these explicit origins so a missing FRONTEND_URL cannot block live
  // registrations; never use wildcard CORS.
  const productionOrigins = [
    'https://vedaffiliatepvtltd.com',
    'https://www.vedaffiliatepvtltd.com',
  ];
  const localOrigins = process.env.NODE_ENV === 'production'
    ? []
    : ['http://localhost:3000', 'http://127.0.0.1:3000'];

  return new Set([...configuredOrigins, ...productionOrigins, ...localOrigins]);
};

function normalizeOrigin(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === 'null') return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

function isAllowedOrigin(origin: string): boolean {
  const normalized = normalizeOrigin(origin);
  return normalized !== undefined && getAllowedOrigins().has(normalized);
}

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
        callback(null, !origin || isAllowedOrigin(origin));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use((req, res, next) => {
    const origin = req.get('origin');
    const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    let renderOrigin: string | undefined;
    try {
      const renderUrl = new URL(process.env.RENDER_EXTERNAL_URL || '');
      if (['http:', 'https:'].includes(renderUrl.protocol)) renderOrigin = renderUrl.origin;
    } catch { /* Local development and other hosts may not define a Render URL. */ }
    // The public capture form is served by this API, including when the frontend is hosted separately.
    const isCaptureFormPost = req.method === 'POST' && /^\/api\/public\/campaigns\/[^/]+\/(?:go|continue)$/.test(req.path)
      && (origin === `${req.protocol}://${req.get('host')}` || (renderOrigin !== undefined && origin === renderOrigin));
    if (isMutation && origin && !isAllowedOrigin(origin) && !isCaptureFormPost) {
      res.status(403).json({
        success: false,
        message: 'We could not verify this registration request. Please reopen the original campaign link and try again.',
      });
      return;
    }
    next();
  });

  app.use(cookieParser());
  app.use('/reset-password', (_req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next();
  });
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
  app.get('/api/public/stats', getPublicStats);
  app.get('/api/public/successful-leads', rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: true, legacyHeaders: false }), getPublicSuccessfulLeads);
  app.get('/api/public/site-settings', publicSiteSettings);
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
