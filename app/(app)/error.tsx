'use client';

import { ErroNaTela } from '@/components/erro-na-tela';

/** Barreira da área autenticada: o menu continua de pé, só o conteúdo cai. */
export default function ErroDaArea(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <ErroNaTela
        {...props}
        titulo="Algo deu errado nesta tela"
        descricao="O sistema não conseguiu montar a página. Nada do que você tinha registrado se perdeu — só esta tela falhou."
      />
    </div>
  );
}
