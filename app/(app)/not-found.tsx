import { NaoEncontrada } from '@/components/nao-encontrada';

export const metadata = { title: 'Página não encontrada — REG-061 Digital' };

/** Dentro da área autenticada o menu continua de pé: só o conteúdo é o 404. */
export default function NaoEncontradaNaArea() {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <NaoEncontrada />
    </div>
  );
}
