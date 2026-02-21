// ─────────────────────────────────────────────────────────
// routes/contacts.js — Gestão de Contatos
// ─────────────────────────────────────────────────────────
import { supabase } from '../lib/clients.js';
import { parseCSV, parseVCF } from '../lib/phoneFilter.js';

export async function contactRoutes(app) {

  // GET /api/contacts?page=1&limit=50&tag=vip&search=João
  app.get('/', async (req, reply) => {
    const { page = 1, limit = 50, tag, search } = req.query;
    const offset = (page - 1) * limit;

    let q = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', req.tenant.id)
      .eq('active', true)
      .range(offset, offset + Number(limit) - 1)
      .order('name', { ascending: true });

    if (tag)    q = q.contains('tags', [tag]);
    if (search) q = q.ilike('name', `%${search}%`);

    const { data, count, error } = await q;
    if (error) return reply.code(500).send({ error: error.message });

    return reply.send({ contacts: data, total: count, page: Number(page), limit: Number(limit) });
  });

  // GET /api/contacts/tags — lista todas as tags do tenant
  app.get('/tags', async (req, reply) => {
    const { data } = await supabase
      .from('contacts')
      .select('tags')
      .eq('tenant_id', req.tenant.id)
      .eq('active', true);

    const tags = [...new Set((data || []).flatMap(r => r.tags || []))].sort();
    return reply.send(tags);
  });

  // POST /api/contacts/import — upload CSV ou VCF
  app.post('/import', async (req, reply) => {
    const tenant = req.tenant;

    // Verificar limite do plano
    const { count: current } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant.id)
      .eq('active', true);

    const file = await req.file();
    if (!file) return reply.code(400).send({ error: 'Nenhum arquivo enviado' });

    const chunks = [];
    for await (const chunk of file.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const name   = file.filename.toLowerCase();

    let parsed = [];
    if      (name.endsWith('.csv')) parsed = parseCSV(buffer);
    else if (name.endsWith('.vcf')) parsed = parseVCF(buffer);
    else return reply.code(400).send({ error: 'Apenas CSV ou VCF são aceitos' });

    if (!parsed.length) return reply.code(400).send({ error: 'Nenhum contato válido encontrado' });

    if (current + parsed.length > tenant.contacts_limit) {
      return reply.code(400).send({
        error: `Limite de contatos excedido. Plano permite ${tenant.contacts_limit}. Você tem ${current} e tentou importar ${parsed.length}.`,
      });
    }

    // Tags opcionais enviadas no header
    const defaultTags = req.headers['x-tags']
      ? req.headers['x-tags'].split(',').map(t => t.trim()).filter(Boolean)
      : [];

    const rows = parsed.map(c => ({
      tenant_id: tenant.id,
      name:      c.name,
      phone:     c.phone,
      tags:      defaultTags,
      variables: {},
      active:    true,
      opted_out: false,
    }));

    const { data, error } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'tenant_id,phone', ignoreDuplicates: false })
      .select('id');

    if (error) return reply.code(500).send({ error: error.message });

    return reply.send({
      imported: data.length,
      total:    current + data.length,
      skipped:  parsed.length - data.length,
    });
  });

  // DELETE /api/contacts/:id
  app.delete('/:id', async (req, reply) => {
    await supabase
      .from('contacts')
      .update({ active: false })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id);
    return reply.send({ ok: true });
  });

  // PATCH /api/contacts/:id/tags
  app.patch('/:id/tags', async (req, reply) => {
    const { tags } = req.body;
    await supabase
      .from('contacts')
      .update({ tags })
      .eq('id', req.params.id)
      .eq('tenant_id', req.tenant.id);
    return reply.send({ ok: true });
  });
}
