"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../lib/api";
import Link from "next/link";

const NAV = [
  {
    group: "Principal",
    items: [
      { href: "/dashboard", icon: "▦", label: "Dashboard" },
      { href: "/dashboard/campanhas", icon: "📣", label: "Campanhas" },
      { href: "/dashboard/agendamento", icon: "📅", label: "Agendamento" },
      { href: "/dashboard/contatos", icon: "👥", label: "Contatos" },
      { href: "/dashboard/automacoes", icon: "🤖", label: "Automações" },
    ],
  },
  {
    group: "Dados",
    items: [
      { href: "/dashboard/relatorios", icon: "📊", label: "Relatórios" },
      { href: "/dashboard/midia", icon: "🖼", label: "Mídia" },
    ],
  },
  {
    group: "Conta",
    items: [
      { href: "/dashboard/whatsapp", icon: "📱", label: "WhatsApp" },
      { href: "/dashboard/assinatura", icon: "💳", label: "Assinatura" },
      { href: "/dashboard/config", icon: "⚙️", label: "Configurações" },
    ],
  },
];

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [waStatus, setWaStatus] = useState("disconnected");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const titles = {
    "/dashboard": "Dashboard",
    "/dashboard/campanhas": "Campanhas",
    "/dashboard/agendamento": "Agendamento",
    "/dashboard/contatos": "Contatos",
    "/dashboard/automacoes": "Automações",
    "/dashboard/relatorios": "Relatórios",
    "/dashboard/midia": "Mídia",
    "/dashboard/whatsapp": "WhatsApp",
    "/dashboard/assinatura": "Assinatura",
    "/dashboard/config": "Configurações",
  };
  const currentTitle =
    titles[pathname] ||
    NAV.flatMap(g => g.items).find(i => pathname.startsWith(i.href))?.label ||
    "Dashboard";

  return (
    <div className="flex min-h-screen bg-[#080b10]">
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-[190] md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 bottom-0 w-[240px] z-[200] bg-[#0f1319] border-r border-[#1e2733] flex flex-col transition-transform duration-250 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        <div className="flex items-center justify-between px-4 py-5 border-b border-[#1e2733]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00e5a0] flex items-center justify-center text-base">
              ⚡
            </div>
            <span className="font-display text-[19px] font-bold">
              Zap<span className="text-[#00e5a0]">Flow</span>
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden text-slate-500 text-xl px-1"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5 space-y-5">
          {NAV.map(group => (
            <div key={group.group}>
              <p className="px-2.5 mb-1.5 text-[10px] font-semibold tracking-[1.5px] uppercase text-slate-500 font-mono">
                {group.group}
              </p>
              {group.items.map(item => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 text-[13.5px] font-medium transition-all ${active ? "bg-[#00e5a0]/10 text-[#00e5a0]" : "text-slate-400 hover:bg-[#161b24] hover:text-slate-200"}`}
                  >
                    <span className="w-5 text-center text-base">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-[#1e2733]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-slate-400 hover:bg-[#161b24] hover:text-slate-200 transition-colors"
          >
            <span className="w-5 text-center">🚪</span>
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 md:ml-[240px]">
        <header className="h-[60px] px-4 md:px-6 flex items-center justify-between gap-3 bg-[#080b10] border-b border-[#1e2733] sticky top-0 z-[100]">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden text-slate-400 text-xl px-1"
          >
            ☰
          </button>
          <h1 className="font-display text-[17px] font-bold flex-1 md:flex-none truncate">
            {currentTitle}
          </h1>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border font-mono ${waStatus === "connected" ? "bg-[#00e5a0]/10 border-[#00e5a0]/30 text-[#00e5a0]" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${waStatus === "connected" ? "bg-[#00e5a0] animate-pulse" : "bg-red-400"}`}
              />
              <span className="hidden sm:inline">
                {waStatus === "connected" ? "Conectado" : "Desconectado"}
              </span>
            </div>
            <Link
              href="/dashboard/campanhas/nova"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00e5a0] hover:bg-[#00ffb3] text-black text-xs font-semibold rounded-lg transition-colors"
            >
              <span>+</span>
              <span className="hidden sm:inline">Campanha</span>
            </Link>
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
