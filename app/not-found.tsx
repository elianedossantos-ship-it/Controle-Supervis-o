import { NaoEncontrada } from '@/components/nao-encontrada';

export const metadata = { title: 'Página não encontrada — REG-061 Digital' };

export default function PaginaNaoEncontrada() {
  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      <NaoEncontrada />
    </main>
  );
}
