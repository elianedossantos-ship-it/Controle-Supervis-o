#!/bin/bash
# Bateria completa, na ordem de dependência. Uma suíte passa quando sai com
# código 0 e não imprime nenhuma linha FALHA. Requer o servidor em :3280.
cd "$(dirname "$0")"
mkdir -p telas saida
SUITES=${SUITES:-"cadastros carteira importacao papeis permissoes adulteracao
        programacao programacao-bordas nao-duplica guardas guarda-enviada
        aviso-reativo preservacao meu-dia meu-dia-bordas acesso-visita
        demandas locale painel prazos avaliacoes planos janela painel-planos
        exportar mobile mobile-grade"}
falhou=""
total=0
for t in $SUITES; do
  [ -f "$t.mjs" ] || { echo "### $t: ARQUIVO AUSENTE"; falhou="$falhou $t"; continue; }
  saida=$(timeout 900 node "$t.mjs" 2>&1); codigo=$?
  n=$(echo "$saida" | grep -c "  PASS")
  if [ $codigo -eq 0 ] && ! echo "$saida" | grep -q "  FALHA"; then
    echo "### $t: OK ($n verificações)"
    total=$((total + n))
  else
    echo "### $t: FALHOU (código $codigo)"
    echo "$saida" | grep -E "FALHA|Error|error:" | head -6
    falhou="$falhou $t"
  fi
done
echo
echo "verificações que passaram: $total"
if [ -z "$falhou" ]; then echo "BATERIA COMPLETA: TUDO VERDE"; else echo "SUÍTES COM FALHA:$falhou"; fi
