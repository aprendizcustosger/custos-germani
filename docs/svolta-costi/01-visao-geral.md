# Capítulo 1 — Visão Geral do Sistema

## 1.1 Objetivo do sistema
O sistema monitora variações de custos de produtos com importação de planilhas e análise por período. A aplicação apresenta filtros em cascata por Origem, Família e Agrupamento.

## 1.2 Público-alvo
O sistema atende analistas de custos, controladoria e coordenação industrial.

| Perfil | Uso principal | Resultado esperado |
|--------|---------------|-------------------|
| Analista de custos | Importar planilhas e gerar relatório | Identificar variações e alertas |
| Coordenação | Acompanhar tendência de produtos | Tomada de decisão por produto |

## 1.3 Fluxo operacional
O fluxo operacional inicia na importação e termina na análise gráfica/tabelada.

```
Usuário -> Upload de planilha -> Normalização de dados -> Upsert no Supabase
       -> Seleção de período/filtros -> Consulta de histórico -> KPI/Gráfico/Tabela
```

## 1.4 Ambiente
A aplicação roda como SPA em JavaScript e consome Supabase via cliente JS (ver Capítulo 2).

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Tipo de app | Frontend SPA | Operação no navegador |
| Base de dados | Supabase Postgres | Persistência de histórico e dicionário |
| URL produção | Configurada por deploy estático | Acesso dos usuários |
