// ─────────────────────────────────────────────────────────
// middleware/auth.js — Autenticação JWT via Supabase
// ─────────────────────────────────────────────────────────
import { supabase } from '../lib/clients.js';

export async function authMiddleware(request, reply) {
  const header = request.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Token não fornecido' });
  }

  const token = header.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return reply.code(401).send({ error: 'Token inválido' });

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('*')
    .eq('auth_user_id', user.id)
    .single();

  if (tErr || !tenant) return reply.code(403).send({ error: 'Tenant não encontrado' });

  // Verifica bloqueio em rotas de ação
  const blocked = ['running', 'sending'];
  const actionPaths = ['/api/campaigns', '/api/contacts/import'];
  const isAction = actionPaths.some(p => request.url.startsWith(p));

  if (isAction && tenant.status === 'suspended') {
    return reply.code(402).send({
      error: 'payment_required',
      message: tenant.block_reason || 'Conta suspensa. Regularize seu pagamento.',
    });
  }

  request.tenant = tenant;
  request.user   = user;
}

export async function adminMiddleware(request, reply) {
  const key = request.headers['x-admin-key'];
  if (!key || key !== process.env.ADMIN_KEY) {
    return reply.code(403).send({ error: 'Acesso negado' });
  }
}
