'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

/*
 * Barreira de erro da área autenticada. A mensagem técnica não vai para a tela:
 * ela pode carregar nome de contrato, e-mail ou trecho de consulta. Fica no
 * console do servidor, e o supervisor recebe o que consegue fazer — tentar de
 * novo, ou o código do erro para passar à coordenação.
 */
export default function ErroDaArea({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro na área autenticada:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Algo deu errado nesta tela</CardTitle>
          <CardDescription>
            O sistema não conseguiu montar a página. Nada do que você tinha registrado se
            perdeu — só esta tela falhou.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={reset}>Tentar de novo</Button>
          {error.digest ? (
            <p className="text-muted-foreground text-xs">
              Se continuar, passe este código à coordenação:{' '}
              <span className="font-mono">{error.digest}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
