'use client';

import { ErroNaTela } from '@/components/erro-na-tela';

/** Barreira das telas fora da área autenticada, como o login. */
export default function ErroGeral(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      <ErroNaTela
        {...props}
        titulo="Algo deu errado"
        descricao="O sistema não conseguiu carregar esta tela."
      />
    </main>
  );
}
