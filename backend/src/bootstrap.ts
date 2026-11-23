import { authConfig } from './auth/config';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { AppModule } from './app.module';
import { readEnvironment } from './environment';
import { Errors } from './common/errors';
export async function createApp() {
  const env = readEnvironment();
  const auth = authConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: false, logger: ['log', 'warn'] });
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use((req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    const webhook = req.method === 'POST' && req.path === '/api/payments/razorpay/webhook';
    if (!webhook && ((origin && !env.origins.includes(origin)) || (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && (!origin || !env.origins.includes(origin) || req.headers['x-csrf-protection'] !== '1')))) {
      res.status(403).json({ error: { status: 403, message: 'Origin or CSRF check failed.' } }); return;
    }
    next();
  });
  app.enableCors({ origin: env.origins, credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Protection', 'Authorization'] });
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: auth.ipLimit, skip: req => req.method === 'GET' || req.method === 'OPTIONS', standardHeaders: 'draft-8', legacyHeaders: false, message: { error: { status: 429, message: 'Too many attempts. Please try again later.' } } }));
  app.use(json({ limit: '128kb', verify: (req, _res, body) => { if (req.url?.split('?')[0] === '/api/payments/razorpay/webhook') (req as import('express').Request & { rawBody?: Buffer }).rawBody = Buffer.from(body); } }));
  app.useGlobalFilters(new Errors());
  app.enableShutdownHooks();
  return app;
}
