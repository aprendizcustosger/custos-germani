# Sistema de Auditoria de Custos Germani

Documentação oficial do estado **atual** do projeto (frontend + Supabase).

## 1. Visão Geral

O sistema automatiza a auditoria de custos de produtos importados de planilhas (origem ERP/SAP) e permite análise por período com filtros em cascata.

Fluxo operacional real:
1. Usuário seleciona `data_referencia` e importa planilha `.xlsx`.
2. O frontend valida/mapeia 5 colunas obrigatórias.
3. Os dados são normalizados e enviados ao Supabase.
4. O sistema garante existência do produto em `dicionario_produtos`.
5. O histórico é gravado em `historico_custos`.
6. A tela de auditoria consulta custos e aplica filtros dinâmicos (Origem → Família → Agrupamento → Produto).

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

### Parsing numérico
- Remove separador de milhar quando necessário.
- Converte vírgula decimal para ponto.
- Arredonda/normaliza para até **4 casas decimais**.
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
- `docs/`: documentação detalhada por capítulo.
