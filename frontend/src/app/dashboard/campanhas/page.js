'use client';
// ─────────────────────────────────────────────────────────
// app/dashboard/campanhas/nova/page.js
// Formulário completo: texto, mídia+legenda, agendamento
// recorrência com múltiplos horários e dias da semana
// ─────────────────────────────────────────────────────────
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { campaignsApi, mediaApi } from '@/lib/api';

const DAYS_BR = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function NovaCampanha() {
  const router = useRouter();
  const fileRef = useRef();

  const [form, setForm] = useState({
    name: '', description: '', message_text: '',
    media_type: 'none', media_url: '', media_caption: '',
    delay_min_seconds: 10, delay_max_seconds: 30,
    typing_simulation: true,
    target_tags: [],
    send_start_hour: 8, send_end_hour: 20, send_on_weekends: false,
    recurrence_type: 'none',
    recurrence_days: [1,3,5], // Seg, Qua, Sex por padrão
    recurrence_times: ['09:00'],
    recurrence_end_date: '',
    scheduled_at: '',
  });

  const [newTime,  setNewTime]  = useState('14:00');
  const [uploading,setUploading]= useState(false);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');

  // ── Handlers ─────────────────────────────────────────────
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function toggleDay(d) {
    const days = form.recurrence_days.includes(d)
      ? form.recurrence_days.filter(x => x !== d)
      : [...form.recurrence_days, d];
    set('recurrence_days', days);
  }

  function addTime() {
    if (!newTime || form.recurrence_times.includes(newTime)) return;
    set('recurrence_times', [...form.recurrence_times, newTime].sort());
  }

  function removeTime(t) {
    set('recurrence_times', form.recurrence_times.filter(x => x !== t));
  }

  async function handleMediaUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await mediaApi.upload(file);
      const type = res.type;
      set('media_url',  res.url);
      set('media_type', type);
    } catch (err) {
      setError(err.error || 'Erro no upload');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) return setError('Nome obrigatório');
    if (!form.message_text && !form.media_url) return setError('Adicione texto ou mídia');
    if (form.media_url && !form.media_caption) return setError('Legenda obrigatória para imagem/vídeo');
    if (form.delay_max_seconds <= form.delay_min_seconds)
      return setError('Delay máximo deve ser maior que o mínimo');

    setSaving(true);
    try {
      const res = await campaignsApi.create(form);
      router.push('/dashboard/campanhas?created=' + res.created);
    } catch (err) {
      setError(err.error || err.message || 'Erro ao criar campanha');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold">Nova Campanha</h1>
        <p className="text-slate-400 text-sm mt-1">Configure o disparo e o agendamento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Identificação ─── */}
        <Section title="Identificação">
          <Field label="Nome da campanha *">
            <Input placeholder="Ex: Promoção de Páscoa 🐣" value={form.name} onChange={e => set('name', e.target.value)} required />
          </Field>
          <Field label="Descrição (opcional)">
            <Input placeholder="Para uso interno" value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </Section>

        {/* ── Conteúdo ─── */}
        <Section title="Conteúdo da Mensagem">
          <Field label="Texto">
            <textarea
              rows={4} placeholder={"Olá {nome}! Temos uma oferta especial...\n\nVariáveis: {nome}, {telefone}"}
              value={form.message_text} onChange={e => set('message_text', e.target.value)}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] resize-y min-h-[80px] transition-colors"
            />
          </Field>

          <Field label="Mídia (opcional)">
            <select value={form.media_type} onChange={e => set('media_type', e.target.value)}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]">
              <option value="none">Sem mídia — só texto</option>
              <option value="image">🖼 Imagem</option>
              <option value="video">🎥 Vídeo</option>
              <option value="document">📄 Documento/PDF</option>
            </select>
          </Field>

          {form.media_type !== 'none' && (
            <>
              <Field label="Arquivo">
                <div className="flex gap-2 items-center">
                  <input type="file" ref={fileRef} onChange={handleMediaUpload}
                    accept={form.media_type === 'image' ? 'image/*' : form.media_type === 'video' ? 'video/*' : 'application/pdf'}
                    className="hidden" />
                  <button type="button" onClick={() => fileRef.current.click()}
                    className="px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-300 hover:border-[#00e5a0] transition-colors">
                    {uploading ? '⏳ Enviando...' : '📁 Escolher arquivo'}
                  </button>
                  {form.media_url && <span className="text-xs text-[#00e5a0]">✓ Upload concluído</span>}
                </div>
              </Field>
              <Field label="Legenda *">
                <Input placeholder="Legenda obrigatória — aparece abaixo da mídia"
                  value={form.media_caption} onChange={e => set('media_caption', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Suporta variáveis: {'{nome}'}, {'{telefone}'}</p>
              </Field>
            </>
          )}
        </Section>

        {/* ── Comportamento humano ─── */}
        <Section title="Comportamento Humano">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Delay mínimo (segundos)">
              <Input type="number" min={5} value={form.delay_min_seconds}
                onChange={e => set('delay_min_seconds', +e.target.value)} />
            </Field>
            <Field label="Delay máximo (segundos)">
              <Input type="number" min={10} value={form.delay_max_seconds}
                onChange={e => set('delay_max_seconds', +e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início do envio (hora)">
              <Input type="time" value={`${String(form.send_start_hour).padStart(2,'0')}:00`}
                onChange={e => set('send_start_hour', +e.target.value.split(':')[0])} />
            </Field>
            <Field label="Fim do envio (hora)">
              <Input type="time" value={`${String(form.send_end_hour).padStart(2,'0')}:00`}
                onChange={e => set('send_end_hour', +e.target.value.split(':')[0])} />
            </Field>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => set('typing_simulation', !form.typing_simulation)}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.typing_simulation ? 'bg-[#00e5a0]' : 'bg-[#2a3444]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.typing_simulation ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">Simular "digitando..." antes de enviar</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div onClick={() => set('send_on_weekends', !form.send_on_weekends)}
              className={`w-9 h-5 rounded-full transition-colors relative ${form.send_on_weekends ? 'bg-[#00e5a0]' : 'bg-[#2a3444]'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.send_on_weekends ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">Enviar nos finais de semana</span>
          </label>
        </Section>

        {/* ── Agendamento ─── */}
        <Section title="Agendamento">
          <Field label="Tipo de agendamento">
            <select value={form.recurrence_type} onChange={e => set('recurrence_type', e.target.value)}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]">
              <option value="none">Envio imediato (agora)</option>
              <option value="once">Agendamento único</option>
              <option value="daily">Repetir todos os dias</option>
              <option value="weekly">Repetir dias da semana</option>
              <option value="custom">Personalizado</option>
            </select>
          </Field>

          {form.recurrence_type === 'once' && (
            <Field label="Data e hora">
              <Input type="datetime-local" value={form.scheduled_at}
                onChange={e => set('scheduled_at', e.target.value)} />
            </Field>
          )}

          {['weekly','custom','daily'].includes(form.recurrence_type) && (
            <>
              {['weekly','custom'].includes(form.recurrence_type) && (
                <Field label="Dias da semana">
                  <div className="flex gap-2 flex-wrap">
                    {DAYS_BR.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-lg text-xs font-semibold transition-all border
                          ${form.recurrence_days.includes(i)
                            ? 'bg-[#00e5a0] text-black border-[#00e5a0]'
                            : 'bg-transparent text-slate-400 border-[#2a3444] hover:border-slate-400'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Horários de envio">
                <div className="flex gap-2 items-center mb-2">
                  <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                    className="px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] w-28" />
                  <button type="button" onClick={addTime}
                    className="px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-xs text-slate-300 hover:border-[#00e5a0] transition-colors">
                    + Adicionar
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {form.recurrence_times.map(t => (
                    <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono
                      bg-sky-400/10 border border-sky-400/25 text-sky-400">
                      {t}
                      <button type="button" onClick={() => removeTime(t)} className="text-slate-400 hover:text-slate-200 ml-1">×</button>
                    </span>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-1.5">
                  {form.recurrence_times.length} horário(s) = {form.recurrence_times.length} campanha(s) por dia ativo
                </p>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Data início">
                  <Input type="date" value={form.scheduled_at?.slice(0,10) || ''}
                    onChange={e => set('scheduled_at', e.target.value + 'T' + (form.recurrence_times[0] || '09:00'))} />
                </Field>
                <Field label="Data fim (opcional)">
                  <Input type="date" value={form.recurrence_end_date}
                    onChange={e => set('recurrence_end_date', e.target.value)} />
                </Field>
              </div>
            </>
          )}
        </Section>

        {/* Erro */}
        {error && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-3 justify-end pt-2 pb-8">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 text-sm text-slate-400 border border-[#2a3444] rounded-lg hover:text-slate-200 hover:border-slate-400 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={saving || uploading}
            className="px-6 py-2.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? '⏳ Criando...' : '🚀 Criar Campanha'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Componentes auxiliares ─────────────────────────────────
function Section({ title, children }) {
  return (
    <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2733]">
        <h3 className="font-display text-sm font-bold">{title}</h3>
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ ...props }) {
  return (
    <input {...props}
      className={`w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors ${props.className || ''}`}
    />
  );
}
