# Capítulo 20 — Playbook Operacional (Passo a passo atual)

> Objetivo: descrever **exatamente** o fluxo praticado hoje no sistema, da preparação da base até a análise na tela.

## 1) Preparar base e referências

1. Garantir que as tabelas de domínio e fato estejam disponíveis no Supabase:
   - `categorias_origem`
   - `categorias_familia`
   - `dicionario_produtos`
   - `historico_custos`
2. Validar se as categorias possuem `codigo` + `descricao` para exibição correta.
3. Confirmar que o `dicionario_produtos` contém `codigo_produto` e campos de classificação (`origem_id`, `familia_id`, `agrupamento_cod`).

Resultado esperado:
- Dicionário apto para enriquecer os custos importados.

## 2) Preparar a planilha de entrada

1. Exportar arquivo `.xlsx` do ERP/SAP.
2. Conferir presença das 5 colunas obrigatórias:
   - `Produto`
   - `Descrição`
   - `Custo Variável`
   - `Custo Direto Fixo`
   - `Custo Total`
3. Colunas extras podem permanecer na planilha (serão ignoradas).

Resultado esperado:
- Arquivo válido para o mapeamento no frontend.

## 3) Executar importação no frontend

1. Selecionar a `data_referencia`.
2. Carregar o `.xlsx` na tela de importação.
3. Revisar o mapeamento automático de colunas (ajustar manualmente se necessário).
4. Confirmar a importação.

Resultado esperado:
- Frontend inicia parsing e validação linha a linha.

## 4) Normalizar e validar dados

Durante o processamento:

1. Conversão numérica:
   - remove separador de milhar quando aplicável;
   - converte vírgula decimal para ponto;
   - normaliza para até 4 casas decimais.
2. Validação de obrigatoriedade por linha.
3. Tratamento de erro pontual sem derrubar todo o lote.

Resultado esperado:
- Apenas linhas válidas seguem para persistência.

## 5) Persistir no Supabase

Para cada linha válida:

1. Garantir existência do item em `dicionario_produtos`.
   - Se não existir, criar com categorização inicial nula.
2. Gravar/atualizar custo no `historico_custos` para a `data_referencia`.
3. Preservar `descricao` como snapshot textual da importação.

Resultado esperado:
- Histórico de custos coerente com o lote importado.

## 6) Montar visão de auditoria

1. Consultar produtos com custo no período selecionado.
2. Cruza-los com classificação do `dicionario_produtos`.
3. Construir filtros em cascata no padrão:
   - Origem → Família → Agrupamento → Produto
4. Remover opções nulas/indefinidas da UI.

Resultado esperado:
- Filtros consistentes com dados reais e navegáveis em cascata.

## 7) Executar análise operacional

1. Aplicar filtros em cascata conforme o recorte desejado.
2. Comparar custos por produto/agrupamento.
3. Rodar comparação automática entre última e penúltima importação por produto:
   - ordenar registros por `criado_em` (desc);
   - usar os dois mais recentes;
   - calcular variação percentual com a fórmula:
     - `((novo - antigo) / antigo) * 100`
4. Marcar alerta automático quando a variação absoluta entre importações for relevante (limiar atual: **5%**).
5. Identificar outliers e variações para ação da equipe.

Resultado esperado:
- Painel utilizável para decisão de auditoria de custos.

## 8) Checklist rápido de saúde (produção)

- Importação aceita planilhas com campos extras.
- Valores monetários em formato BR convertem sem distorção.
- Produtos novos são incorporados ao dicionário automaticamente.
- Filtros não exibem `null`/`undefined`.
- Categorias exibem descrição amigável (não UUID).

---

## Referência de componentes por responsabilidade

- `view/ui-controller.js`: orquestra fluxo de tela e interação do usuário.
- `core/spreadsheet-engine.js`: leitura, mapeamento e normalização da planilha.
- `core/report-engine.js`: consolidação para filtros/cascata e indicadores.
- `src/services/api.js`: persistência e consultas no Supabase.
