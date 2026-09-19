import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { requireSessao } from '@/lib/auth';
import { telaInicial } from '@/lib/navegacao';

export const metadata = { title: 'Sem acesso — REG-061 Digital' };

export default async function PaginaSemAcesso() {
  const sessao = await requireSessao();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sem acesso</CardTitle>
          <CardDescription>
            Seu papel não alcança esta tela. Fale com a coordenação se precisar dela.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={telaInicial(sessao.papel)}>Voltar</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
