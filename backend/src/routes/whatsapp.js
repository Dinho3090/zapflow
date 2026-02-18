// ─────────────────────────────────────────────────────────
// routes/whatsapp.js — Conexão WhatsApp via QR Code
// ─────────────────────────────────────────────────────────
import { evolution, instanceName, supabase } from '../lib/clients.js';

export async function whatsappRoutes(app) {

  // GET /api/whatsapp/status
  app.get('/status', async (req, reply) => {
    const t = req.tenant;
    return reply.send({
      status:       t.wa_status,
      phone:        t.wa_phone_number,
      profileName:  t.wa_profile_name,
      connectedAt:  t.wa_connected_at,
    });
  });

  // GET /api/whatsapp/connect — gera QR Code
  app.get('/connect', async (req, reply) => {
    const t    = req.tenant;
    const inst = instanceName(t.id);

    try {
      // Tenta reconectar instância existente primeiro
      try {
        const { data: info } = await evolution.get(`/instance/fetchInstances/${inst}`);
        if (info?.instance?.state === 'open') {
          return reply.send({ status: 'connected', phone: t.wa_phone_number });
        }
      } catch (_) { /* não existe ainda */ }

      // Cria instância nova
      await evolution.post('/instance/create', {
        instanceName:    inst,
        qrcode:          true,
        integration:     'WHATSAPP-BAILEYS',
        reject_call:     true,
        msg_call:        'Não atendo chamadas por aqui.',
        groupsIgnore:    true,
        alwaysOnline:    false,
        readMessages:    false,
        readStatus:      false,
        webhookUrl:      `${process.env.BACKEND_URL}/webhook/evolution`,
        webhookByEvents: true,
        webhookEvents:   ['MESSAGES_UPSERT', 'MESSAGES_UPDATE', 'CONNECTION_UPDATE', 'SEND_MESSAGE'],
      }).catch(() => null); // ignora se já existia

      // Busca QR Code
      const { data: qr } = await evolution.get(`/instance/connect/${inst}`);

      await supabase.from('tenants').update({
        wa_instance_id: inst,
        wa_status:      'connecting',
      }).eq('id', t.id);

      return reply.send({
        status: 'connecting',
        qrcode: qr.base64 || qr.qrcode?.base64,
      });

    } catch (err) {
      req.log.error(err);
      return reply.code(500).send({ error: 'Erro ao gerar QR Code' });
    }
  });

  // POST /api/whatsapp/disconnect
  app.post('/disconnect', async (req, reply) => {
    const t = req.tenant;
    if (!t.wa_instance_id) return reply.code(400).send({ error: 'Não conectado' });

    await evolution.delete(`/instance/logout/${t.wa_instance_id}`).catch(() => null);
    await supabase.from('tenants').update({
      wa_status:      'disconnected',
      wa_phone_number: null,
      wa_profile_name: null,
    }).eq('id', t.id);

    return reply.send({ ok: true });
  });
}
