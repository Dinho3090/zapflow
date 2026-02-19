// ─────────────────────────────────────────────────────────
// routes/admin.js — Painel Admin
// Protegido por x-admin-key (não JWT de tenant)
// ─────────────────────────────────────────────────────────
import { supabase, evolution } from '../lib/clients.js';

export async function adminRoutes(app) {

  // GET /admin/tenants — lista todos os clientes
  app.get('/tenants', async (req, reply) => {
    const { data } = await supabase
      .from('admin_overview')
      .select('*');
    return reply.send(data || []);
  });

  // GET /admin/tenants/:id
  app.get('/tenants/:id', async (req, reply) => {
    const { data } = await supabase
      .from('tenants').select('*').eq('id', req.params.id).single();
    if (!data) return reply.code(404).send({ error: 'Não encontrado' });
    return reply.send(data);
  });

  // POST /admin/tenants/:id/block — suspende cliente
  app.post('/tenants/:id/block', async (req, reply) => {
    const { id } = req.params;
    const { reason = 'Inadimplência' } = req.body || {};

    // 1. Suspende tenant
    await supabase.from('tenants').update({
      status:       'suspended',
      blocked_at:   new Date().toISOString(),
      block_reason: reason,
    }).eq('id', id);

    // 2. Pausa campanhas ativas
    await supabase.from('campaigns')
      .update({ status: 'paused' })
      .eq('tenant_id', id)
      .in('status', ['running','scheduled']);

    // 3. Desconecta WhatsApp
    const { data: t } = await supabase.from('tenants')
      .select('wa_instance_id').eq('id', id).single();
    if (t?.wa_instance_id) {
      await evolution.delete(`/instance/logout/${t.wa_instance_id}`).catch(() => null);
      await supabase.from('tenants').update({
        wa_status: 'disconnected',
      }).eq('id', id);
    }

    return reply.send({ ok: true, message: `Tenant ${id} suspenso.` });
  });

  // POST /admin/tenants/:id/unblock — reativa cliente
  app.post('/tenants/:id/unblock', async (req, reply) => {
    const { id } = req.params;
    const { plan = 'basic', days = 30 } = req.body || {};

    const planLimits = {
      trial:      { messages_limit_month: 500,   contacts_limit: 200,    campaigns_limit: 2,  min_delay_seconds: 15 },
      basic:      { messages_limit_month: 1000,  contacts_limit: 500,    campaigns_limit: 3,  min_delay_seconds: 12 },
      pro:        { messages_limit_month: 10000, contacts_limit: 10000,  campaigns_limit: 10, min_delay_seconds: 8  },
      enterprise: { messages_limit_month: 99999, contacts_limit: 999999, campaigns_limit: 50, min_delay_seconds: 5  },
    };

    const exp = new Date();
    exp.setDate(exp.getDate() + Number(days));

    await supabase.from('tenants').update({
      status:                 'active',
      plan,
      blocked_at:             null,
      block_reason:           null,
      subscription_expires_at: exp.toISOString(),
      billing_cycle_start:    new Date().toISOString().slice(0, 10),
      messages_sent_month:    0,
      ...planLimits[plan],
    }).eq('id', id);

    return reply.send({
      ok: true,
      message: `Tenant ${id} reativado — plano ${plan} por ${days} dias.`,
      expires_at: exp.toISOString(),
    });
  });

  // POST /admin/tenants — cria tenant manualmente
  app.post('/tenants', async (req, reply) => {
    const { name, email, plan = 'trial' } = req.body || {};
    if (!name || !email)
      return reply.code(400).send({ error: 'name e email obrigatórios' });

    const planLimits = {
      trial:      { messages_limit_month: 500,   contacts_limit: 200,    campaigns_limit: 2,  min_delay_seconds: 15 },
      basic:      { messages_limit_month: 1000,  contacts_limit: 500,    campaigns_limit: 3,  min_delay_seconds: 12 },
      pro:        { messages_limit_month: 10000, contacts_limit: 10000,  campaigns_limit: 10, min_delay_seconds: 8  },
      enterprise: { messages_limit_month: 99999, contacts_limit: 999999, campaigns_limit: 50, min_delay_seconds: 5  },
    };

    const exp = new Date();
    exp.setDate(exp.getDate() + 7); // trial = 7 dias

    const { data, error } = await supabase.from('tenants').insert({
      name, email, plan,
      status: plan === 'trial' ? 'trial' : 'active',
      subscription_expires_at: exp.toISOString(),
      ...planLimits[plan],
    }).select().single();

    if (error) return reply.code(500).send({ error: error.message });
    return reply.code(201).send(data);
  });

  // GET /admin/stats — métricas gerais da plataforma
  app.get('/stats', async (req, reply) => {
    const [
      { count: total },
      { count: active },
      { count: suspended },
      { count: trial },
    ] = await Promise.all([
      supabase.from('tenants').select('*', { count: 'exact', head: true }),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'suspended'),
      supabase.from('tenants').select('*', { count: 'exact', head: true }).eq('status', 'trial'),
    ]);

    // Total de mensagens enviadas no mês
    const { data: msgSum } = await supabase
      .from('tenants')
      .select('messages_sent_month');
    const totalMsgs = (msgSum || []).reduce((s, r) => s + (r.messages_sent_month || 0), 0);

    return reply.send({ total, active, suspended, trial, totalMsgs });
  });
}
