// routes/register.js — Cria tenant após signup do Supabase Auth
import { supabase } from '../lib/clients.js';

export async function registerRoutes(app) {
  // POST /api/register (público - sem auth middleware)
  app.post('/register', async (req, reply) => {
    const { auth_user_id, name, email } = req.body;

    if (!auth_user_id || !name || !email) {
      return reply.code(400).send({ error: 'Campos obrigatórios: auth_user_id, name, email' });
    }

    // Verifica se já existe
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('auth_user_id', auth_user_id)
      .single();

    if (existing) {
      return reply.send({ id: existing.id, message: 'Tenant já existe' });
    }

    // Cria com plano Trial
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias grátis

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({
        auth_user_id,
        name,
        email,
        plan: 'trial',
        status: 'trial',
        messages_limit_month: 500,
        contacts_limit: 200,
        campaigns_limit: 2,
        min_delay_seconds: 15,
        subscription_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      return reply.code(500).send({ error: error.message });
    }

    return reply.code(201).send(tenant);
  });
}
