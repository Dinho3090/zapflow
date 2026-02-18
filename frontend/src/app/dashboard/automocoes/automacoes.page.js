'use client';
// ─────────────────────────────────────────────────────────
// app/dashboard/automacoes/page.js
// Chatbot: menu numerado, palavras-chave,
// fluxo multi-passo, respostas com mídia
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { automationsApi } from '@/lib/api';

const NODE_COLORS = {
  message:   { badge: 'bg-[#00e5a0]/10 text-[#00e5a0] border-[#00e5a0]/30', icon: '💬' },
  menu:      { badge: 'bg-sky-400/10 text-sky-400 border-sky-400/30',        icon: '📋' },
  wait:      { badge: 'bg-amber-400/10 text-amber-400 border-amber-400/30',  icon: '⏳' },
  condition: { badge: 'bg-violet-400/10 text-violet-400 border-violet-400/30', icon: '🔀' },
};

const NODE_TYPES = ['message','menu','wait'];

function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${on ? 'bg-[#00e5a0]' : 'bg-[#2a3444]'}`}>
      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  );
}

function FlowNode({ node, index, onChange, onRemove, isLast }) {
  const nc = NODE_COLORS[node.type] || NODE_COLORS.message;
  return (
    <div className="relative">
      <div className="flex gap-2.5 p-3 bg-[#161b24] border border-[#2a3444] rounded-xl">
        {/* Tipo */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono ${nc.badge}`}>
            {nc.icon} {node.type}
          </span>
          {!isLast && <div className="w-px flex-1 bg-[#2a3444] min-h-[16px]" />}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <select value={node.type} onChange={e => onChange({ ...node, type: e.target.value })}
              className="text-xs bg-transparent border border-[#2a3444] rounded-lg px-2 py-1 text-slate-300 outline-none">
              {NODE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {index > 0 && (
              <button onClick={onRemove} className="ml-auto text-slate-500 hover:text-red-400 transition-colors text-xs">🗑</button>
            )}
          </div>

          {node.type === 'wait' ? (
            <p className="text-xs text-slate-500 italic">Aguarda a próxima mensagem do usuário</p>
          ) : (
            <textarea
              rows={2} value={node.content || ''}
              onChange={e => onChange({ ...node, content: e.target.value })}
              placeholder={node.type === 'menu' ? 'Texto do menu...\nEx: Como posso ajudar?' : 'Texto da mensagem...'}
              className="w-full text-sm bg-[#0f1319] border border-[#1e2733] rounded-lg px-2.5 py-1.5 text-slate-200 outline-none focus:border-[#00e5a0] resize-none transition-colors"
            />
          )}

          {node.type === 'menu' && (
            <div className="text-xs text-slate-500 bg-[#0f1319] rounded-lg px-2.5 py-2 space-y-1 border border-[#1e2733]">
              <p className="font-semibold text-slate-400 mb-1.5">Opções do menu:</p>
              {(node.options || []).map((opt, oi) => (
                <div key={oi} className="flex gap-1.5 items-center">
                  <span className="font-mono font-bold text-[#00e5a0] w-4">{opt.key}</span>
                  <input value={opt.label}
                    onChange={e => {
                      const opts = [...(node.options || [])];
                      opts[oi] = { ...opts[oi], label: e.target.value };
                      onChange({ ...node, options: opts });
                    }}
                    className="flex-1 bg-transparent border-b border-[#2a3444] px-1 text-slate-300 outline-none"
                    placeholder="Rótulo da opção"
                  />
                  <button onClick={() => {
                    const opts = (node.options || []).filter((_, i) => i !== oi);
                    onChange({ ...node, options: opts });
                  }} className="text-slate-600 hover:text-red-400 text-xs">×</button>
                </div>
              ))}
              <button onClick={() => {
                const next = ((node.options || []).length + 1).toString();
                const opts = [...(node.options || []), { key: next, label: '', next_node_order: index + 1 }];
                onChange({ ...node, options: opts });
              }} className="text-[#00e5a0] text-[10px] hover:underline mt-1">+ Adicionar opção</button>
            </div>
          )}
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center my-0.5">
          <span className="text-slate-700 text-sm">│</span>
        </div>
      )}
    </div>
  );
}

