'use client';
import { useState, useEffect } from 'react';

export default function AdminPage() {
  const [tenants, setTenants] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, trial: 0, totalMsgs: 0 });
  const [loading, setLoading] = useState(true);
  const [adminKey, setAdminKey] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(null);
  const [showUnblockModal, setShowUnblockModal] = useState(null);
  const [blockReason, setBlockReason] = useState('Inadimplência');
  const [unblockPlan, setUnblockPlan] = useState('pro');
  const [unblockDays, setUnblockDays] = useState(30);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const key = localStorage.getItem('admin_key');
    if (key) {
      setAdminKey(key);
      loadData(key);
    }
  }, []);

  async function loadData(key) {
    setLoading(true);
    try {
      const [tenantsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/admin/tenants`, { headers: { 'x-admin-key': key } }),
        fetch(`${API_URL}/admin/stats`, { headers: { 'x-admin-key': key } }),
      ]);
      if (!tenantsRes.ok) throw new Error('Chave inválida');
      setTenants(await tenantsRes.json());
      setStats(await statsRes.json());
    } catch (err) {
      alert('Erro: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    localStorage.setItem('admin_key', adminKey);
    loadData(adminKey);
  }

  async function handleBlock(id) {
    await fetch(`${API_URL}/admin/tenants/${id}/block`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: blockReason }),
    });
    setShowBlockModal(null);
    loadData(adminKey);
  }

  async function handleUnblock(id) {
    await fetch(`${API_URL}/admin/tenants/${id}/unblock`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: unblockPlan, days: unblockDays }),
    });
    setShowUnblockModal(null);
    loadData(adminKey);
  }

  if (!adminKey || loading) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500 text-white text-xl mb-4">🔒</div>
            <h1 className="font-display text-2xl font-bold text-white">Admin ZapFlow</h1>
            <p className="text-slate-400 text-sm mt-1">Acesso restrito</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input type="password" placeholder="Admin Key" value={adminKey} onChange={e => setAdminKey(e.target.value)} required
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-red-500" />
            <button type="submit" className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg">Entrar</button>
          </form>
        </div>
      </div>
    );
  }

  const filtered = tenants.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#080b10] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div><h1 className="font-display text-3xl font-bold text-white">Admin Panel</h1><p className="text-slate-400 text-sm mt-1">Gestão de clientes</p></div>
          <button onClick={() => { localStorage.removeItem('admin_key'); setAdminKey(''); }} className="px-4 py-2 text-sm text-slate-400 hover:text-white">Sair</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'bg-slate-500' },
            { label: 'Ativos', value: stats.active, color: 'bg-green-500' },
            { label: 'Trial', value: stats.trial, color: 'bg-blue-500' },
            { label: 'Suspensos', value: stats.suspended, color: 'bg-red-500' },
            { label: 'Msgs/Mês', value: stats.totalMsgs, color: 'bg-violet-500' },
          ].map(s => (
            <div key={s.label} className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-4">
              <div className="text-xs text-slate-500 mb-2">{s.label}</div>
              <div className="font-display text-2xl font-bold text-white">{s.value?.toLocaleString('pt-BR') || 0}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <input placeholder="🔍 Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] px-3 py-2 bg-[#0f1319] border border-[#1e2733] rounded-lg text-sm outline-none focus:border-[#00e5a0]" />
          {['all', 'active', 'trial', 'suspended'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${filter === f ? 'bg-[#00e5a0] text-black' : 'bg-[#0f1319] text-slate-400 border border-[#1e2733]'}`}>
              {f === 'all' ? 'Todos' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#161b24] border-b border-[#1e2733]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Plano</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">WhatsApp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Uso</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2733]">
                {filtered.map(t => {
                  const usagePct = t.messages_limit_month > 0 ? (t.messages_sent_month / t.messages_limit_month * 100).toFixed(0) : 0;
                  return (
                    <tr key={t.id} className="hover:bg-[#161b24]">
                      <td className="px-4 py-3"><div className="font-medium text-sm">{t.name}</div><div className="text-xs text-slate-500">{t.email}</div></td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400">{t.plan}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${t.status === 'active' ? 'bg-green-500/20 text-green-400' : t.status === 'suspended' ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>{t.status}</span></td>
                      <td className="px-4 py-3"><span className={`w-2 h-2 rounded-full inline-block ${t.wa_status === 'connected' ? 'bg-green-400' : 'bg-slate-600'}`}></span></td>
                      <td className="px-4 py-3"><div className="text-xs font-mono">{t.messages_sent_month}/{t.messages_limit_month}</div><div className="w-20 h-1 bg-[#2a3444] rounded-full mt-1"><div className="h-full bg-[#00e5a0] rounded-full" style={{width: usagePct + '%'}}></div></div></td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {t.status === 'suspended' ? (
                          <button onClick={() => setShowUnblockModal(t)} className="text-xs px-3 py-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30">Reativar</button>
                        ) : (
                          <button onClick={() => setShowBlockModal(t)} className="text-xs px-3 py-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">Suspender</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowBlockModal(null)}>
          <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold mb-4">Suspender Cliente</h2>
            <p className="text-sm text-slate-400 mb-4">Cliente: <strong>{showBlockModal.name}</strong></p>
            <select value={blockReason} onChange={e => setBlockReason(e.target.value)} className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm mb-4">
              <option>Inadimplência</option>
              <option>Violação de termos</option>
              <option>Spam</option>
              <option>Solicitação do cliente</option>
              <option>Outro</option>
            </select>
            <div className="flex gap-3">
              <button onClick={() => setShowBlockModal(null)} className="flex-1 py-2 border border-[#2a3444] rounded-lg text-sm">Cancelar</button>
              <button onClick={() => handleBlock(showBlockModal.id)} className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold">Suspender</button>
            </div>
          </div>
        </div>
      )}

      {/* Unblock Modal */}
      {showUnblockModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4" onClick={() => setShowUnblockModal(null)}>
          <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h2 className="font-display text-xl font-bold mb-4">Reativar Cliente</h2>
            <p className="text-sm text-slate-400 mb-4">Cliente: <strong>{showUnblockModal.name}</strong></p>
            <div className="space-y-3 mb-4">
              <select value={unblockPlan} onChange={e => setUnblockPlan(e.target.value)} className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm">
                <option value="trial">Trial</option>
                <option value="basic">Basic</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <input type="number" value={unblockDays} onChange={e => setUnblockDays(e.target.value)} placeholder="Dias de validade" className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowUnblockModal(null)} className="flex-1 py-2 border border-[#2a3444] rounded-lg text-sm">Cancelar</button>
              <button onClick={() => handleUnblock(showUnblockModal.id)} className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-semibold">Reativar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
