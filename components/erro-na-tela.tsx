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
 * Corpo comum das barreiras de erro. A mensagem técnica não vai para a tela:
 * ela pode carregar nome de contrato, e-mail ou trecho de consulta. Fica no
 * console do servidor, e o usuário recebe o que consegue fazer — tentar de
 * novo, ou o código do erro para passar à coordenação.
 */
export function ErroNaTela({
  error,
  reset,
  titulo,
  descricao,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  titulo: string;
  descricao: string;
}) {
  useEffect(() => {
    console.error('Erro na interface:', error);
  }, [error]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
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
  );
}
