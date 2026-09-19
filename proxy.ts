import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESSAO, lerSessao } from '@/lib/sessao';

/**
 * Primeira barreira de sessão. Roda no Edge, então só verifica a assinatura do
 * cookie — nada de banco aqui. A autorização por papel fica no servidor, em
 * requireRole() (lib/auth.ts), e o isolamento por carteira fica nas consultas.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessao = await lerSessao(request.cookies.get(COOKIE_SESSAO)?.value);

  if (pathname === '/login') {
    if (sessao) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  if (!sessao) {
    const destino = new URL('/login', request.url);
    // Guarda para onde o usuário queria ir, para voltar depois do login.
    if (pathname !== '/') {
      destino.searchParams.set('de', pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(destino);
  }

  return NextResponse.next();
}

export const config = {
  // Tudo, menos os arquivos internos do Next, o favicon e a rota de login
  // por API. O casamento negativo evita rodar o proxy em cada asset.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
