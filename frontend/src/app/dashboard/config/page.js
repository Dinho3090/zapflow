'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function ConfigPage() {
  const [tenant, setTenant] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from('tenants').select('*').eq('auth_user_id', session.user.id).single()
        .then(({ data }) => {
          setTenant(data);
          setName(data.name);
          setEmail(data.email);
        });
    });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await supabase.from('tenants').update({ name, email }).eq('id', tenant.id);
      setMessage('Salvo com sucesso!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return <div className="py-20 text-center text-slate-400">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Configurações</h1><p className="text-slate-400 text-sm mt-1">Gerencie sua conta</p></div>

      <form onSubmit={handleSave} className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Nome da Empresa</label>
          <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm outline-none focus:border-[#00e5a0]" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-2">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm outline-none focus:border-[#00e5a0]" />
        </div>
        {message && <div className={`px-4 py-3 rounded-lg text-sm ${message.includes('sucesso') ? 'bg-[#00e5a0]/10 text-[#00e5a0]' : 'bg-red-500/10 text-red-400'}`}>{message}</div>}
        <button type="submit" disabled={saving} className="px-5 py-2.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar Alterações'}</button>
      </form>

      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6">
        <h2 className="font-display font-bold mb-2 text-red-400">Zona de Perigo</h2>
        <p className="text-sm text-slate-400 mb-4">Ações irreversíveis</p>
        <button className="px-5 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold rounded-lg hover:bg-red-500/20">Cancelar Conta</button>
      </div>
    </div>
  );
}
