# 📂 DOCUMENTAÇÃO TÉCNICA: MOTOR DE CUSTOS GERMANI

## 📝 Visão Geral
Este sistema foi projetado para automatizar a auditoria de custos da **Germani Alimentos**.  
O objetivo central é transformar planilhas brutas de ERP/SAP em visualizações estratégicas de histórico de custos, sem que o usuário precise tratar o Excel manualmente.

---

## 🛠️ 1. O Pacto da Importação (Tolerância Zero a Rigidez)
O motor de importação deve operar como **Filtro Seletivo**:

### As 5 colunas obrigatórias
1. **Produto** (código identificador)
2. **Descrição** (nome para categorização)
3. **Custo Variável**
4. **Custo Direto Fixo**
5. **Custo Total**

### Regra de Ouro
Ignore qualquer outra coluna (ex.: `CIF`, `Derivação`, `Data de Cadastro`).  
Se a planilha tiver 100 colunas extras, o sistema deve ignorar o “lixo” e capturar apenas as 5 colunas acima.  
**Nunca retornar erro por “coluna inválida” quando as colunas obrigatórias forem encontradas.**

---

## 🧬 2. Hierarquia de Categorização (Cascata)
Para o **Pente Fino (Auditoria)** funcionar, aplicar a lógica de afunilamento:

### A) ORIGEM (Grande Grupo)
Define a unidade de produção:
- **MOAGEM**: tudo que nasce do trigo (farinhas e misturas)
- **BISCOITOS**: linha de produção de assados
- **MASSAS**: linha de produção de massas alimentícias

### B) FAMÍLIA (Subgrupo Técnico)
O sistema usa a descrição do produto para sugerir a família:
- **M012 (Biscoito Solto Doce)**: descrição contém `BISCOITO`, `ROSQUINHA` ou `WAFER`
- **M024 (Massa com Ovos)**: descrição contém `MASSA`, `OVOS`, `ESPAGUETE` ou `PARAFUSO`
- **M000 (Misturas Gerais)**: descrição contém `FARINHA`, `TRIGO` ou `MISTURA`

### C) AGRUPAMENTO (Formato)
Define peso/tipo de embalagem (ex.: `400g`, `5kg`, `Granel`).

### D) ITEM (SKU Final)
Produto específico (ex.: `Biscoito Recheado Chocolate 400g`).

---

## 💾 3. Estrutura do Banco de Dados (Supabase)
As relações devem ser respeitadas para que os filtros da tela não fiquem vazios.

| Tabela | Função | Coluna Chave |
|---|---|---|
| `origens` | Lista as unidades (Biscoitos, Massas) | `id` (Text) |
| `familias` | Lista os tipos (M012, M024) | `id` (Text) |
| `dicionario_produtos` | Onde o produto é “batizado” e categorizado | `codigo_produto`, `origem_id`, `familia_id` |
| `historico_custos` | Onde os valores de cada mês são salvos | `produto_id`, `custo_total`, `data_importacao` |

---

## 🚩 4. Requisitos de User Experience (UX)
Para dar segurança ao usuário:

### Feedback instantâneo
Ao terminar upload, o sistema deve exibir:

> **Sucesso! [X] itens foram importados com sucesso.**

### Carga automática
Ao entrar na tela de Auditoria, o sistema deve buscar imediatamente:
- lista de **Origens**
- lista de **Famílias**

Objetivo: os `selects` nunca aparecerem vazios.

### Flexibilidade de gráfico
O gráfico de barras deve carregar mesmo com filtro parcial.  
Exemplo: apenas **Origem** selecionada já deve permitir renderização.

---

## ⚠️ Erros para Nunca Repetir
1. **Erro de UUID**  
   Nunca enviar texto `"PENDENTE"` para coluna de ID.  
   Use ID real (`M000`, `M012`, etc.) ou `null`.

2. **Erro de Sintaxe**  
   Não declarar variáveis com o mesmo nome (ex.: `suggestion`) no mesmo escopo.

3. **Erro de Cache/Atualização de dados**  
   Sempre recarregar dados do Supabase após alterações de banco para refletir na interface.

---

## ✅ Princípio Operacional
O sistema prioriza:
- robustez com dados reais de ERP/SAP,
- tolerância a planilhas imperfeitas,
- clareza de feedback para o usuário final,
- e consistência entre importação, categorização e auditoria.
