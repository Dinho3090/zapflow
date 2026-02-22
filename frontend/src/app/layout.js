// ─────────────────────────────────────────────────────────
// app/layout.js — Root Layout Next.js 14
// ─────────────────────────────────────────────────────────
import "./globals.css";
import { Inter } from "next/font/google";
import { SupabaseProvider } from "@/components/providers/SupabaseProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "ZapFlow — Disparos WhatsApp",
  description: "Plataforma SaaS de automação WhatsApp",
  viewport: "width=device-width, initial-scale=1",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#080b10] text-slate-200 antialiased">
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
