// ─────────────────────────────────────────────────────────
// routes/automations.js — Bot de Resposta Automática
// Suporta: menu numerado, palavras-chave, fluxos
//          com múltiplos passos, respostas com mídia
// ─────────────────────────────────────────────────────────
import { supabase } from '../lib/clients.js';

export async function automationRoutes(app) {

  // GET /api/automations — lista todas as automações
  app.get('/', async (req, reply) => {
    const { data } = await supabase
      .from('automations')
      .select('*, automation_nodes(*)')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: false });
    return reply.send(data || []);
  });

  // GET /api/automations/:id
  app.get('/:id', async (req, reply) => {
    const { data } = await supabase
      .from('automations')
      .select('*, automation_nodes(*, automation_nodes(*))')
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id)
      .single();
    if (!data) return reply.code(404).send({ error: 'Não encontrado' });
    return reply.send(data);
  });

  // POST /api/automations — cria automação completa com nós
  //
  // Estrutura de um fluxo:
  // {
  //   name: "Atendimento Principal",
  //   trigger_type: "keyword" | "menu" | "always",
  //   trigger_keywords: ["oi","olá","hello"],   // para keyword
  //   active: true,
  //   nodes: [
  //     {
  //       order: 0,
  //       type: "message",            // message | menu | condition | wait
  //       content: "Olá! Como posso ajudar?",
  //       media_url: null,
  //       media_type: "none",
  //       media_caption: null,
  //       options: null,              // para tipo "menu"
  //       next_node_id: null,
  //       wait_seconds: 0,
  //     },
  //     {
  //       order: 1,
  //       type: "menu",
  //       content: "Escolha uma opção:",
  //       options: [
  //         { key: "1", label: "Suporte",   next_node_order: 2 },
  //         { key: "2", label: "Vendas",    next_node_order: 3 },
  //         { key: "3", label: "Horários",  next_node_order: 4 },
  //       ]
  //     },
  //     ...
  //   ]
  // }
  app.post('/', async (req, reply) => {
    const { name, trigger_type, trigger_keywords, active, nodes } = req.body;

    if (!name)         return reply.code(400).send({ error: 'Nome obrigatório' });
    if (!trigger_type) return reply.code(400).send({ error: 'trigger_type obrigatório' });
    if (!nodes?.length)return reply.code(400).send({ error: 'Ao menos um nó é necessário' });

    const { data: automation, error } = await supabase
      .from('automations')
      .insert({
        tenant_id:        req.tenant.id,
        name,
        trigger_type,
        trigger_keywords: trigger_keywords || [],
        active:           active !== false,
      })
      .select().single();

    if (error) return reply.code(500).send({ error: error.message });

    // Salva nós do fluxo
    const nodeRows = nodes.map((n, i) => ({
      automation_id: automation.id,
      tenant_id:     req.tenant.id,
      order_index:   n.order ?? i,
      type:          n.type || 'message',
      content:       n.content || null,
      media_type:    n.media_type || 'none',
      media_url:     n.media_url  || null,
      media_caption: n.media_caption || null,
      options:       n.options ? JSON.stringify(n.options) : null,
      wait_seconds:  n.wait_seconds || 0,
    }));

    await supabase.from('automation_nodes').insert(nodeRows);

    return reply.code(201).send(automation);
  });

  // PATCH /api/automations/:id — atualiza nome/status
  app.patch('/:id', async (req, reply) => {
    const { name, active } = req.body;
    const { data } = await supabase
      .from('automations')
      .update({ name, active, updated_at: new Date() })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id)
      .select().single();
    return reply.send(data);
  });

  // DELETE /api/automations/:id
  app.delete('/:id', async (req, reply) => {
    await supabase.from('automations')
      .delete()
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id);
    return reply.send({ ok: true });
  });
}
