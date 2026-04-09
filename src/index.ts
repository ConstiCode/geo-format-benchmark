import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { experimentsRouter } from './routes/experiments.js';
import { queriesRouter } from './routes/queries.js';

const app = express();

// --- Middleware ---

app.use(cors({ origin: config.CORS_ORIGIN }));
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// --- Routes ---

app.use('/api/queries', queriesRouter);
app.use('/api/experiments', experimentsRouter);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    uptime: process.uptime(),
  });
});

// --- Error handling ---

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal server error',
  });
});

// --- Start server ---

const server = app.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
});

// --- Graceful shutdown ---

function shutdown() {
  console.log('Shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
