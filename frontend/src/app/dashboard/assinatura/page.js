'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export default function AssinaturaPage() {
  const [tenant, setTenant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase.from('tenants').select('*').eq('auth_user_id', session.user.id).single()
        .then(({ data }) => setTenant(data))
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) return <div className="py-20 text-center text-slate-400">Carregando...</div>;
  if (!tenant) return <div className="py-20 text-center text-slate-400">Tenant não encontrado</div>;

  const expiresAt = new Date(tenant.subscription_expires_at);
  const daysLeft = Math.ceil((expiresAt - new Date()) / (1000 * 60 * 60 * 24));
  const isExpired = daysLeft < 0;

  const plans = {
    trial: { name: 'Trial', price: 'R$ 0', msgs: '500', contacts: '200', campaigns: '2' },
    basic: { name: 'Basic', price: 'R$ 49', msgs: '1.000', contacts: '500', campaigns: '3' },
    pro: { name: 'Pro', price: 'R$ 149', msgs: '10.000', contacts: '10.000', campaigns: '10' },
    enterprise: { name: 'Enterprise', price: 'R$ 499', msgs: 'Ilimitado', contacts: 'Ilimitado', campaigns: '50' },
  };

  const currentPlan = plans[tenant.plan] || plans.trial;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div><h1 className="font-display text-2xl font-bold">Assinatura</h1><p className="text-slate-400 text-sm mt-1">Gerencie seu plano e pagamento</p></div>

      <div className={`rounded-xl border p-6 ${isExpired ? 'bg-red-500/10 border-red-500/30' : 'bg-[#0f1319] border-[#1e2733]'}`}>
        <div className="flex items-center justify-between mb-4">
          <div><div className="text-xs text-slate-500">Plano Atual</div><div className="font-display text-2xl font-bold mt-1">{currentPlan.name}</div></div>
          <div className="text-right"><div className="font-display text-2xl font-bold text-[#00e5a0]">{currentPlan.price}</div><div className="text-xs text-slate-500">/mês</div></div>
        </div>
        <div className={`text-sm ${isExpired ? 'text-red-400' : 'text-slate-400'}`}>
          {isExpired ? `⚠️ Expirou há ${Math.abs(daysLeft)} dias` : `✓ Ativo — ${daysLeft} dias restantes`}
        </div>
        {isExpired && <div className="mt-4 px-4 py-3 bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-300">Sua conta está suspensa. Renove para continuar usando.</div>}
      </div>

      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6">
        <h2 className="font-display font-bold mb-4">Limites do Plano</h2>
        <div className="space-y-3">
          {[
            { label: 'Mensagens/mês', value: `${tenant.messages_sent_month.toLocaleString('pt-BR')} / ${currentPlan.msgs}` },
            { label: 'Contatos', value: currentPlan.contacts },
            { label: 'Campanhas ativas', value: currentPlan.campaigns },
          ].map(l => (
            <div key={l.label} className="flex justify-between text-sm">
              <span className="text-slate-400">{l.label}</span>
              <span className="font-mono">{l.value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#0f1319] border border-[#1e2733] rounded-xl p-6">
        <h2 className="font-display font-bold mb-4">Upgrade de Plano</h2>
        <p className="text-sm text-slate-400 mb-4">Entre em contato com o suporte para fazer upgrade</p>
        <a href="mailto:suporte@zapflow.com" className="inline-block px-5 py-2.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-sm font-semibold rounded-lg transition-colors">Falar com Suporte</a>
      </div>
    </div>
  );
}
