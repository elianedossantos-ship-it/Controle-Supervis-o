import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { hojeISO } from '@/lib/datas';
import { FormularioExportacao } from './formulario';
import { supervisoresParaExportar } from './acoes';

export const metadata = { title: 'Exportar REG-061 — REG-061 Digital' };

export default async function PaginaExportar() {
  await requireRole('coordenador');
  const supervisores = await supervisoresParaExportar();

  return (
    <>
      <CabecalhoPagina
        titulo="Exportar REG-061"
        descricao="Gera o mesmo layout da planilha, a partir das visitas do mês. Excel para o arquivo completo, PDF para assinatura."
      />
      <FormularioExportacao
        supervisores={supervisores}
        competenciaInicial={hojeISO().slice(0, 7)}
      />
    </>
  );
}
