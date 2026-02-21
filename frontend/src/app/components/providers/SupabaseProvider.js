'use client';
// Supabase Provider sem auth-helpers
import { createContext, useContext, useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/supabase-js';
import { useRouter, usePathname } from 'next/navigation';

const Ctx = createContext(null);
const PUBLIC_ROUTES = ['/login', '/registro'];

export function SupabaseProvider({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );
  const [session, setSession] = useState(undefined);

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
  }, [pathname, supabase, router]);

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

  return <Ctx.Provider value={{ supabase, session }}>{children}</Ctx.Provider>;
}

export const useSupabase = () => useContext(Ctx);
