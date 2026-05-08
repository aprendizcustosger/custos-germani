Você está trabalhando no projeto **Kustos Germani**, um sistema operacional de auditoria analítica de custos.

O sistema NÃO é:

* ERP
* CRUD administrativo genérico
* dashboard decorativo

O sistema É:

* uma ferramenta de investigação operacional
* uma camada analítica sobre dados ERP/SAP
* um cockpit de auditoria de custos

---

# PRINCÍPIO MAIS IMPORTANTE

## Velocidade de investigação acima de tudo.

Toda mudança deve responder:

> “isso ajuda a encontrar problemas mais rápido?”

---

# OBJETIVOS DO PRODUTO

O sistema deve:

* detectar anomalias rapidamente
* reduzir investigação manual
* destacar o que merece atenção
* facilitar comparação temporal
* acelerar auditoria operacional

---

# ARQUITETURA (NÃO VIOLAR)

## Separação FATO × DIMENSÃO é obrigatória

### Tabela fato:

* historico_custos

### Dimensões:

* dicionario_produtos
* categorias_origem
* categorias_familia
* categorias_agrupamento

NUNCA misturar lógica temporal com categorização.

---

# REGRAS TÉCNICAS OBRIGATÓRIAS

* NÃO usar RPC
* NÃO executar SQL bruto no frontend
* usar apenas supabase.from()
* frontend exibe descrição
* backend usa código/FK
* UUID é chave técnica, nunca semântica de negócio
* NÃO usar descrição textual para lógica de categorização

---

# IMPORTAÇÃO

A importação deve ser:

* resiliente
* tolerante a erros
* tolerante a colunas extras
* validada linha a linha

Falha de linha NÃO deve derrubar lote inteiro.

---

# FILOSOFIA DA UI

A UI deve:

* reduzir cliques
* mostrar contexto rapidamente
* evitar telas desnecessárias
* priorizar leitura analítica
* priorizar densidade útil de informação

Evitar:

* excesso de widgets decorativos
* gráficos sem valor operacional
* animações desnecessárias

---

# FILTROS

Filtros devem:

* ser rápidos
* ser em cascata
* mostrar apenas dados reais existentes
* nunca mostrar null/undefined

---

# AUDITORIA

O foco da auditoria é:

* comparação temporal
* variação de custo
* comportamento anormal
* tendência
* instabilidade

---

# DIREÇÃO DO PRODUTO

O sistema deve evoluir para:

* motor de investigação
* detecção automática
* priorização de risco
* análise comportamental

E NÃO para:

* ERP administrativo
* sistema burocrático
* CRUD complexo

---

# PERFORMANCE

Preferir:

* processamento local quando razoável
* datasets já carregados
* evitar queries repetidas

Evitar:

* loops com múltiplas chamadas Supabase
* recálculo desnecessário
* renderizações excessivas

---

# UX OPERACIONAL

Usuário principal:

* equipe de auditoria de custos

Portanto:

* velocidade > estética
* investigação > visual decorativo
* contexto > quantidade de gráficos

---

# DOCUMENTAÇÃO

SEMPRE atualizar:

* README
* docs técnicos
* documentação de fluxo
* regras de negócio

Toda mudança relevante deve ser documentada.

---

# RESULTADO ESPERADO

Toda implementação deve:

* melhorar investigação
* reduzir esforço manual
* aumentar clareza operacional
* manter arquitetura consistente
