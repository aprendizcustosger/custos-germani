# Capítulo 16 — Deploy

## Modelo atual
- Publicação estática do frontend.
- Supabase como backend gerenciado.

## Checklist mínimo
1. Publicar arquivos estáticos (`index.html`, `assets`, `core`, `view`, `src`).
2. Validar acesso ao Supabase.
3. Testar importação e relatório com filtros.


## Variáveis de ambiente (Vercel)

Definir em Development, Preview e Production:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ENABLE_VERBOSE_LOGS`

O frontend lê configurações por estratégia híbrida: `import.meta.env` quando disponível e fallback `window.__ENV__`/`window.__RUNTIME_CONFIG__` em runtime estático.
