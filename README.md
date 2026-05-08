# Sistema de Auditoria de Custos Germani

Documentação oficial do estado **atual** do projeto (frontend + Supabase).


## Documentos estratégicos

- `VISION.md`: visão de produto, missão e direção estratégica do Kustos.
- `docs/arquitetura/indice-documentacao-kustos.md`: índice da documentação técnica viva do sistema.

---

## 1. Visão Geral

O sistema automatiza a auditoria de custos de produtos importados de planilhas (origem ERP/SAP) e permite análise por período com filtros em cascata.

Fluxo operacional real:
1. Usuário seleciona `data_referencia` e importa planilha `.xlsx`.
2. O frontend detecta e confirma o mapeamento das 5 colunas obrigatórias.
3. O sistema gera preview inteligente (até 20 linhas) com status por linha (`🟢 válida`, `🟡 atenção`, `🔴 erro`).
4. O usuário confirma a importação após revisar o preview.
5. Apenas linhas sem erro são normalizadas e enviadas ao Supabase.
6. O sistema garante existência do produto em `dicionario_produtos`.
7. O histórico é gravado em `historico_custos`.
8. A tela de auditoria consulta custos e aplica filtros dinâmicos (Origem → Família → Agrupamento → Produto).

---

## 2. Arquitetura de Dados

### `categorias_origem`
- `id` (UUID): chave técnica.
- `codigo` (TEXT): **chave de negócio**.
- `descricao` (TEXT): rótulo exibido no frontend.

### `categorias_familia`
- `id` (UUID): chave técnica.
- `codigo` (TEXT): **chave de negócio**.
- `descricao` (TEXT): rótulo exibido no frontend.

### `dicionario_produtos`
- `codigo_produto` (TEXT): chave do produto.
- `origem_id` (UUID): referência técnica para categoria de origem.
- `familia_id` (UUID): referência técnica para categoria de família.
- `agrupamento_cod` (TEXT): código técnico/lógico de agrupamento.
- `descricao` (TEXT): descrição de apoio do produto.

### `historico_custos`
- `codigo_produto` (TEXT).
- `custo_variavel` (NUMERIC 18,4).
- `custo_direto_fixo` (NUMERIC 18,4).
- `custo_total` (NUMERIC 18,4).
- `data_referencia` (DATE).
- `descricao` é mantida como snapshot textual do item importado.

### Regras explícitas de identidade
- Backend/persistência: lógica de relacionamento via **código de negócio** + FKs técnicas.
- Frontend: exibe **descrição** (não expõe UUID como informação de negócio).
- UUID (`id`) em categorias é apenas chave técnica de integração.

---

## 3. Categorização (Cascata)

Cascata funcional da UI e da auditoria:

**Origem → Família → Agrupamento → Produto**

Fonte real da hierarquia usada nos filtros:
- `dicionario_produtos` (via `hierarquia`/`dicionario` carregados em `api.getMasters`).

Papel das tabelas de categoria:
- `categorias_origem` e `categorias_familia` enriquecem os códigos técnicos com `descricao` para exibição.

Importante:
- A lógica de cascata não depende de texto legado como “FAMILIA XXXX”.
- A categorização opera com IDs/códigos persistidos no dicionário e labels das categorias.

---

## 4. Importação de Dados

### Colunas obrigatórias (5)
A importação exige mapeamento dos campos:
- `Produto` (`codigo_produto`)
- `Descrição` (`descricao`)
- `Custo Variável` (`custo_variavel`)
- `Custo Direto Fixo` (`custo_direto_fixo`)
- `Custo Total` (`custo_total`)

### Comportamento da ingestão
- Colunas extras são aceitas e ignoradas.
- O processamento não falha por colunas adicionais.
- Cabeçalhos podem ser detectados por aliases e confirmação manual.
- Alias tolera variações de caixa e nomes próximos (ex.: `Cod Produto`, `Código`, `Vl Total`).
- Colunas irrelevantes (ex.: CIF, Derivação e códigos extras) permanecem fora do mapeamento obrigatório.

### Preview e validações antes da gravação
- Exibe amostra de 10~20 linhas com:
  - Produto,
  - Descrição,
  - Custos normalizados,
  - Status por linha.
- Valida por linha:
  - produto ausente,
  - produto não encontrado no cadastro,
  - descrição vazia,
  - custo negativo,
  - custo total zerado,
  - conversão numérica para zero.
- Linhas com erro não bloqueiam o lote inteiro: apenas são excluídas da carga final.

### Parsing numérico
- Remove separador de milhar quando necessário.
- Converte vírgula decimal para ponto.
- Arredonda/normaliza para até **4 casas decimais**.
- UI sempre exibe no padrão financeiro brasileiro com **3 casas decimais**.
- Valores inválidos são tratados como inválidos e podem gerar rejeição da linha na validação final.

### Robustez
- Cada linha é validada.
- Produto ausente no dicionário é criado automaticamente com categorização nula inicial.
- Falhas por linha são registradas sem interromper todo o lote.

---

## 5. Auditoria e Filtros

Origem real dos dados em tela:

- **Produto:** vem de produtos com custo em `historico_custos`.
- **Origem/Família/Agrupamento:** vêm de combinações existentes em `dicionario_produtos` para produtos que já têm custo histórico.

