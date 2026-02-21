// ─────────────────────────────────────────────────────────
// workers/campaignWorker.js — Motor de Disparo
// Comportamento humano: delay 10–30s aleatório,
// simula digitando, respeita horários e dias
// ─────────────────────────────────────────────────────────
import { Queue, Worker } from 'bullmq';
import { supabase, redis, evolution, instanceName } from '../lib/clients.js';
import { interpolate } from '../lib/phoneFilter.js';

// ── Fila principal ────────────────────────────────────────
export const campaignQueue = new Queue('campaigns', {
  connection: redis,
  defaultJobOptions: {
    attempts:       3,
    backoff:        { type: 'exponential', delay: 10_000 },
    removeOnComplete: 200,
    removeOnFail:   500,
  },
});

// ── Fila do scheduler (campanhas agendadas) ───────────────
export const schedulerQueue = new Queue('scheduler', {
  connection: redis,
  defaultJobOptions: { removeOnComplete: true },
});

// ── Helpers de comportamento humano ──────────────────────

function humanDelay(minS, maxS) {
  const ms = (minS + Math.random() * (maxS - minS)) * 1000;
  // Ruído gaussiano ±500ms para parecer mais natural
  const noise = (Math.random() + Math.random() - 1) * 500;
  return new Promise(r => setTimeout(r, Math.max(minS * 1000, ms + noise)));
}

function canSendNow(camp) {
  const now  = new Date();
  const hour = now.getHours();
  const dow  = now.getDay(); // 0=Dom

  if (!camp.send_on_weekends && (dow === 0 || dow === 6)) {
    const daysToMon = dow === 0 ? 1 : 2;
    const waitMs    = daysToMon * 86_400_000;
    return { can: false, reason: 'weekend', waitMs };
  }
  if (hour < camp.send_start_hour) {
    const waitMs = ((camp.send_start_hour - hour) * 60 - now.getMinutes()) * 60_000;
    return { can: false, reason: 'before_hours', waitMs };
  }
  if (hour >= camp.send_end_hour) {
    const waitMs = ((24 - hour + camp.send_start_hour) * 60 - now.getMinutes()) * 60_000;
    return { can: false, reason: 'after_hours', waitMs };
  }
  return { can: true };
}

async function simulateTyping(instId, phone, text) {
  try {
    const chars   = (text || '').length;
    const typingMs = Math.min(Math.max(chars / 3.3 * 1000, 1000), 7000);
    await evolution.post(`/chat/sendPresence/${instId}`, {
      number:  phone,
      options: { presence: 'composing', delay: typingMs },
    });
    await new Promise(r => setTimeout(r, typingMs));
  } catch (_) { /* não crítico */ }
}

// ── Envio por tipo de mídia ───────────────────────────────

async function sendMessage(instId, phone, camp, contact) {
  const text    = interpolate(camp.message_text   || '', contact);
  const caption = interpolate(camp.media_caption  || '', contact);

  switch (camp.media_type) {
    case 'image':
    case 'video':
    case 'document':
      return evolution.post(`/message/sendMedia/${instId}`, {
        number:  phone,
        options: { delay: 1500 },
        mediaMessage: {
          mediatype: camp.media_type,
          caption:   caption || text,
          media:     camp.media_url,
        },
      });

    default: // texto puro
      if (camp.typing_simulation) await simulateTyping(instId, phone, text);
      return evolution.post(`/message/sendText/${instId}`, {
        number:  phone,
        options: { delay: 1200, presence: 'composing' },
        textMessage: { text },
      });
  }
}

// ── Worker principal ──────────────────────────────────────

