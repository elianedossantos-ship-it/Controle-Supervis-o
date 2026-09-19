import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'REG-061 Digital — Cronograma de Visitas',
  description: 'Programação semanal, registro de visitas e acompanhamento de aderência.',
};

// O supervisor registra visita em pé, no corredor da unidade, com uma mão.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
