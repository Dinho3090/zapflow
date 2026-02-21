import "./globals.css"; // Se você tiver um arquivo de CSS global

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
      <head>
        <title>ZapFlow - Sistema de Envios</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
