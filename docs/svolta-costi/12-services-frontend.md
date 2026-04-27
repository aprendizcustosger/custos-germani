# Capítulo 12 — Services Frontend

`src/services/api.js` é a camada única de acesso ao Supabase.

## Responsabilidades principais
- Carregar dados mestres com recorte por produtos que têm custo.
- Garantir produto no dicionário antes da gravação de custo.
- Importar histórico com validação e log.
- Buscar histórico por período/filtros e tendência temporal.
