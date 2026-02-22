'use client';
import { useState, useEffect } from 'react';
import { mediaApi } from '@/lib/api';

export default function MidiaPage() {
  const [media, setMedia] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const type = filter === 'all' ? null : filter;
    mediaApi.list(type).then(setMedia).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filter]);

  async function handleDelete(id) {
    if (!confirm('Remover esta mídia?')) return;
    await mediaApi.delete(id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="font-display text-2xl font-bold">Biblioteca de Mídia</h1><p className="text-slate-400 text-sm mt-1">{media.length} arquivos</p></div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="px-3 py-2 bg-[#0f1319] border border-[#1e2733] rounded-lg text-sm">
          <option value="all">Todos</option>
          <option value="image">Imagens</option>
          <option value="video">Vídeos</option>
          <option value="document">Documentos</option>
        </select>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">Carregando...</div>
      ) : media.length === 0 ? (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl py-20 text-center">
          <div className="text-4xl mb-3">🖼️</div>
          <p className="text-slate-400">Nenhuma mídia ainda. Faça upload ao criar uma campanha.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map(m => (
            <div key={m.id} className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden group">
              <div className="aspect-square bg-[#161b24] flex items-center justify-center relative">
                {m.type === 'image' ? (
                  <img src={m.url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-4xl">{m.type === 'video' ? '🎥' : '📄'}</div>
                )}
                <button onClick={() => handleDelete(m.id)} className="absolute top-2 right-2 w-8 h-8 bg-red-500/90 hover:bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">🗑</button>
              </div>
              <div className="p-3">
                <div className="text-xs font-medium truncate">{m.name}</div>
                <div className="text-xs text-slate-500 mt-1">{(m.size_bytes / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
