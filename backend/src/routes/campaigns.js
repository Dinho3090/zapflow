// ─────────────────────────────────────────────────────────
// routes/campaigns.js — Campanhas com agendamento avançado
// ─────────────────────────────────────────────────────────
import { supabase } from '../lib/clients.js';
import { campaignQueue } from '../workers/campaignWorker.js';

export async function campaignRoutes(app) {

  // GET /api/campaigns
  app.get('/', async (req, reply) => {
    const { status, month, year } = req.query;

    let q = supabase
      .from('campaigns')
      .select('*')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: false });

    if (status) q = q.eq('status', status);

    // Filtro por mês/ano para o calendário
    if (month && year) {
      const from = `${year}-${String(month).padStart(2,'0')}-01T00:00:00`;
      const to   = new Date(year, month, 1).toISOString(); // primeiro dia do mês seguinte
      q = q.gte('scheduled_at', from).lt('scheduled_at', to);
    }

    const { data, error } = await q;
    if (error) return reply.code(500).send({ error: error.message });
    return reply.send(data || []);
  });

  // GET /api/campaigns/calendar?month=2&year=2025
  // Retorna mapa de dias → campanhas para o calendário visual
  app.get('/calendar', async (req, reply) => {
    const { month, year } = req.query;
    if (!month || !year) return reply.code(400).send({ error: 'Informe month e year' });

    const from = `${year}-${String(month).padStart(2,'0')}-01T00:00:00`;
    const to   = new Date(year, Number(month), 1).toISOString();

    const { data } = await supabase
      .from('campaigns')
      .select('id, name, status, scheduled_at, contacts_total, recurrence_days')
      .eq('tenant_id', req.tenant.id)
      .gte('scheduled_at', from)
      .lt('scheduled_at', to)
      .order('scheduled_at', { ascending: true });

    // Agrupa por dia do mês
    const calendar = {};
    for (const camp of data || []) {
      const day = new Date(camp.scheduled_at).getDate();
      if (!calendar[day]) calendar[day] = [];
      calendar[day].push(camp);
    }

    return reply.send(calendar);
  });

  // GET /api/campaigns/:id
  app.get('/:id', async (req, reply) => {
    const { data } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id)
      .single();
    if (!data) return reply.code(404).send({ error: 'Campanha não encontrada' });
    return reply.send(data);
  });

  // POST /api/campaigns — cria campanha (simples ou recorrente)
  app.post('/', async (req, reply) => {
    const tenant = req.tenant;
    const body   = req.body;

    // Validações
    if (!body.name) return reply.code(400).send({ error: 'Nome obrigatório' });
    if (!body.message_text && !body.media_url)
      return reply.code(400).send({ error: 'Informe texto ou mídia' });
    if (body.media_url && !body.media_caption)
      return reply.code(400).send({ error: 'Imagem/vídeo precisa de legenda' });

    // Delay mínimo do plano
    const delayMin = Math.max(body.delay_min_seconds ?? 10, tenant.min_delay_seconds ?? 10);
    const delayMax = Math.max(body.delay_max_seconds ?? 30, delayMin + 5);

    // Contar contatos alvo
    let contactQuery = supabase
      .from('contacts')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .eq('active', true)
      .eq('opted_out', false);

    if (body.target_tags?.length) {
      contactQuery = contactQuery.overlaps('tags', body.target_tags);
    }
    const { data: targetContacts, count: contactCount } = await contactQuery.select('id');

    if (!contactCount) return reply.code(400).send({ error: 'Nenhum contato encontrado para essa segmentação' });

    // ── Recorrência ───────────────────────────────────────
    // recurrence_type: 'none' | 'daily' | 'weekly' | 'custom'
    // recurrence_days: [1,3,5] (0=Dom…6=Sáb) para weekly/custom
    // recurrence_times: ['09:00','14:00','18:00'] — múltiplos horários/dia
    // recurrence_end_date: '2025-02-28'
    const recurrence = {
      type:     body.recurrence_type     || 'none',
      days:     body.recurrence_days     || [],   // dias da semana
      times:    body.recurrence_times    || [],   // horários do dia
      end_date: body.recurrence_end_date || null,
    };

    // Base da campanha
    const campBase = {
      tenant_id:         tenant.id,
      name:              body.name,
      description:       body.description || null,
      message_text:      body.message_text || null,
      media_type:        body.media_type   || 'none',
      media_url:         body.media_url    || null,
      media_caption:     body.media_caption|| null,
      delay_min_seconds: delayMin,
      delay_max_seconds: delayMax,
      typing_simulation: body.typing_simulation !== false,
      target_tags:       body.target_tags  || [],
      target_all:        !body.target_tags?.length,
      send_start_hour:   body.send_start_hour  ?? 8,
      send_end_hour:     body.send_end_hour    ?? 20,
      send_on_weekends:  body.send_on_weekends ?? false,
      contacts_total:    contactCount,
      contacts_pending:  contactCount,
      recurrence_type:   recurrence.type,
      recurrence_days:   recurrence.days,
      recurrence_times:  recurrence.times,
      recurrence_end_date: recurrence.end_date,
    };

    // ── Gera todas as ocorrências de agendamento ─────────
    const schedules = buildSchedules(body.scheduled_at, recurrence);
    const created   = [];

    for (const scheduledAt of schedules) {
      const { data: camp, error } = await supabase
        .from('campaigns')
        .insert({ ...campBase, scheduled_at: scheduledAt, status: scheduledAt ? 'scheduled' : 'draft' })
        .select()
        .single();

      if (error) continue;

      // Cria fila de contatos para esta ocorrência
      const rows = (targetContacts || []).map(c => ({
        campaign_id: camp.id,
        tenant_id:   tenant.id,
        contact_id:  c.id,
        status:      'queued',
      }));
      await supabase.from('campaign_contacts').insert(rows);
      created.push(camp);
    }

    return reply.code(201).send({
      created:  created.length,
      campaigns: created,
    });
  });

  // POST /api/campaigns/:id/start
  app.post('/:id/start', async (req, reply) => {
    const { id } = req.params;
    const tenant  = req.tenant;

    if (tenant.wa_status !== 'connected')
      return reply.code(400).send({ error: 'WhatsApp não está conectado' });

    const { data: camp } = await supabase
      .from('campaigns').select('*')
      .eq('id', id).eq('tenant_id', tenant.id).single();

    if (!camp) return reply.code(404).send({ error: 'Campanha não encontrada' });
    if (!['draft','paused','scheduled'].includes(camp.status))
      return reply.code(400).send({ error: `Não é possível iniciar campanha com status "${camp.status}"` });

    const job = await campaignQueue.add('run', { campaignId: id, tenantId: tenant.id }, { priority: 1 });

    await supabase.from('campaigns')
      .update({ status: 'running', queue_job_id: job.id, started_at: new Date() })
      .eq('id', id);

    return reply.send({ ok: true, jobId: job.id });
  });

  // POST /api/campaigns/:id/pause
  app.post('/:id/pause', async (req, reply) => {
    await supabase.from('campaigns')
      .update({ status: 'paused' })
      .eq('id', req.params.id).eq('tenant_id', req.tenant.id);
    return reply.send({ ok: true });
  });

  // POST /api/campaigns/:id/resume
  app.post('/:id/resume', async (req, reply) => {
    const { data: camp } = await supabase
      .from('campaigns').select('status')
      .eq('id', req.params.id).eq('tenant_id', req.tenant.id).single();

    if (camp?.status !== 'paused')
      return reply.code(400).send({ error: 'Campanha não está pausada' });

    const job = await campaignQueue.add('run', {
      campaignId: req.params.id, tenantId: req.tenant.id,
    });
    await supabase.from('campaigns')
      .update({ status: 'running', queue_job_id: job.id })
      .eq('id', req.params.id);

    return reply.send({ ok: true });
  });

  // DELETE /api/campaigns/:id
  app.delete('/:id', async (req, reply) => {
    await supabase.from('campaigns')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id).eq('tenant_id', req.tenant.id);
    return reply.send({ ok: true });
  });

  // GET /api/campaigns/:id/report
  app.get('/:id/report', async (req, reply) => {
    const { data: camp } = await supabase
      .from('campaigns').select('*')
      .eq('id', req.params.id).eq('tenant_id', req.tenant.id).single();
    if (!camp) return reply.code(404).send({ error: 'Não encontrada' });

    const { data: logs } = await supabase
      .from('message_logs')
      .select('status')
      .eq('campaign_id', req.params.id);

    const summary = (logs || []).reduce((a, l) => {
      a[l.status] = (a[l.status] || 0) + 1; return a;
    }, {});

    return reply.send({
      campaign: camp,
      summary: {
        total:     camp.contacts_total,
        sent:      summary.sent      || 0,
        delivered: summary.delivered || 0,
        read:      summary.read      || 0,
        failed:    summary.failed    || 0,
        pending:   camp.contacts_pending,
      },
    });
  });
}

