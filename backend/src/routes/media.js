// ─────────────────────────────────────────────────────────
// routes/media.js — Upload de mídia para Supabase Storage
// Suporta: imagem, vídeo (comprime se > 16MB), documento
// ─────────────────────────────────────────────────────────
import { supabase } from '../lib/clients.js';
import { v4 as uuid } from 'uuid';
import path from 'path';

const ALLOWED = new Set([
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/mpeg','video/quicktime','video/x-msvideo',
  'application/pdf',
]);

const TYPE_MAP = {
  'image/jpeg':'image','image/png':'image','image/webp':'image','image/gif':'image',
  'video/mp4':'video','video/mpeg':'video','video/quicktime':'video','video/x-msvideo':'video',
  'application/pdf':'document',
};

export async function mediaRoutes(app) {

  // POST /api/media/upload
  app.post('/upload', async (req, reply) => {
    const tenant = req.tenant;
    const file   = await req.file();
    if (!file) return reply.code(400).send({ error: 'Nenhum arquivo enviado' });

    if (!ALLOWED.has(file.mimetype))
      return reply.code(400).send({ error: `Tipo não permitido: ${file.mimetype}` });

    // Lê bytes
    const chunks = [];
    for await (const chunk of file.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);
    const sizeMB = buffer.length / (1024 * 1024);

    // Vídeo > 16MB: avisa o frontend para comprimir antes de re-enviar
    // (compressão pesada no servidor precisaria de ffmpeg instalado)
    if (TYPE_MAP[file.mimetype] === 'video' && sizeMB > 64) {
      return reply.code(400).send({
        error: `Vídeo muito grande (${sizeMB.toFixed(1)}MB). Máximo 64MB.`,
      });
    }

    const ext      = path.extname(file.filename) || '';
    const filePath = `${tenant.id}/${uuid()}${ext}`;

    const { error: upErr } = await supabase.storage
      .from('campaign-media')
      .upload(filePath, buffer, { contentType: file.mimetype, upsert: false });

    if (upErr) return reply.code(500).send({ error: 'Erro no upload: ' + upErr.message });

    const { data: { publicUrl } } = supabase.storage
      .from('campaign-media')
      .getPublicUrl(filePath);

    // Salva na biblioteca
    const mediaType = TYPE_MAP[file.mimetype] || 'document';
    const { data: media } = await supabase.from('media_library').insert({
      tenant_id:  tenant.id,
      name:       file.filename,
      type:       mediaType,
      url:        publicUrl,
      mime_type:  file.mimetype,
      size_bytes: buffer.length,
    }).select().single();

    return reply.send({
      id:      media.id,
      url:     publicUrl,
      type:    mediaType,
      name:    file.filename,
      size_mb: sizeMB.toFixed(2),
    });
  });

  // GET /api/media
  app.get('/', async (req, reply) => {
    const { type } = req.query;
    let q = supabase.from('media_library').select('*')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: false });
    if (type) q = q.eq('type', type);
    const { data } = await q;
    return reply.send(data || []);
  });

  // DELETE /api/media/:id
  app.delete('/:id', async (req, reply) => {
    const { data: media } = await supabase.from('media_library')
      .select('url').eq('id', req.params.id).eq('tenant_id', req.tenant.id).single();
    if (!media) return reply.code(404).send({ error: 'Mídia não encontrada' });

    // Remove do Storage
    const filePath = media.url.split('/campaign-media/')[1];
    if (filePath) await supabase.storage.from('campaign-media').remove([filePath]);

    await supabase.from('media_library').delete()
      .eq('id', req.params.id).eq('tenant_id', req.tenant.id);

    return reply.send({ ok: true });
  });
}