const worker = new Worker('campaigns', async (job) => {
  const { campaignId, tenantId } = job.data;
  console.log(`[Worker] ▶ Campanha ${campaignId}`);

  // 1. Carrega campanha e tenant
  const [{ data: camp }, { data: tenant }] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', campaignId).single(),
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
  ]);

  if (!camp || !tenant) throw new Error('Campanha ou tenant não encontrado');

  // 2. Verifica bloqueio
  if (tenant.status === 'suspended') {
    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
    throw new Error(`Tenant suspenso: ${tenant.block_reason}`);
  }

  // 3. Verifica WhatsApp conectado
  if (tenant.wa_status !== 'connected') {
    throw new Error('WhatsApp desconectado');
  }

  const instId = tenant.wa_instance_id || instanceName(tenantId);

  // 4. Busca contatos pendentes
  const { data: pending } = await supabase
    .from('campaign_contacts')
    .select('*, contacts(id, name, phone, tags, variables, active, opted_out)')
    .eq('campaign_id', campaignId)
    .eq('status', 'queued')
    .order('queued_at', { ascending: true });

  if (!pending?.length) {
    await supabase.from('campaigns')
      .update({ status: 'done', finished_at: new Date() })
      .eq('id', campaignId);
    return { sent: 0 };
  }

  await supabase.from('campaigns')
    .update({ status: 'running', started_at: new Date() })
    .eq('id', campaignId);

  let sent = 0, failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const rec     = pending[i];
    const contact = rec.contacts;

    // ─ Verifica se campanha foi pausada/cancelada
    const { data: fresh } = await supabase.from('campaigns')
      .select('status').eq('id', campaignId).single();
    if (['paused','cancelled'].includes(fresh?.status)) {
      console.log(`[Worker] ⏸ Campanha ${campaignId} pausada`);
      break;
    }

    // ─ Verifica horário a cada mensagem
    const timeCheck = canSendNow(camp);
    if (!timeCheck.can) {
      console.log(`[Worker] ⏰ Fora do horário (${timeCheck.reason}). Reagendando.`);
      await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
      await campaignQueue.add('run', job.data, { delay: timeCheck.waitMs });
      break;
    }

    // ─ Pula contatos inativos
    if (!contact?.active || contact?.opted_out) {
      await supabase.from('campaign_contacts')
        .update({ status: 'failed', error_message: 'Contato inativo ou descadastrado' })
        .eq('id', rec.id);
      failed++;
      continue;
    }

    // ─ Verifica limite mensal a cada 50 msgs
    if (i > 0 && i % 50 === 0) {
      const { data: t } = await supabase.from('tenants').select('messages_sent_month,messages_limit_month').eq('id', tenantId).single();
      if (t?.messages_sent_month >= t?.messages_limit_month) {
        await supabase.from('campaigns').update({ status: 'paused' }).eq('id', campaignId);
        console.log('[Worker] ⚠️ Limite mensal atingido');
        break;
      }
    }

    // ─ Envia mensagem
    await supabase.from('campaign_contacts').update({ status: 'sending' }).eq('id', rec.id);

    try {
      const result = await sendMessage(instId, contact.phone, camp, contact);
      const waId   = result?.data?.key?.id;

      await supabase.from('campaign_contacts').update({
        status: 'sent', sent_at: new Date(), wa_message_id: waId, attempts: (rec.attempts || 0) + 1,
      }).eq('id', rec.id);

      await supabase.from('message_logs').insert({
        tenant_id: tenantId, campaign_id: campaignId,
        contact_id: contact.id, phone: contact.phone,
        status: 'sent', wa_message_id: waId,
      });

      // Incrementa contador de msgs enviadas
      await supabase.rpc('increment_messages_sent', { p_tenant_id: tenantId });

      sent++;
      console.log(`[Worker] ✓ ${contact.phone} (${i+1}/${pending.length})`);

    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      console.error(`[Worker] ✗ ${contact.phone}: ${msg}`);

      await supabase.from('campaign_contacts').update({
        status: 'failed', error_message: msg, failed_at: new Date(),
        attempts: (rec.attempts || 0) + 1,
      }).eq('id', rec.id);

      await supabase.from('message_logs').insert({
        tenant_id: tenantId, campaign_id: campaignId,
        contact_id: contact.id, phone: contact.phone,
        status: 'failed', error_message: msg,
      });

      failed++;
    }

    // ─ Atualiza progresso
    await supabase.from('campaigns').update({
      contacts_sent:    sent,
      contacts_failed:  failed,
      contacts_pending: pending.length - i - 1,
    }).eq('id', campaignId);

    // ─ DELAY HUMANO — aleatório entre min e max (ex: 10–30s)
    if (i < pending.length - 1) {
      const min = camp.delay_min_seconds || 10;
      const max = camp.delay_max_seconds || 30;
      const secs = (min + Math.random() * (max - min)).toFixed(1);
      console.log(`[Worker] ⏳ ${secs}s até próxima mensagem...`);
      await humanDelay(min, max);
    }
  }

  // Finaliza
  const stillPending = pending.length - sent - failed;
  if (stillPending === 0) {
    await supabase.from('campaigns').update({
      status: 'done', finished_at: new Date(),
      contacts_sent: sent, contacts_failed: failed, contacts_pending: 0,
    }).eq('id', campaignId);
  }

  console.log(`[Worker] ✅ Campanha ${campaignId} — Enviados: ${sent}, Falhas: ${failed}`);
  return { sent, failed };

}, { connection: redis, concurrency: 5 });

worker.on('failed', (job, err) =>
  console.error(`[Worker] Job ${job?.id} falhou: ${err.message}`));

// ── Scheduler — verifica campanhas agendadas a cada 60s ──

const schedulerWorker = new Worker('scheduler', async () => {
  const now = new Date().toISOString();

  const { data: ready } = await supabase
    .from('campaigns')
    .select('id, tenant_id')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now);

  if (!ready?.length) return;

  for (const c of ready) {
    await campaignQueue.add('run', { campaignId: c.id, tenantId: c.tenant_id });
    console.log(`[Scheduler] ▶ Enfileirando campanha ${c.id}`);
  }
}, { connection: redis });

// Inicia o job de checagem repetitivo
await schedulerQueue.add('tick', {}, { repeat: { every: 60_000 }, removeOnComplete: true });

export { worker, schedulerWorker };
