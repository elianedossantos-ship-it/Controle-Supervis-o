import { FormularioLogin } from './formulario';

export const metadata = { title: 'Entrar — REG-061 Digital' };

type Props = {
  searchParams: Promise<{ de?: string | string[] }>;
};

export default async function PaginaLogin({ searchParams }: Props) {
  // O destino é lido no servidor, e não com useSearchParams no cliente: assim o
  // formulário vai no HTML e já aparece preenchível antes do JS carregar.
  const { de } = await searchParams;
  const destino = Array.isArray(de) ? de[0] : de;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <FormularioLogin de={destino ?? ''} />
      </div>
    </main>
  );
}
