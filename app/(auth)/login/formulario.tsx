'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { entrar, type EstadoLogin } from './acoes';

function BotaoEntrar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? 'Entrando…' : 'Entrar'}
    </Button>
  );
}

export function FormularioLogin({ de }: { de: string }) {
  const [estado, acao] = useActionState<EstadoLogin, FormData>(entrar, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">REG-061 Digital</CardTitle>
        <CardDescription>Cronograma de visitas</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={acao} className="flex flex-col gap-4">
          <input type="hidden" name="de" value={de} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              inputMode="email"
              autoCapitalize="none"
              defaultValue={estado.email ?? ''}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              name="senha"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {estado.erro ? (
            <Alert variant="destructive">
              <AlertDescription>{estado.erro}</AlertDescription>
            </Alert>
          ) : null}

          <BotaoEntrar />
        </form>
      </CardContent>
    </Card>
  );
}
