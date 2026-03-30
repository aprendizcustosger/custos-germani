# Capítulo 9 — Autenticação

## 9.1 Mecanismo atual
A autenticação utiliza Supabase Auth, com fallback local para modo operacional simplificado.

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Provedor | Supabase Auth | Login por e-mail/senha |
| Sessão | Gerenciada pelo cliente Supabase | Persistência de usuário |
| Fallback local | `modo_local` na UI | Continuidade em ambiente interno |

## 9.2 Fluxo de autenticação
O fluxo abaixo resume o processo de login.

```
UI -> api.signIn/login
   -> supabase.auth.signInWithPassword
   -> sessão válida -> acesso às consultas
```

> **Nota:** o projeto também possui `signInWithMasterBootstrap` para bootstrap do usuário master.
