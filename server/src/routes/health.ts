import { Router, Request, Response } from 'express';
import { getDbHealth } from '../db/db';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  const health = getDbHealth();
  res.json({
    status: health.connected ? 'healthy' : 'degraded',
    service: 'DHAROHAR Revenue Backend',
    storageMode: health.storageMode,
    postgisAvailable: health.postgisAvailable,
    postgisVersion: health.postgisVersion || null,
    database: health.database,
    uptimeSeconds: health.uptimeSeconds,
    timestamp: new Date().toISOString(),
    message: health.storageMode === 'postgres-postgis'
      ? 'Connected to PostgreSQL with PostGIS spatial extension.'
      : 'Operating in EXPLICIT DEV-FALLBACK mode. Local in-memory repository active.',
  });
});
