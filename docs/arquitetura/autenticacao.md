# Capítulo 9 — Autenticação

## Estado atual na UI
A UI inicializa em `modo_local` para operação interna (`autoAuthenticate`).

## Capacidades no serviço
`src/services/api.js` mantém métodos de autenticação Supabase (`signIn`, `signOut`, `getCurrentUser`), porém o fluxo principal da interface atual opera em modo local.
