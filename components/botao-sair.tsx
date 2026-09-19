import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { encerrarSessao } from '@/lib/auth';

export function BotaoSair() {
  async function sair() {
    'use server';
    await encerrarSessao();
    redirect('/login');
  }

  return (
    <form action={sair}>
      <Button type="submit" variant="outline" size="sm" className="w-full">
        Sair
      </Button>
    </form>
  );
}
