import "./globals.css";

export const metadata = {
  title: "Admin — ZapFlow",
  description: "Painel administrativo",
};

export default function AdminLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#080b10] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