Resumo temporal exibido na tabela da Auditoria:
- **Último Custo:** custo mais recente por `criado_em DESC` em `historico_custos`.
- **Penúltimo Custo:** segundo custo mais recente por `criado_em DESC`.
- **Diferença:** `ultimo.custo_total - penultimo.custo_total` e variação percentual relativa.
- **Última Atualização:** timestamp de `criado_em` do registro mais recente.
- **Score de Instabilidade (%):** média das variações percentuais absolutas entre pontos consecutivos do histórico no período filtrado.
  - Fórmula por intervalo: `Math.abs(((novo - antigo) / antigo) * 100)`.
  - Classificação automática:
    - `ESTÁVEL` quando score `< 3%`;
    - `OSCILANDO` quando score `>= 3%` e `< 8%`;
    - `MUITO INSTÁVEL` quando score `>= 8%`.

Painel **TOP VARIAÇÕES** na Auditoria:
- Compara automaticamente a **última** e a **penúltima** importação (`criado_em`) em `historico_custos`.
- Calcula por produto: `((novo - antigo) / antigo) * 100`.
- Exibe:
  - TOP 5 maiores aumentos de custo.
  - TOP 5 maiores reduções de custo.
- Respeita os mesmos filtros da Auditoria (período, origem, família, agrupamento e produto).
- Implementado apenas com `supabase.from()` no frontend (sem RPC e sem SQL bruto).

Interatividade da tabela analítica:
- Cards de KPI são clicáveis para filtros rápidos:
  - **Itens analisados**: remove filtro rápido.
  - **Alertas (>5%)**: exibe somente itens com `variacao > 5`.
  - **Média de variação**: exibe somente variações positivas (`variacao > 0`).
- Cabeçalhos da tabela permitem ordenação interativa (asc/desc) por coluna.
- Clique em qualquer linha mantém a navegação para análise temporal do item selecionado.

Características dos filtros:
- Dinâmicos.
- Em cascata.
- Limitados a valores realmente existentes no conjunto com custo.
- Opções `null`/`undefined` são removidas antes da renderização.

---

## 6. Princípios do Sistema

1. Tolerância a dados imperfeitos na importação.
2. Robustez: erro pontual não derruba lote inteiro.
3. Consistência entre banco e UI por uso de dados reais com custo.
4. Evitar opções vazias/nulas em filtros.
5. Não usar descrição textual como chave de negócio.
6. Não expor chaves técnicas como semântica de negócio no frontend.

---

## 7. Problemas já resolvidos

- Uso incorreto de UUID como se fosse semântica de negócio.
- Divergências entre colunas esperadas e schema real no Supabase.
- Parsing numérico incorreto para formato brasileiro.
- Filtros exibindo valores vazios (`null`/`undefined`).
- Dependência de textos como “FAMILIA XXXX” em vez de classificação estruturada.

---

## 8. Boas Práticas Técnicas

- Usar `codigo` como referência lógica de negócio em categorias.
- Tratar `id` UUID como referência técnica.
- Nunca depender de texto livre para lógica de categorização.
- Manter sincronização entre:
  - `dicionario_produtos` (hierarquia),
  - `historico_custos` (fato de custo),
  - categorias (descrições de exibição).

---

## Estrutura técnica do repositório

- `view/ui-controller.js`: fluxo de UI, importação e auditoria.
- `core/spreadsheet-engine.js`: leitura/mapeamento/normalização da planilha.
- `core/report-engine.js`: cálculo da cascata e KPIs.
- `src/services/api.js`: acesso Supabase e regras de gravação/consulta.
- `docs/`: documentação técnica padronizada do projeto kustos.
- `docs/arquitetura/indice-documentacao-kustos.md`: índice central da documentação.
- `docs/troubleshooting/playbook-operacional.md`: playbook operacional com passo a passo atualizado.

---

## 9. Evolução Temporal de Custos (Auditoria)

A Auditoria agora exibe o painel **"Evolução Temporal de Custos"** com análise histórica no período filtrado.

### Lógica temporal
- Fonte: registros de `historico_custos` já carregados na auditoria (`api.getHistorico`).
- Não usa RPC e não executa SQL bruto no frontend.
- A série é processada localmente para evitar queries repetidas.

### Agregações por seleção
- **Produto individual** (`selI != TODOS`): série temporal com linha única do produto.
- **Origem/Família/Agrupamento** (sem produto específico): série agregada por data com **média de custo** dos produtos do recorte.
  - Escolha adotada por legibilidade (menos distorção por volume de itens em comparação com soma bruta).

### Acessibilidade visual (gráficos da Auditoria)
- Textos principais dos gráficos (`labels`, eixos, valores e legendas) padronizados em `#FFFFFF`.
- Grid/bordas em branco translúcido para melhorar leitura da escala sem alterar a lógica dos dados.
- Tooltips com contraste reforçado (texto branco e fundo escuro).

### Indicadores e UX
- Tooltip com:
  - valor exato em BRL,
  - data completa,
  - variação vs ponto anterior.
- Badge de tendência:
  - 🟢 Estável
  - 🔺 Tendência de Alta
  - 🔻 Tendência de Queda
- Linha auxiliar opcional implementada:
  - **Média histórica** (tracejada).

### Fallback
- Quando existir apenas 1 ponto temporal:
  - exibe `Histórico insuficiente para análise temporal`;
  - oculta o canvas para evitar gráfico vazio.
