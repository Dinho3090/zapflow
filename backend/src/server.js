// ─────────────────────────────────────────────────────────
// ZapFlow Backend — server.js
// ─────────────────────────────────────────────────────────
import Fastify       from 'fastify';
import cors          from '@fastify/cors';
import multipart     from '@fastify/multipart';

import { authMiddleware, adminMiddleware } from './middleware/auth.js';
import { whatsappRoutes }   from './routes/whatsapp.js';
import { contactRoutes }    from './routes/contacts.js';
import { campaignRoutes }   from './routes/campaigns.js';
import { automationRoutes } from './routes/automations.js';
import { mediaRoutes }      from './routes/media.js';
import { webhookRoutes }    from './routes/webhooks.js';
import { adminRoutes }      from './routes/admin.js';
import { worker, schedulerWorker } from './workers/campaignWorker.js';

const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
  },
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN || true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-admin-key','x-tags'],
});

await app.register(multipart, { limits: { fileSize: 64 * 1024 * 1024 } });

// Health
app.get('/health', async () => ({
  status: 'ok', version: '1.0.0', ts: new Date().toISOString(),
  workers: {
    campaign:  worker.isRunning()          ? 'running' : 'stopped',
    scheduler: schedulerWorker.isRunning() ? 'running' : 'stopped',
  },
}));

// API autenticada
await app.register(async (api) => {
  api.addHook('preHandler', authMiddleware);
  await api.register(whatsappRoutes,   { prefix: '/whatsapp' });
  await api.register(contactRoutes,    { prefix: '/contacts' });
  await api.register(campaignRoutes,   { prefix: '/campaigns' });
  await api.register(automationRoutes, { prefix: '/automations' });
  await api.register(mediaRoutes,      { prefix: '/media' });
}, { prefix: '/api' });

// Webhooks públicos (Evolution API)
await app.register(webhookRoutes, { prefix: '/webhook' });

// Admin
await app.register(async (adm) => {
  adm.addHook('preHandler', adminMiddleware);
  await adm.register(adminRoutes);
}, { prefix: '/admin' });

app.setNotFoundHandler((req, reply) =>
  reply.code(404).send({ error: 'Rota não encontrada', path: req.url }));

app.setErrorHandler((err, req, reply) => {
  app.log.error(err);
  reply.code(err.statusCode || 500).send({ error: err.message || 'Erro interno' });
});

// Graceful shutdown
const shutdown = async (sig) => {
  console.log(`\n[Server] ${sig} — encerrando...`);
  await worker.close();
  await schedulerWorker.close();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

const PORT = parseInt(process.env.PORT || '3001', 10);
try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\n🚀 ZapFlow API  →  http://0.0.0.0:${PORT}\n`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
