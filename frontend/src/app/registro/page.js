'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

export default function RegistroPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (form.password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      // 1. Cria usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;

      // 2. Cria tenant (via API backend ou direto no Supabase)
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_user_id: authData.user.id,
          name: form.name,
          email: form.email,
        }),
      });

      if (!res.ok) throw new Error('Erro ao criar conta');

      // 3. Redireciona para login
      router.push('/login?registered=true');
    } catch (err) {
      setError(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#080b10] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#00e5a0] text-black text-xl mb-4">⚡</div>
          <h1 className="font-display text-2xl font-bold text-white">Criar Conta</h1>
          <p className="text-slate-400 text-sm mt-1">Comece grátis com o plano Trial</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Nome da Empresa</label>
            <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]" placeholder="Minha Empresa"/>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">E-mail</label>
            <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]" placeholder="seu@email.com"/>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Senha</label>
            <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]" placeholder="Mínimo 6 caracteres"/>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">Confirmar Senha</label>
            <input type="password" required value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})}
              className="w-full px-3 py-2.5 bg-[#161b24] border border-[#2a3444] rounded-lg text-sm text-slate-200 outline-none focus:border-[#00e5a0]" placeholder="Digite novamente"/>
          </div>

          {error && <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs">{error}</div>}

          <button type="submit" disabled={loading}
            className="w-full py-2.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black font-semibold rounded-lg text-sm transition-colors disabled:opacity-50">
            {loading ? 'Criando conta...' : 'Criar Conta Grátis'}
          </button>
        </form>

        <div className="mt-6 p-4 bg-[#0f1319] border border-[#1e2733] rounded-xl">
          <div className="text-xs text-slate-400 space-y-1">
            <div>✓ 7 dias grátis</div>
            <div>✓ 500 mensagens/mês</div>
            <div>✓ 200 contatos</div>
            <div>✓ Sem cartão de crédito</div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-[#00e5a0] hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
