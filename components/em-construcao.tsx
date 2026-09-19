import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = {
  titulo: string;
  descricao: string;
  entrega: string;
};

/**
 * Espaço reservado das telas que ainda não entraram. A Entrega 1 é fundação:
 * schema, autenticação e navegação por papel. As telas vêm uma por vez.
 */
export function EmConstrucao({ titulo, descricao, entrega }: Props) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">{entrega}</p>
      </CardContent>
    </Card>
  );
}
