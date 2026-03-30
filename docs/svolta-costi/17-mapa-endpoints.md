# Capítulo 17 — Mapa de Endpoints

## 17.1 Endpoints de autenticação (Supabase Auth)
A aplicação consome endpoints gerenciados pelo Supabase SDK.

```markdown
Auth
POST   /auth/v1/token              → Login por e-mail/senha
POST   /auth/v1/signup             → Cadastro bootstrap de master
POST   /auth/v1/logout             → Encerrar sessão
GET    /auth/v1/user               → Obter usuário da sessão
```

## 17.2 Endpoints de dados (PostgREST)
As tabelas são acessadas pelo cliente Supabase em operações CRUD.

```markdown
Dados Mestres
GET    /rest/v1/categorias_origem          → Listar origens
GET    /rest/v1/categorias_familia         → Listar famílias
GET    /rest/v1/categorias_agrupamento     → Listar agrupamentos
GET    /rest/v1/dicionario_produtos        → Listar dicionário

Histórico
POST   /rest/v1/historico_custos           → Upsert de histórico
GET    /rest/v1/historico_custos           → Consultar por período/filtros
GET    /rest/v1/historico_custos           → Tendência por produto
```
