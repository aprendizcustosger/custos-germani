# Capítulo 4 — Backend e API

## 4.1 Panorama
A solução não possui backend Node/Express dedicado. A camada de API reside no frontend (`src/services/api.js`) e consome a API do Supabase.

## 4.2 Estrutura relevante
A estrutura abaixo apresenta os arquivos usados para integração.

```text
/workspace/custos-germani/
├── src/
│   └── services/
│       └── api.js                 ← Cliente Supabase e métodos de consulta
├── services/
│   └── api.js                     ← Reexport de compatibilidade
└── view/
    └── ui-controller.js           ← Orquestra chamadas da API na UI
```

## 4.3 Registro de rotas
As rotas HTTP são remotas e gerenciadas pelo Supabase/PostgREST (ver Capítulo 17).

| Módulo | Descrição |
|--------|-----------|
| `api.getMasters` | Carrega tabelas auxiliares e dicionário |
| `api.getHistorico` | Busca histórico com fallback de relacionamento |
| `api.upsertHistoricoCustos` | Realiza upsert por chave composta |
| `api.getTrendsByProduct` | Obtém série temporal de 6 meses |
