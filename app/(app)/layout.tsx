import { requireSessao } from '@/lib/auth';
import { ROTULO_PAPEL } from '@/lib/papeis';
import { BarraNavegacao } from '@/components/navegacao';
import { BotaoSair } from '@/components/botao-sair';

export default async function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const sessao = await requireSessao();

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <header className="bg-card sticky top-0 z-10 border-b md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{sessao.nome}</p>
            <p className="text-muted-foreground text-xs">{ROTULO_PAPEL[sessao.papel]}</p>
          </div>
          <BotaoSair />
        </div>
        <BarraNavegacao papel={sessao.papel} orientacao="horizontal" />
      </header>

      <aside className="bg-card hidden w-64 shrink-0 border-r md:flex md:flex-col">
        <div className="border-b px-4 py-4">
          <p className="text-sm font-semibold">REG-061 Digital</p>
          <p className="text-muted-foreground text-xs">Cronograma de visitas</p>
        </div>

        <BarraNavegacao papel={sessao.papel} orientacao="vertical" />

        <div className="mt-auto border-t px-4 py-3">
          <p className="truncate text-sm font-medium">{sessao.nome}</p>
          <p className="text-muted-foreground mb-2 truncate text-xs">{sessao.email}</p>
          <p className="text-muted-foreground mb-3 text-xs">
            {ROTULO_PAPEL[sessao.papel]}
          </p>
          <BotaoSair />
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
