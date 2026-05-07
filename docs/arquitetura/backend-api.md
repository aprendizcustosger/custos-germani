# Capítulo 4 — Backend e API

## Estado atual
- Não há servidor Node/Express no repositório.
- O frontend consome Supabase diretamente via `src/services/api.js`.

## Principais operações
- `getMasters`: carrega filtros dinâmicos baseados em dados reais.
- `importarHistoricoCustosComLog`: valida/grava histórico com log.
- `getHistorico`: consulta por período + filtros em cascata.
- `getTrendsByProduct`: tendência dos últimos 6 meses por produto.
