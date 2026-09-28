import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDbConnection } from './db/db';
import { seedDatabase } from './db/seed';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { parcelsRouter } from './routes/parcels';
import { documentsRouter } from './routes/documents';
import { verificationsRouter } from './routes/verifications';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security & CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'];

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, tsx tests, SSR)
      if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin) || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in deployment mode
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logger for API calls
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Mount API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/parcels', parcelsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/verifications', verificationsRouter);

// Root informational endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'DHAROHAR Revenue System Backend',
    version: '1.0.0',
    phase: 'Phase 4 - Authoritative Backend + Security + Hash Chaining',
    description: 'Spatial Land Registry & Intelligent Land Record Verification System',
    endpoints: [
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/auth/users',
      'GET  /api/parcels',
      'GET  /api/parcels/:id',
      'POST /api/parcels',
      'PATCH /api/parcels/:id',
      'POST /api/parcels/:id/validate',
      'GET  /api/parcels/:id/documents',
      'POST /api/parcels/:id/documents',
      'GET  /api/parcels/:id/field-inspections',
      'POST /api/parcels/:id/field-inspections',
      'POST /api/parcels/:id/verify',
      'GET  /api/parcels/:id/audit',
      'DELETE /api/parcels/:id',
      'GET  /api/documents',
      'GET  /api/documents/:id',
      'POST /api/documents',
      'GET  /api/verifications/audit-logs',
      'GET  /api/verifications/audit-logs/verify-chain',
      'POST /api/verifications/field-inspection',
      'POST /api/verifications/seal',
      'GET  /api/health',
    ],
  });
});

// 404 handler for unknown routes
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
  });
});

// Global safe error handler (never leaks internal stack traces)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[UNHANDLED ERROR]', err);
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred on the server.',
    },
  });
});

// Startup lifecycle
async function startServer() {
  console.log('==================================================');
  console.log('  DHAROHAR Land Record Digitization Server       ');
  console.log('  Phase 4: Authoritative Backend + Security Engine ');
  console.log('==================================================');

  try {
    await initDbConnection();
    await seedDatabase();
  } catch (err: any) {
    console.warn('[DHAROHAR DB] Initialization note:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[DHAROHAR SERVER] Running on http://localhost:${PORT}`);
    console.log(`[DHAROHAR SERVER] Health check: http://localhost:${PORT}/api/health`);
    console.log(`[DHAROHAR SERVER] Auth check: http://localhost:${PORT}/api/auth/users`);
    console.log(`[DHAROHAR SERVER] REST APIs ready for React UI integration.`);
  });
}

import { fileURLToPath } from 'url';
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  startServer();
}

export { app, startServer };
