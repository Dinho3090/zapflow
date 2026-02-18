'use client';
// ─────────────────────────────────────────────────────────
// app/dashboard/agendamento/page.js
// Calendário visual — múltiplas campanhas por dia,
// múltiplos horários, recorrência semanal
// ─────────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import { campaignsApi } from '@/lib/api';
import Link from 'next/link';

const MONTHS  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_BR = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const STATUS_COLOR = {
  scheduled: { bg: 'bg-sky-500/20',   text: 'text-sky-400',   dot: 'bg-sky-400' },
  running:   { bg: 'bg-[#00e5a0]/20', text: 'text-[#00e5a0]', dot: 'bg-[#00e5a0]' },
  paused:    { bg: 'bg-amber-500/20', text: 'text-amber-400',  dot: 'bg-amber-400' },
  done:      { bg: 'bg-slate-500/20', text: 'text-slate-400',  dot: 'bg-slate-500' },
  draft:     { bg: 'bg-slate-600/20', text: 'text-slate-500',  dot: 'bg-slate-600' },
};

export default function AgendamentoPage() {
  const now     = new Date();
  const [year,  setYear]    = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1); // 1-indexed
  const [calendar, setCal]  = useState({});
  const [loading,  setLoad] = useState(true);
  const [selected, setSelected] = useState(null); // dia selecionado

  const load = useCallback(async () => {
    setLoad(true);
    try {
      const data = await campaignsApi.calendar(month, year);
      setCal(data);
    } catch (_) {
      setCal({});
    } finally {
      setLoad(false);
    }
  }, [month, year]);

  useEffect(() => { load(); }, [load]);

  function changeMonth(delta) {
    let m = month + delta, y = year;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m); setYear(y);
    setSelected(null);
  }

  // Gera os dias do mês
  const firstDow  = new Date(year, month - 1, 1).getDay();
  const daysInMon = new Date(year, month, 0).getDate();
  const today     = now.getDate();
  const isThisMonth = now.getFullYear() === year && now.getMonth() + 1 === month;

  const selectedCamps = selected ? (calendar[selected] || []) : [];

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Agendamento</h1>
          <p className="text-slate-400 text-sm mt-0.5">Calendário visual de campanhas</p>
        </div>
        <Link href="/dashboard/campanhas/nova"
          className="flex items-center gap-2 px-4 py-2 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors">
          + Nova Campanha
        </Link>
      </div>

      {/* Card calendário */}
      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">

        {/* Nav do mês */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2733]">
          <button onClick={() => changeMonth(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a3444] text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors text-sm">
            ◀
          </button>
          <h2 className="font-display text-base font-bold">
            {MONTHS[month - 1]} {year}
          </h2>
          <button onClick={() => changeMonth(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#2a3444] text-slate-400 hover:text-slate-200 hover:border-slate-400 transition-colors text-sm">
            ▶
          </button>
        </div>

        {/* Grade dos dias */}
        <div className="p-3">

          {/* Cabeçalho dias da semana */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_BR.map(d => (
              <div key={d} className="text-center text-[11px] font-semibold text-slate-500 py-1">{d}</div>
            ))}
          </div>

          {/* Dias */}
          <div className="grid grid-cols-7 gap-1">

            {/* Células vazias antes do dia 1 */}
            {Array.from({ length: firstDow }).map((_, i) => (
              <div key={`e${i}`} className="min-h-[70px] sm:min-h-[90px]" />
            ))}

            {/* Dias do mês */}
            {Array.from({ length: daysInMon }, (_, i) => i + 1).map(day => {
              const camps    = calendar[day] || [];
              const isToday  = isThisMonth && day === today;
              const isPast   = isThisMonth && day < today;
              const isSel    = selected === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelected(isSel ? null : day)}
                  className={`min-h-[70px] sm:min-h-[90px] rounded-lg p-1.5 text-left border transition-all
                    ${isToday  ? 'border-[#00e5a0] bg-[#00e5a0]/05'   : ''}
                    ${isSel    ? 'border-sky-400 bg-sky-400/05'        : ''}
                    ${!isToday && !isSel ? 'border-[#1e2733] hover:border-[#2a3444]' : ''}
                    ${isPast && !isToday ? 'opacity-50'                : ''}
                  `}
                >
                  <span className={`text-xs font-bold block mb-1
                    ${isToday ? 'text-[#00e5a0]' : 'text-slate-400'}`}>
                    {day}
                  </span>

                  {/* Eventos (mostra até 2 no mobile, 3 no desktop) */}
                  <div className="space-y-0.5">
                    {camps.slice(0, 3).map((c, ci) => {
                      const sc = STATUS_COLOR[c.status] || STATUS_COLOR.draft;
                      const time = c.scheduled_at
                        ? new Date(c.scheduled_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
                        : '';
                      return (
                        <div key={ci}
                          className={`text-[9px] sm:text-[10px] px-1 py-0.5 rounded font-medium truncate leading-tight ${sc.bg} ${sc.text}`}>
                          <span className="hidden sm:inline">{time && `${time} `}</span>
                          {c.name}
                        </div>
                      );
                    })}
                    {camps.length > 3 && (
                      <div className="text-[9px] text-slate-500">+{camps.length - 3}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detalhe do dia selecionado */}
      {selected && (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e2733]">
            <h3 className="font-display font-bold text-sm">
              {selected} de {MONTHS[month - 1]} — {selectedCamps.length} campanha(s)
            </h3>
            <Link href="/dashboard/campanhas/nova"
              className="text-xs px-3 py-1.5 border border-[#2a3444] rounded-lg text-slate-400 hover:text-slate-200 transition-colors">
              + Adicionar neste dia
            </Link>
          </div>

          {selectedCamps.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">
              Nenhuma campanha neste dia.{' '}
              <Link href="/dashboard/campanhas/nova" className="text-[#00e5a0] hover:underline">Criar uma?</Link>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2733]">
              {selectedCamps.map(c => {
                const sc   = STATUS_COLOR[c.status] || STATUS_COLOR.draft;
                const time = c.scheduled_at
                  ? new Date(c.scheduled_at).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })
                  : '—';
                const pct  = c.contacts_total > 0
                  ? Math.round(c.contacts_sent / c.contacts_total * 100)
                  : 0;
                return (
                  <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{c.name}</div>
                      <div className="flex gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-500 font-mono">🕐 {time}</span>
                        <span className="text-xs text-slate-500">📩 {(c.contacts_total||0).toLocaleString('pt-BR')} contatos</span>
                        {c.recurrence_days?.length > 0 && (
                          <span className="text-xs text-sky-400">🔄 Recorrente</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right min-w-[60px]">
                      <div className="text-xs font-mono text-slate-400 mb-1">{pct}%</div>
                      <div className="h-1 bg-[#2a3444] rounded-full overflow-hidden w-16">
                        <div className="h-full bg-[#00e5a0] rounded-full" style={{ width: pct + '%' }} />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {c.status === 'scheduled' && (
                        <button onClick={() => campaignsApi.start(c.id).then(load)}
                          className="w-7 h-7 rounded-md border border-[#2a3444] text-slate-400 hover:text-[#00e5a0] text-xs flex items-center justify-center transition-colors">
                          ▶
                        </button>
                      )}
                      <Link href={`/dashboard/campanhas/${c.id}/relatorio`}
                        className="w-7 h-7 rounded-md border border-[#2a3444] text-slate-400 hover:text-slate-200 text-xs flex items-center justify-center transition-colors">
                        📊
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Lista do mês */}
      {!selected && (
        <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1e2733]">
            <h3 className="font-display font-bold text-sm">Todas as campanhas de {MONTHS[month-1]}</h3>
          </div>
          {loading ? (
            <div className="py-8 text-center text-slate-500 text-sm">Carregando...</div>
          ) : Object.keys(calendar).length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-slate-500 text-sm mb-3">Nenhuma campanha agendada neste mês</p>
              <Link href="/dashboard/campanhas/nova"
                className="text-xs bg-[#00e5a0] text-black px-4 py-2 rounded-lg font-semibold">
                + Criar campanha
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#1e2733]">
              {Object.entries(calendar)
                .sort(([a],[b]) => Number(a) - Number(b))
                .flatMap(([day, camps]) => camps.map((c, i) => ({
                  day: Number(day), camp: c, key: `${day}-${i}`
                })))
                .map(({ day, camp, key }) => {
                  const sc   = STATUS_COLOR[camp.status] || STATUS_COLOR.draft;
                  const time = camp.scheduled_at
                    ? new Date(camp.scheduled_at).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})
                    : '—';
                  return (
                    <div key={key} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#161b24] transition-colors">
                      <div className="w-8 text-center">
                        <span className="text-xs font-mono font-bold text-slate-400">{String(day).padStart(2,'0')}</span>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{camp.name}</div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{time}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${sc.bg} ${sc.text}`}>
                        {camp.status}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
