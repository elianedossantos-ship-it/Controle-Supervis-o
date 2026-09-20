'use client';

/*
 * Último recurso: erro que derruba o próprio layout raiz. Aqui não dá para usar
 * os componentes do sistema — este arquivo substitui <html> e <body> inteiros,
 * e o CSS pode ser justamente o que falhou. Por isso o estilo vai inline.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
            O sistema não conseguiu carregar
          </h1>
          <p style={{ color: '#555', marginBottom: '1.5rem' }}>
            Tente de novo. Se continuar assim, avise a coordenação
            {error.digest ? ` com o código ${error.digest}` : ''}.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '0.65rem 1.25rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: '1px solid #333',
              background: '#111',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Tentar de novo
          </button>
        </div>
      </body>
    </html>
  );
}
