'use client';
// ─────────────────────────────────────────────────────────
// components/providers/SupabaseProvider.js
// Gerencia sessão e redireciona para /login se não autenticado
// ─────────────────────────────────────────────────────────
import { createContext, useContext, useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, usePathname } from 'next/navigation';

const Ctx = createContext(null);

const PUBLIC_ROUTES = ['/login', '/registro', '/esqueci-senha'];

export function SupabaseProvider({ children }) {
  const supabase = createClientComponentClient();
  const router   = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState(undefined); // undefined = carregando

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session && !PUBLIC_ROUTES.includes(pathname)) {
        router.push('/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_, session) => {
        setSession(session);
        if (!session && !PUBLIC_ROUTES.includes(pathname)) {
          router.push('/login');
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [pathname]);

  // Tela de loading enquanto verifica sessão
  if (session === undefined && !PUBLIC_ROUTES.includes(pathname)) {
    return (
      <div className="min-h-screen bg-[#080b10] flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3">⚡</div>
          <div className="text-slate-400 text-sm font-mono">carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <Ctx.Provider value={{ supabase, session }}>
      {children}
    </Ctx.Provider>
  );
}

export const useSupabase = () => useContext(Ctx);
