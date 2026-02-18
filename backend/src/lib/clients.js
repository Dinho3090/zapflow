// ─────────────────────────────────────────────────────────
// lib/clients.js — Conexões compartilhadas
// ─────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import IORedis from 'ioredis';
import axios from 'axios';

// ── Supabase (service key — backend only) ─────────────────
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Redis ─────────────────────────────────────────────────
export const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => console.log('✅ Redis conectado'));
redis.on('error',   (e) => console.error('❌ Redis erro:', e.message));

// ── Evolution API ─────────────────────────────────────────
export const evolution = axios.create({
  baseURL: process.env.EVOLUTION_URL || 'http://localhost:8080',
  headers: { apikey: process.env.EVOLUTION_API_KEY },
  timeout: 30_000,
});

// Helper: monta nome de instância a partir do tenant ID
export function instanceName(tenantId) {
  return `zf_${tenantId.replace(/-/g, '').slice(0, 20)}`;
}
