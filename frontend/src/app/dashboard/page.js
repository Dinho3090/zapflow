"use client";
export const dynamic = "force-dynamic";
// ─────────────────────────────────────────────────────────
// app/dashboard/page.js — Home do Painel
// Stats em tempo real + campanhas ativas + log ao vivo
// ─────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { campaignsApi, whatsappApi } from "../../lib/api";
import Link from "next/link";

// ── Sub-componentes ────────────────────────────────────────

function StatCard({ icon, value, label, change, changeUp, color }) {
  return (
    <div
      className={`bg-[#0f1319] border border-[#1e2733] rounded-xl p-4 relative overflow-hidden`}
    >
      <div
        className={`absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.06] -translate-y-1/2 translate-x-1/2`}
        style={{ background: color }}
      />
      <div className="text-lg mb-2">{icon}</div>
      <div className="font-display text-3xl font-bold mb-1" style={{ color }}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
      {change && (
        <div
          className={`text-xs mt-2 font-mono ${changeUp ? "text-[#00e5a0]" : "text-red-400"}`}
        >
          {changeUp ? "↑" : "↓"} {change}
        </div>
      )}
    </div>
  );
}

function CampaignRow({ camp }) {
  const pct =
    camp.contacts_total > 0
      ? Math.round((camp.contacts_sent / camp.contacts_total) * 100)
      : 0;

  const statusConfig = {
    running: {
      dot: "bg-[#00e5a0] animate-pulse-dot shadow-[0_0_8px_#00e5a0]",
      label: "● Rodando",
      color: "text-[#00e5a0]",
    },
    scheduled: {
      dot: "bg-sky-400",
      label: "⏰ Agendado",
      color: "text-sky-400",
    },
    paused: {
      dot: "bg-amber-400",
      label: "⏸ Pausado",
      color: "text-amber-400",
    },
    done: {
      dot: "bg-slate-500",
      label: "✓ Concluído",
      color: "text-slate-500",
    },
    draft: {
      dot: "bg-slate-600",
      label: "✏ Rascunho",
      color: "text-slate-500",
    },
  };
  const s = statusConfig[camp.status] || statusConfig.draft;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#161b24] transition-colors cursor-pointer">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{camp.name}</div>
        <div className="flex gap-3 flex-wrap mt-0.5">
          <span className="text-xs text-slate-500">
            📩 {camp.contacts_total.toLocaleString("pt-BR")}
          </span>
          <span className={`text-xs ${s.color}`}>{s.label}</span>
        </div>
      </div>
      <div className="w-[88px] flex-shrink-0">
        <div className="text-xs text-slate-500 text-right mb-1 font-mono">
          {pct}%
        </div>
        <div className="h-1 bg-[#2a3444] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#00e5a0] transition-all"
            style={{ width: pct + "%" }}
          />
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        {camp.status === "running" && (
          <button
            onClick={() => campaignsApi.pause(camp.id)}
            className="w-7 h-7 rounded-md border border-[#2a3444] text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center"
          >
            ⏸
          </button>
        )}
        {camp.status === "paused" && (
          <button
            onClick={() => campaignsApi.resume(camp.id)}
            className="w-7 h-7 rounded-md border border-[#2a3444] text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center"
          >
            ▶
          </button>
        )}
        <Link
          href={`/dashboard/campanhas/${camp.id}/relatorio`}
          className="w-7 h-7 rounded-md border border-[#2a3444] text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center"
        >
          📊
        </Link>
      </div>
    </div>
  );
}

const LOG_STATUSES = ["sent", "delivered", "read", "failed"];
const LOG_LABELS = {
  sent: "enviado",
  delivered: "entregue",
  read: "lido",
  failed: "falhou",
};
const LOG_COLORS = {
  sent: "text-[#00e5a0] bg-[#00e5a0]/10",
  delivered: "text-sky-400 bg-sky-400/10",
  read: "text-violet-400 bg-violet-400/10",
  failed: "text-red-400 bg-red-400/10",
};
const LOG_DOT = {
  sent: "bg-[#00e5a0]",
  delivered: "bg-sky-400",
  read: "bg-violet-400",
  failed: "bg-red-400",
};

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignsApi
      .list({ status: "running" })
      .then(data => setCampaigns(data.slice(0, 6)))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Simula log ao vivo (substituir por websocket/realtime do Supabase em produção)
    const phones = ["11 99999", "21 98888", "31 97777", "41 96666", "85 95555"];
    const camps = [
      "Promoção Carnaval 🎉",
      "Recuperação de Clientes",
      "Lembrete",
    ];
    const addLog = () => {
      const st = LOG_STATUSES[Math.floor(Math.random() * LOG_STATUSES.length)];
      const ph = `+55 ${phones[Math.floor(Math.random() * phones.length)]}-${Math.floor(Math.random() * 9e3 + 1e3)}`;
      setLogs(prev =>
        [
          {
            id: Date.now(),
            phone: ph,
            status: st,
            camp: camps[Math.floor(Math.random() * camps.length)],
            ts: new Date(),
          },
          ...prev,
        ].slice(0, 10)
      );
    };
    addLog();
    const iv = setInterval(addLog, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="✉️"
          value="7.234"
          label="Mensagens enviadas"
          change="+23% este mês"
          changeUp
          color="#00e5a0"
        />
        <StatCard
          icon="📣"
          value="3"
          label="Campanhas ativas"
          change="1 nova hoje"
          changeUp
          color="#0ea5e9"
        />
        <StatCard
          icon="👥"
          value="2.891"
          label="Contatos"
          change="+120 esta semana"
          changeUp
          color="#f59e0b"
        />
        <StatCard
          icon="📈"
          value="94,2%"
          label="Taxa de entrega"
          change="-0.8% ontem"
          changeUp={false}
          color="#a78bfa"
        />
      </div>

      {/* Grid dupla */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-4">
        {/* Campanhas ativas */}
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2733]">
            <div>
              <h2 className="font-display text-sm font-bold">
                Campanhas Ativas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Acompanhe os disparos em tempo real
              </p>
            </div>
            <Link
              href="/dashboard/campanhas"
              className="text-xs text-slate-400 hover:text-slate-200 border border-[#2a3444] rounded-lg px-3 py-1.5 transition-colors"
            >
              Ver todas
            </Link>
          </div>
          <div className="p-2">
            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                Carregando...
              </div>
            ) : campaigns.length > 0 ? (
              campaigns.map(c => <CampaignRow key={c.id} camp={c} />)
            ) : (
              <div className="py-8 text-center">
                <p className="text-slate-500 text-sm mb-3">
                  Nenhuma campanha ativa
                </p>
                <Link
                  href="/dashboard/campanhas/nova"
                  className="text-xs bg-[#00e5a0] text-black px-3 py-1.5 rounded-lg font-semibold"
                >
                  + Criar campanha
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Log ao vivo */}
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e2733]">
            <h2 className="font-display text-sm font-bold">
              Log em Tempo Real
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Confirmações de entrega
            </p>
          </div>
          <div className="p-2 space-y-0.5 max-h-[420px] overflow-y-auto">
            {logs.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[#161b24] transition-colors animate-fade-in"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${LOG_DOT[log.status]}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono truncate text-slate-300">
                    {log.phone}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {log.camp}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono flex-shrink-0 ${LOG_COLORS[log.status]}`}
                >
                  {LOG_LABELS[log.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
