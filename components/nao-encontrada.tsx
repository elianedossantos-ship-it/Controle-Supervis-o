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

/*
 * Corpo do 404. Não exige sessão: endereço errado não é motivo para mandar a
 * pessoa ao login antes de dizer o que aconteceu. Quem está logado volta para
 * a própria tela inicial; quem não está, para o login.
 */
export async function NaoEncontrada() {
  const sessao = await sessaoAtual();
  const destino = sessao ? telaInicial(sessao.papel) : '/login';

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Página não encontrada</CardTitle>
        <CardDescription>
          Este endereço não existe, ou você não tem acesso ao que ele aponta. Pode ser um
          link antigo ou um erro de digitação.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild className="w-full">
          <Link href={destino}>{sessao ? 'Voltar ao sistema' : 'Ir para o login'}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
