# Visão do Produto — Kustos Germani

## Missão

Transformar auditoria de custos em um processo rápido, investigativo, contextual e orientado por anomalias.

O investigador deve encontrar o problema em segundos, não em minutos.

---

## Identidade do Produto

O Kustos Germani é um **motor de investigação operacional de custos**, não um dashboard.

### O que isso significa na prática:

| Dashboard | Motor de Investigação |
|---|---|
| Mostra o estado atual | Responde por que o custo mudou |
| Exige navegação hierárquica | Busca direta por produto/código |
| Exibe variação | Mostra quando e em qual import ocorreu |
| Lista os mais instáveis | Detecta quem mudou de comportamento |

---

## Princípios Inegociáveis

### 1. Velocidade de investigação acima de tudo

Toda decisão arquitetural e de UX deve responder:
> "isso ajuda a encontrar o problema mais rápido?"

Se não ajudar: não implemente, simplifique ou remova.

### 2. Contexto antes de navegação

O investigador não deve precisar montar contexto manualmente.
O sistema deve apresentar o que merece atenção.

### 3. Explicação de eventos, não apenas exibição de dados

Não basta mostrar "variou 12%".
O sistema deve mostrar: quando, entre quais imports, qual foi o valor antes e depois.

### 4. Mudança de comportamento é mais importante que variação pontual

Um produto que sempre oscilou e oscilou de novo não é anomalia.
Um produto que era ESTÁVEL e ficou INSTÁVEL é sinal de ruptura.
Prioridade operacional: detectar mudança de regime.

### 5. Robustez operacional

O sistema deve tolerar planilhas imperfeitas, colunas extras e inconsistências parciais.
Falha de linha não derruba lote inteiro.

### 6. Temporalidade é central e deve ser clara

Dois eixos de tempo sempre presentes:
- `data_referencia`: competência operacional (quando o custo é válido)
- `criado_em`: evento de importação (quando o dado entrou no sistema)

Esses dois conceitos são distintos e não devem ser confundidos na UI.

---

## Capacidades Investigativas (estado atual)

### Busca direta por produto
O investigador pode digitar código ou descrição e chegar diretamente à análise do produto — sem navegar pela hierarquia Origem → Família → Agrupamento.

### Drill-through de eventos de custo
Clicar em qualquer produto na tabela abre o histórico completo de importações:
- Competência (data_referencia): período de vigência do custo
- Importado em (criado_em): quando o dado entrou no sistema
- Delta monetário e percentual vs. registro anterior
- Destaque visual para variações acima de 5%

### Fila investigativa com baixa carga cognitiva
A tabela principal prioriza leitura operacional com hierarquia clara:
- principal: produto, criticidade, variação e mudança de regime
- contextual: resumo investigativo automático por linha
- secundário: detalhes completos em expansão sob demanda

O objetivo é reduzir leitura horizontal e manter o comportamento de cockpit investigativo, não de planilha ERP.

### Detecção de mudança de regime
Produto classificado como `ESTÁVEL` na primeira metade do período e `OSCILANDO` ou `MUITO INSTÁVEL` na segunda metade → marcado como "Mudança de Regime".
Disponível como KPI clicável e como coluna na tabela.

### Score de instabilidade e classificação automática
- `ESTÁVEL`: score < 3%
- `OSCILANDO`: score 3–8%
- `MUITO INSTÁVEL`: score ≥ 8%

### Export para Excel
O relatório atual pode ser exportado como `.xlsx` com todos os campos analíticos, incluindo classificação de regime.

### Alerta de produtos sem categoria
Banner visível na tela de importação quando há produtos sem categorização completa no dicionário.

---

## O que o Sistema NÃO deve virar

- ERP genérico
- CRUD administrativo
- Dashboard decorativo com gráficos sem valor operacional
- Sistema burocrático com navegação excessiva
- Réplica de Power BI ou Metabase

---

## Evolução Esperada

### Próximos passos (alta prioridade operacional)

- Busca com autocomplete avançado (by código + descrição simultâneos)
- Filtro "produtos que mudaram de regime" persistente por período
- Comparação entre períodos (ex: este mês vs. mesmo mês do ano anterior)
- Exportação do drill-through individual por produto

### Médio prazo

- Priorização automática de investigação (ranking de risco)
- Memória comportamental: histórico de alertas por produto
- Detecção de sazonalidade vs. ruptura
- Insights operacionais textuais ("produto X oscilou 3 meses seguidos")

### Longo prazo

- Previsão de tendência baseada em série histórica
- Integração direta com ERP/SAP para importação automatizada
- Categorização automática de novos produtos via código de negócio

- Segurança operacional mínima (config por ambiente + autenticação real) é pré-requisito para escala do motor investigativo.

- Configuração de frontend com prioridade para `import.meta.env`, fallback seguro para `window.__ENV__`/`window.__RUNTIME_CONFIG__` e fallback final via `<meta name="VITE_*">`, evitando falhas de bootstrap em runtimes sem Vite.

- Confiabilidade de bootstrap em runtime estático é tratada como requisito investigativo: sem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` válidas, o deploy deve falhar antes de publicar.
