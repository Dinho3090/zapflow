"use client";
// ─────────────────────────────────────────────────────────
// app/dashboard/contatos/page.js
// Lista, busca, importação CSV/VCF, tags
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from "react";
import { contactsApi } from "../../../lib/api";

export default function ContatosPage() {
  const [contacts, setContacts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState(null);
  const [importTags, setImportTags] = useState("");
  const [showImport, setShowImport] = useState(false);
  const fileRef = useRef();
  const LIMIT = 50;

  const load = useCallback(
    async (p = 1) => {
      setLoading(true);
      try {
        const params = { page: p, limit: LIMIT };
        if (search) params.search = search;
        if (tagFilter) params.tag = tagFilter;
        const res = await contactsApi.list(params);
        setContacts(res.contacts || []);
        setTotal(res.total || 0);
        setPage(p);
      } catch (_) {
      } finally {
        setLoading(false);
      }
    },
    [search, tagFilter]
  );

  useEffect(() => {
    load(1);
  }, [load]);

  useEffect(() => {
    contactsApi
      .tags()
      .then(setAllTags)
      .catch(() => {});
  }, []);

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportRes(null);
    try {
      const tags = importTags
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
      const res = await contactsApi.import(file, tags);
      setImportRes({ ok: true, ...res });
      load(1);
      contactsApi.tags().then(setAllTags);
    } catch (err) {
      setImportRes({ ok: false, error: err.error || "Erro na importação" });
    } finally {
      setImporting(false);
      fileRef.current.value = "";
    }
  }

  async function deleteContact(id) {
    if (!confirm("Remover este contato?")) return;
    await contactsApi.delete(id);
    load(page);
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Contatos</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {total.toLocaleString("pt-BR")} contatos importados
          </p>
        </div>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex items-center gap-2 px-4 py-2 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors"
        >
          📥 Importar
        </button>
      </div>

      {/* Painel de importação */}
      {showImport && (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-4 space-y-3">
          <h3 className="font-display font-bold text-sm">Importar Contatos</h3>
          <div
            onClick={() => fileRef.current.click()}
            className="border-2 border-dashed border-[#2a3444] hover:border-[#00e5a0] rounded-xl p-6 text-center cursor-pointer transition-colors"
          >
            <div className="text-3xl mb-2">📂</div>
            <p className="text-sm font-medium text-slate-300">
              Clique ou arraste o arquivo aqui
            </p>
            <p className="text-xs text-slate-500 mt-1">CSV ou VCF · máx 10MB</p>
            <p className="text-xs text-slate-600 mt-2 font-mono">
              Formato CSV: nome;telefone
            </p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.vcf"
            onChange={handleImport}
            className="hidden"
          />

          <div>
            <label className="text-xs text-slate-400 block mb-1.5">
              Tags padrão (separadas por vírgula)
            </label>
            <input
              value={importTags}
              onChange={e => setImportTags(e.target.value)}
              placeholder="vip, importação-fev, clientes"
              className="w-full px-3 py-2 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors"
            />
          </div>

          {importing && (
            <p className="text-sm text-[#00e5a0] font-mono">⏳ Importando...</p>
          )}
          {importRes && (
            <div
              className={`px-4 py-3 rounded-lg text-sm border ${
                importRes.ok
                  ? "bg-[#00e5a0]/10 border-[#00e5a0]/30 text-[#00e5a0]"
                  : "bg-red-500/10 border-red-500/30 text-red-400"
              }`}
            >
              {importRes.ok
                ? `✅ ${importRes.imported} importados · ${importRes.skipped || 0} duplicados`
                : `❌ ${importRes.error}`}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Buscar por nome..."
          className="px-3 py-2 bg-[#0f1319] border border-[#1e2733] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors w-full sm:w-56"
        />
        <select
          value={tagFilter}
          onChange={e => setTagFilter(e.target.value)}
          className="px-3 py-2 bg-[#0f1319] border border-[#1e2733] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0] transition-colors"
        >
          <option value="">Todas as tags</option>
          {allTags.map(t => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#161b24] border-b border-[#1e2733]">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-mono">
                  Nome
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-mono">
                  Telefone
                </th>
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-mono hidden sm:table-cell">
                  Tags
                </th>
                <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide font-mono">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-slate-500 text-sm"
                  >
                    Carregando...
                  </td>
                </tr>
              ) : contacts.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-10 text-center text-slate-500 text-sm"
                  >
                    {search || tagFilter
                      ? "Nenhum contato encontrado"
                      : "Nenhum contato ainda. Importe seu primeiro arquivo."}
                  </td>
                </tr>
              ) : (
                contacts.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-[#1e2733] hover:bg-[#161b24] transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <div className="text-sm font-medium text-slate-200">
                        {c.name || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-sm font-mono text-slate-400">
                        +{c.phone}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(c.tags || []).slice(0, 3).map(t => (
                          <span
                            key={t}
                            className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-400/10 text-sky-400 border border-sky-400/20 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                        {(c.tags || []).length > 3 && (
                          <span className="text-[10px] text-slate-500">
                            +{c.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => deleteContact(c.id)}
                        className="text-slate-500 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#1e2733]">
            <p className="text-xs text-slate-500 font-mono">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} de{" "}
              {total.toLocaleString("pt-BR")}
            </p>
            <div className="flex gap-1">
              <button
                disabled={page === 1}
                onClick={() => load(page - 1)}
                className="px-3 py-1.5 text-xs border border-[#2a3444] rounded-lg text-slate-400 disabled:opacity-30 hover:text-slate-200 transition-colors"
              >
                ← Ant
              </button>
              <button
                disabled={page === pages}
                onClick={() => load(page + 1)}
                className="px-3 py-1.5 text-xs border border-[#2a3444] rounded-lg text-slate-400 disabled:opacity-30 hover:text-slate-200 transition-colors"
              >
                Próx →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
