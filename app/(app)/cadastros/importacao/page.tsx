import { requireRole } from '@/lib/auth';
import { CabecalhoPagina } from '@/components/cabecalho-pagina';
import { PainelImportacao } from './painel';
import { supervisoresCadastrados, totaisAtuais } from './acoes';

export const metadata = { title: 'Importar REG-061 — REG-061 Digital' };

export default async function PaginaImportacao() {
  await requireRole('coordenador');

  const [supervisores, totais] = await Promise.all([
    supervisoresCadastrados(),
    totaisAtuais(),
  ]);

  return (
    <>
      <CabecalhoPagina
        titulo="Importar REG-061"
        descricao={`Carga inicial de contratos e carteiras a partir da planilha. Hoje a base tem ${totais.contratos} contrato(s) e ${totais.vinculos} vínculo(s) vigente(s).`}
      />
      <PainelImportacao supervisores={supervisores} />
    </>
  );
}
