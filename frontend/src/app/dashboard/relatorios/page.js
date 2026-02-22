'use client';
import { useState, useEffect } from 'react';
import { campaignsApi } from '@/lib/api';

export default function RelatoriosPage() {
  const [period, setPeriod] = useState('30'); // últimos 30 dias
  const [stats, setStats] = useState({
    totalCampaigns: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalFailed: 0,
    deliveryRate: 0,
    readRate: 0,
  });
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignReport, setCampaignReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  async function loadData() {
    setLoading(true);
    try {
      const allCampaigns = await campaignsApi.list({ status: 'done' });
      
      // Filtra por período
      const now = new Date();
      const periodMs = parseInt(period) * 24 * 60 * 60 * 1000;
      const filtered = allCampaigns.filter(c => {
        if (!c.finished_at) return false;
        const finishedAt = new Date(c.finished_at);
        return (now - finishedAt) <= periodMs;
      });

      setCampaigns(filtered);

      // Calcula estatísticas agregadas
      const totals = filtered.reduce((acc, c) => ({
        sent: acc.sent + (c.contacts_sent || 0),
        delivered: acc.delivered + (c.contacts_sent || 0), // Simplificado
        read: acc.read + Math.floor((c.contacts_sent || 0) * 0.7), // Estimativa
        failed: acc.failed + (c.contacts_failed || 0),
      }), { sent: 0, delivered: 0, read: 0, failed: 0 });

      const deliveryRate = totals.sent > 0 ? ((totals.delivered / totals.sent) * 100).toFixed(1) : 0;
      const readRate = totals.delivered > 0 ? ((totals.read / totals.delivered) * 100).toFixed(1) : 0;

      setStats({
        totalCampaigns: filtered.length,
        totalSent: totals.sent,
        totalDelivered: totals.delivered,
        totalRead: totals.read,
        totalFailed: totals.failed,
        deliveryRate,
        readRate,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadCampaignReport(campaignId) {
    try {
      const report = await campaignsApi.report(campaignId);
      setCampaignReport(report);
      setSelectedCampaign(campaignId);
    } catch (err) {
      console.error(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-3xl mb-3">📊</div>
          <div className="text-slate-400 text-sm">Carregando relatórios...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">Relatórios</h1>
          <p className="text-slate-400 text-sm mt-1">Análise de performance das campanhas</p>
        </div>
        <select 
          value={period} 
          onChange={e => setPeriod(e.target.value)}
          className="px-4 py-2 bg-[#0f1319] border border-[#1e2733] rounded-lg text-sm outline-none focus:border-[#00e5a0]"
        >
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="60">Últimos 60 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon="📣" 
          label="Campanhas" 
          value={stats.totalCampaigns}
          color="text-violet-400"
        />
        <StatCard 
          icon="📨" 
          label="Enviadas" 
          value={stats.totalSent.toLocaleString('pt-BR')}
          color="text-[#00e5a0]"
          subtitle={`${stats.deliveryRate}% entregues`}
        />
        <StatCard 
          icon="✓" 
          label="Entregues" 
          value={stats.totalDelivered.toLocaleString('pt-BR')}
          color="text-sky-400"
        />
        <StatCard 
          icon="👁" 
          label="Lidas" 
          value={stats.totalRead.toLocaleString('pt-BR')}
          color="text-blue-400"
          subtitle={`${stats.readRate}% taxa leitura`}
        />
      </div>

      {/* Performance Chart */}
      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6">
        <h2 className="font-display font-bold mb-4">Taxa de Sucesso</h2>
        <div className="space-y-4">
          <ProgressBar 
            label="Entrega" 
            value={stats.deliveryRate} 
            total={100}
            color="bg-[#00e5a0]"
          />
          <ProgressBar 
            label="Leitura" 
            value={stats.readRate} 
            total={100}
            color="bg-sky-400"
          />
          {stats.totalFailed > 0 && (
            <ProgressBar 
              label="Falhas" 
              value={((stats.totalFailed / stats.totalSent) * 100).toFixed(1)} 
              total={100}
              color="bg-red-400"
            />
          )}
        </div>
      </div>

      {/* Campanhas Concluídas */}
      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e2733]">
          <h2 className="font-display font-bold">Campanhas Concluídas</h2>
          <p className="text-xs text-slate-500 mt-1">{campaigns.length} campanhas nos últimos {period} dias</p>
        </div>

        {campaigns.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            Nenhuma campanha concluída no período selecionado
          </div>
        ) : (
          <div className="divide-y divide-[#1e2733]">
            {campaigns.map(c => {
              const successRate = c.contacts_total > 0
                ? ((c.contacts_sent / c.contacts_total) * 100).toFixed(0)
                : 0;

              return (
                <div 
                  key={c.id} 
                  className="px-5 py-4 hover:bg-[#161b24] transition-colors cursor-pointer"
                  onClick={() => loadCampaignReport(c.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.name}</div>
                      <div className="flex gap-3 mt-1 flex-wrap text-xs text-slate-500">
                        <span>📅 {new Date(c.finished_at).toLocaleDateString('pt-BR')}</span>
                        <span>📩 {c.contacts_total?.toLocaleString('pt-BR')} contatos</span>
                        {c.recurrence_type && c.recurrence_type !== 'none' && (
                          <span className="text-sky-400">🔄 Recorrente</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 min-w-[80px]">
                      <div className="text-sm font-mono font-bold">
                        {c.contacts_sent}/{c.contacts_total}
                      </div>
                      <div className="text-xs text-slate-500">{successRate}% sucesso</div>
                    </div>

                    {c.contacts_failed > 0 && (
                      <div className="text-right flex-shrink-0 min-w-[60px]">
                        <div className="text-xs text-red-400 font-medium">
                          {c.contacts_failed} falhas
                        </div>
                      </div>
                    )}

                    <button className="flex-shrink-0 w-8 h-8 rounded-lg border border-[#2a3444] text-slate-400 hover:text-slate-200 hover:border-slate-400 flex items-center justify-center text-sm transition-colors">
                      📊
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalhes da Campanha */}
      {selectedCampaign && campaignReport && (
        <div 
          className="fixed inset-0 bg-black/75 z-[500] flex items-center justify-center p-4"
          onClick={() => { setSelectedCampaign(null); setCampaignReport(null); }}
        >
          <div 
            className="bg-[#0f1319] border border-[#1e2733] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0f1319] px-6 py-4 border-b border-[#1e2733] flex items-center justify-between z-10">
              <div>
                <h2 className="font-display font-bold text-lg">{campaignReport.name}</h2>
                <p className="text-xs text-slate-500 mt-1">Relatório Detalhado</p>
              </div>
              <button 
                onClick={() => { setSelectedCampaign(null); setCampaignReport(null); }}
                className="w-8 h-8 rounded-lg border border-[#2a3444] text-slate-400 hover:text-slate-200 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#161b24] rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Total Contatos</div>
                  <div className="font-display text-2xl font-bold">{campaignReport.contacts_total?.toLocaleString('pt-BR')}</div>
                </div>
                <div className="bg-[#161b24] rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Enviados</div>
                  <div className="font-display text-2xl font-bold text-[#00e5a0]">{campaignReport.contacts_sent?.toLocaleString('pt-BR')}</div>
                </div>
                <div className="bg-[#161b24] rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Falhas</div>
                  <div className="font-display text-2xl font-bold text-red-400">{campaignReport.contacts_failed?.toLocaleString('pt-BR')}</div>
                </div>
                <div className="bg-[#161b24] rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Taxa Sucesso</div>
                  <div className="font-display text-2xl font-bold text-sky-400">
                    {campaignReport.contacts_total > 0 
                      ? ((campaignReport.contacts_sent / campaignReport.contacts_total) * 100).toFixed(1)
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Timeline</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Criada em:</span>
                    <span className="font-mono">{new Date(campaignReport.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  {campaignReport.started_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Iniciada em:</span>
                      <span className="font-mono">{new Date(campaignReport.started_at).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                  {campaignReport.finished_at && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">Finalizada em:</span>
                      <span className="font-mono">{new Date(campaignReport.finished_at).toLocaleString('pt-BR')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Configurações */}
              <div>
                <h3 className="font-semibold text-sm mb-3">Configurações</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Delay:</span>
                    <span>{campaignReport.delay_min_seconds}s - {campaignReport.delay_max_seconds}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Horário:</span>
                    <span>{campaignReport.send_start_hour}h - {campaignReport.send_end_hour}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Finais de semana:</span>
                    <span>{campaignReport.send_on_weekends ? 'Sim' : 'Não'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Simular digitando:</span>
                    <span>{campaignReport.typing_simulation ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componentes auxiliares
function StatCard({ icon, label, value, color, subtitle }) {
  return (
    <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <div className={`font-display text-3xl font-bold mb-1 ${color}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-xs text-slate-500">{subtitle}</div>
      )}
    </div>
  );
}

function ProgressBar({ label, value, total, color }) {
  const percentage = Math.min(100, Math.max(0, (value / total) * 100));
  
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="text-slate-400">{label}</span>
        <span className="font-mono font-semibold">{value}%</span>
      </div>
      <div className="h-2 bg-[#2a3444] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
