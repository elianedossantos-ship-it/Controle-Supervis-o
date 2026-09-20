import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { sessaoAtual } from '@/lib/auth';
import { telaInicial } from '@/lib/navegacao';

export const metadata = { title: 'Página não encontrada — REG-061 Digital' };

/*
 * 404 em português e com a saída no lugar certo: quem está logado volta para a
 * própria tela inicial, quem não está vai para o login. Sem sessão aqui a
 * página não pode exigir uma — um endereço errado não é motivo de redirecionar
 * para o login antes de dizer o que aconteceu.
 */
export default async function NaoEncontrada() {
  const sessao = await sessaoAtual();
  const destino = sessao ? telaInicial(sessao.papel) : '/login';

  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Página não encontrada</CardTitle>
          <CardDescription>
            Este endereço não existe no sistema. Pode ser um link antigo ou um erro de
            digitação.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={destino}>{sessao ? 'Voltar ao sistema' : 'Ir para o login'}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
