// ─────────────────────────────────────────────────────────
// routes/webhooks.js — Recebe eventos da Evolution API
// Processa: status de conexão, confirmações de entrega
//           e executa o bot de automação em tempo real
// ─────────────────────────────────────────────────────────
import { supabase, evolution } from '../lib/clients.js';

export async function webhookRoutes(app) {

  // POST /webhook/evolution
  app.post('/evolution', async (req, reply) => {
    const { event, instance, data } = req.body || {};
    if (!event) return reply.send({ ok: true });

    // ── 1. Status de conexão ─────────────────────────────
    if (event === 'connection.update') {
      const isOpen = data?.state === 'open';
      const update = {
        wa_status: isOpen ? 'connected' : 'disconnected',
      };
      if (isOpen) {
        update.wa_connected_at   = new Date().toISOString();
        update.wa_phone_number   = data?.instance?.wuid?.replace('@s.whatsapp.net','') || null;
        update.wa_profile_name   = data?.instance?.profileName || null;
      } else {
        update.wa_disconnected_at = new Date().toISOString();
      }
      await supabase.from('tenants').update(update).eq('wa_instance_id', instance);
    }

    // ── 2. Confirmação de entrega / leitura ──────────────
    if (event === 'messages.update') {
      for (const msg of data || []) {
        const waStatus = {
          'DELIVERY_ACK': 'delivered',
          'READ':         'read',
          'PLAYED':       'read',
        }[msg.update?.status];

        if (waStatus && msg.key?.id) {
          await supabase.from('campaign_contacts')
            .update({ status: waStatus, delivered_at: new Date() })
            .eq('wa_message_id', msg.key.id);

          await supabase.from('message_logs')
            .update({ status: waStatus })
            .eq('wa_message_id', msg.key.id);
        }
      }
    }

    // ── 3. Mensagem recebida → Bot de automação ──────────
    if (event === 'messages.upsert') {
      for (const msg of data?.messages || []) {
        // Ignora mensagens enviadas pelo próprio bot
        if (msg.key?.fromMe) continue;

        const fromNumber = msg.key?.remoteJid?.replace('@s.whatsapp.net', '');
        if (!fromNumber || fromNumber.endsWith('@g.us')) continue; // ignora grupos

        const text = (
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          ''
        ).trim();

        if (!text) continue;

        // Busca tenant pela instância
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id, wa_instance_id')
          .eq('wa_instance_id', instance)
          .single();

        if (!tenant) continue;

        // Processa o bot
        await processBotMessage(tenant, fromNumber, text);
      }
    }

    return reply.send({ ok: true });
  });
}

// ── Engine do Bot ─────────────────────────────────────────
async function processBotMessage(tenant, fromPhone, text) {
  const tenantId = tenant.id;
  const instId   = tenant.wa_instance_id;

  // Busca estado atual da conversa (session no Redis seria ideal,
  // mas usamos Supabase para simplicidade)
  const { data: session } = await supabase
    .from('bot_sessions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', fromPhone)
    .single();

  // Carrega automações ativas do tenant ordenadas por prioridade
  const { data: automations } = await supabase
    .from('automations')
    .select('*, automation_nodes(*)')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (!automations?.length) return;

  // ── Determina qual automação ativar ──────────────────────
  let matchedAutomation = null;
  let startNodeIndex    = 0;

  // Se há uma sessão ativa, continuar o fluxo dela
  if (session?.automation_id && session?.current_node_index !== undefined) {
    const activeAuto = automations.find(a => a.id === session.automation_id);
    if (activeAuto) {
      matchedAutomation = activeAuto;
      // Verifica se é resposta de menu
      const currentNode = getNodeByIndex(activeAuto, session.current_node_index);
      if (currentNode?.type === 'menu') {
        const option = (currentNode.options ? JSON.parse(currentNode.options) : [])
          .find(o => o.key === text.trim());
        startNodeIndex = option ? option.next_node_order : session.current_node_index + 1;
      } else {
        startNodeIndex = session.current_node_index + 1;
      }
    }
  }

  // Se não há sessão ativa, tenta bater uma trigger
  if (!matchedAutomation) {
    for (const auto of automations) {
      if (auto.trigger_type === 'always') {
        matchedAutomation = auto; break;
      }
      if (auto.trigger_type === 'keyword') {
        const kws = auto.trigger_keywords || [];
        if (kws.some(kw => text.toLowerCase().includes(kw.toLowerCase()))) {
          matchedAutomation = auto; break;
        }
      }
    }
    startNodeIndex = 0;
  }

  if (!matchedAutomation) return;

  // ── Executa os nós do fluxo ──────────────────────────────
  const nodes = (matchedAutomation.automation_nodes || [])
    .sort((a, b) => a.order_index - b.order_index);

  for (let i = startNodeIndex; i < nodes.length; i++) {
    const node = nodes[i];

    if (node.type === 'wait') {
      // Pausa — salva sessão e aguarda próxima mensagem
      await upsertSession(tenantId, fromPhone, matchedAutomation.id, i);
      break;
    }

    if (node.type === 'menu') {
      // Envia a mensagem do menu e para, esperando resposta
      await sendBotMessage(instId, fromPhone, node);
      await upsertSession(tenantId, fromPhone, matchedAutomation.id, i);
      break;
    }

    if (node.type === 'message') {
      await sendBotMessage(instId, fromPhone, node);
      // Delay humano entre nós
      if (i < nodes.length - 1) {
        await sleep(2000 + Math.random() * 2000);
      }
    }

    // Se é o último nó, limpa a sessão
    if (i === nodes.length - 1) {
      await clearSession(tenantId, fromPhone);
    }
  }
}

async function sendBotMessage(instId, phone, node) {
  try {
    if (node.media_type !== 'none' && node.media_url) {
      // Mensagem com mídia + legenda
      await evolution.post(`/message/sendMedia/${instId}`, {
        number: phone,
        options: { delay: 1200 },
        mediaMessage: {
          mediatype: node.media_type,
          caption:   buildMenuText(node),
          media:     node.media_url,
        },
      });
    } else {
      // Texto simples
      await evolution.post(`/message/sendText/${instId}`, {
        number: phone,
        options: { delay: 1000, presence: 'composing' },
        textMessage: { text: buildMenuText(node) },
      });
    }
  } catch (err) {
    console.error('[Bot] Erro ao enviar mensagem:', err.message);
  }
}

function buildMenuText(node) {
  let text = node.content || '';
  if (node.type === 'menu') {
    const options = node.options ? JSON.parse(node.options) : [];
    if (options.length) {
      text += '\n\n';
      text += options.map(o => `*${o.key}*  ${o.label}`).join('\n');
    }
  }
  return text;
}

function getNodeByIndex(automation, index) {
  const nodes = (automation.automation_nodes || [])
    .sort((a, b) => a.order_index - b.order_index);
  return nodes[index] || null;
}

async function upsertSession(tenantId, phone, automationId, nodeIndex) {
  await supabase.from('bot_sessions').upsert({
    tenant_id:          tenantId,
    phone,
    automation_id:      automationId,
    current_node_index: nodeIndex,
    updated_at:         new Date().toISOString(),
  }, { onConflict: 'tenant_id,phone' });
}

async function clearSession(tenantId, phone) {
  await supabase.from('bot_sessions')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('phone', phone);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