// ── Modal de criação/edição ────────────────────────────────
function AutomationModal({ open, onClose, onSave, initial }) {
  const [name,     setName]     = useState(initial?.name || '');
  const [trigger,  setTrigger]  = useState(initial?.trigger_type || 'keyword');
  const [keywords, setKeywords] = useState((initial?.trigger_keywords || []).join(', '));
  const [nodes,    setNodes]    = useState(initial?.automation_nodes || [
    { order: 0, type: 'message', content: 'Olá {nome}! Como posso ajudar? 😊', options: null },
    { order: 1, type: 'menu',    content: 'Escolha uma opção:', options: [
      { key: '1', label: 'Suporte',   next_node_order: 2 },
      { key: '2', label: 'Vendas',    next_node_order: 3 },
      { key: '3', label: 'Horários',  next_node_order: 2 },
    ]},
    { order: 2, type: 'wait', content: null, options: null },
  ]);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function updateNode(i, n) { setNodes(ns => ns.map((x, j) => j === i ? n : x)); }
  function addNode()        { setNodes(ns => [...ns, { order: ns.length, type: 'message', content: '', options: null }]); }
  function removeNode(i)    { setNodes(ns => ns.filter((_, j) => j !== i).map((n, j) => ({ ...n, order: j }))); }

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({
        name,
        trigger_type:     trigger,
        trigger_keywords: keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean),
        active:           true,
        nodes,
      });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-[500] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0f1319] border border-[#1e2733] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">

        <div className="sticky top-0 bg-[#0f1319] px-5 py-4 border-b border-[#1e2733] flex items-center justify-between z-10">
          <h2 className="font-display font-bold text-base">
            {initial ? 'Editar' : 'Nova'} Automação
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Menu de Atendimento"
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors" />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-xs text-slate-400 block mb-1.5">Ativado por</label>
            <select value={trigger} onChange={e => setTrigger(e.target.value)}
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors">
              <option value="keyword">Palavra-chave</option>
              <option value="always">Toda mensagem recebida</option>
            </select>
          </div>

          {trigger === 'keyword' && (
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Palavras-chave (separadas por vírgula)</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)}
                placeholder="oi, olá, bom dia, menu, hello"
                className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors" />
              <p className="text-xs text-slate-500 mt-1">O bot responde quando o usuário digitar qualquer uma dessas palavras</p>
            </div>
          )}

          {/* Flow builder */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">Fluxo de mensagens</label>
              <button onClick={addNode} className="text-xs text-[#00e5a0] hover:underline">+ Adicionar nó</button>
            </div>
            <div className="space-y-0">
              {nodes.map((n, i) => (
                <FlowNode key={i} node={n} index={i}
                  onChange={upd => updateNode(i, upd)}
                  onRemove={() => removeNode(i)}
                  isLast={i === nodes.length - 1}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0f1319] px-5 py-4 border-t border-[#1e2733] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 border border-[#2a3444] rounded-lg hover:text-slate-200 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving || !name.trim()}
            className="px-5 py-2 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
            {saving ? '⏳ Salvando...' : '💾 Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ───────────────────────────────────────
export default function AutomacoesPage() {
  const [automations, setAutomations] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editing,     setEditing]     = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await automationsApi.list();
      setAutomations(data);
    } catch (_) {}
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function toggle(auto) {
    await automationsApi.update(auto.id, { active: !auto.active });
    setAutomations(prev => prev.map(a => a.id === auto.id ? { ...a, active: !a.active } : a));
  }

  async function deleteAuto(id) {
    if (!confirm('Remover esta automação?')) return;
    await automationsApi.delete(id);
    setAutomations(prev => prev.filter(a => a.id !== id));
  }

  async function saveAuto(data) {
    if (editing) {
      await automationsApi.update(editing.id, data);
    } else {
      await automationsApi.create(data);
    }
    load();
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Automações</h1>
          <p className="text-slate-400 text-sm mt-0.5">Chatbot e respostas automáticas</p>
        </div>
        <button onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors">
          + Nova Automação
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-500 text-sm">Carregando...</div>
      ) : automations.length === 0 ? (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl py-12 text-center">
          <div className="text-4xl mb-3">🤖</div>
          <p className="text-slate-400 text-sm mb-4">Nenhuma automação criada ainda</p>
          <button onClick={() => setModalOpen(true)}
            className="text-sm bg-[#00e5a0] text-black px-5 py-2 rounded-lg font-semibold">
            Criar primeira automação
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {automations.map(auto => {
            const nodes = auto.automation_nodes || [];
            return (
              <div key={auto.id} className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
                <div className="flex items-start gap-3 px-4 py-3 border-b border-[#1e2733]">
                  <div className="w-10 h-10 rounded-lg bg-[#161b24] flex items-center justify-center text-xl flex-shrink-0">
                    🤖
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{auto.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {auto.trigger_type === 'keyword'
                        ? `Keyword: ${(auto.trigger_keywords || []).join(', ') || '—'}`
                        : 'Toda mensagem recebida'}
                      {' · '}{nodes.length} nó(s)
                    </div>
                  </div>
                  <Toggle on={auto.active} onChange={() => toggle(auto)} />
                </div>

                {/* Preview do fluxo */}
                <div className="px-4 py-3 space-y-1.5 max-h-[180px] overflow-y-auto">
                  {nodes.slice(0, 4).map((n, i) => {
                    const nc = NODE_COLORS[n.type] || NODE_COLORS.message;
                    return (
                      <div key={i} className="flex items-start gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-mono flex-shrink-0 mt-0.5 ${nc.badge}`}>
                          {nc.icon} {n.type}
                        </span>
                        <p className="text-xs text-slate-400 truncate flex-1">
                          {n.type === 'wait' ? 'Aguarda resposta...' : n.content || '—'}
                        </p>
                      </div>
                    );
                  })}
                  {nodes.length > 4 && (
                    <p className="text-[11px] text-slate-600">+{nodes.length - 4} nós</p>
                  )}
                </div>

                <div className="flex gap-2 px-4 py-2.5 border-t border-[#1e2733]">
                  <button onClick={() => { setEditing(auto); setModalOpen(true); }}
                    className="text-xs px-3 py-1.5 border border-[#2a3444] rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
                    ✏️ Editar
                  </button>
                  <button onClick={() => deleteAuto(auto.id)}
                    className="text-xs px-3 py-1.5 border border-red-500/30 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors ml-auto">
                    🗑 Remover
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AutomationModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSave={saveAuto}
        initial={editing}
      />
    </div>
  );
}