// ── Helper: gera array de datas a agendar ─────────────────
function buildSchedules(baseDate, recurrence) {
  // Sem agendamento
  if (!baseDate && recurrence.type === 'none') return [null];

  // Agendamento único
  if (recurrence.type === 'none') return [new Date(baseDate).toISOString()];

  // Recorrente
  const times    = recurrence.times?.length ? recurrence.times : ['09:00'];
  const endDate  = recurrence.end_date ? new Date(recurrence.end_date) : (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1); return d;
  })();
  const startDay = baseDate ? new Date(baseDate) : new Date();
  const schedules = [];
  const cursor    = new Date(startDay);
  cursor.setHours(0, 0, 0, 0);

  while (cursor <= endDate) {
    const dow = cursor.getDay(); // 0=Dom

    const shouldSend =
      recurrence.type === 'daily' ||
      (recurrence.type === 'weekly' && recurrence.days.includes(dow)) ||
      (recurrence.type === 'custom' && recurrence.days.includes(dow));

    if (shouldSend) {
      for (const time of times) {
        const [h, m] = time.split(':').map(Number);
        const dt = new Date(cursor);
        dt.setHours(h, m, 0, 0);
        schedules.push(dt.toISOString());
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return schedules.length ? schedules : [new Date(startDay).toISOString()];
}
