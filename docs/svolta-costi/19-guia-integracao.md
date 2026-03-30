# Capítulo 19 — Guia de Integração

## 19.1 Informações de conexão
O consumo externo segue padrão HTTPS com payload JSON.

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Base URL | `https://<projeto>.supabase.co` | Endpoint principal |
| Protocolo | HTTPS | Segurança de transporte |
| Formato | JSON | Serialização de payload |
| Autenticação | Bearer JWT | Controle de acesso |
| Timeout recomendado | 30s | Resiliência de rede |

## 19.2 Autenticação (passo a passo)
A autenticação gera token para chamadas subsequentes.

```json
POST /auth/v1/token
{
  "email": "usuario@empresa.com",
  "password": "********"
}
```

```json
200 OK
{
  "access_token": "<jwt>",
  "token_type": "bearer",
  "user": { "id": "...", "email": "usuario@empresa.com" }
}
```

## 19.3 Headers obrigatórios

| Header | Obrigatório | Descrição |
|--------|-------------|-----------|
| `apikey` | SIM | Chave pública do projeto |
| `Authorization: Bearer <jwt>` | SIM* | Sessões autenticadas |
| `Content-Type: application/json` | SIM | Payload JSON |

## 19.4 CRUD representativo de entidades
Exemplos de operações típicas.

```markdown
Dicionário de Produtos
GET    /rest/v1/dicionario_produtos?select=*&codigo_produto=eq.123
POST   /rest/v1/dicionario_produtos
PUT    /rest/v1/dicionario_produtos?codigo_produto=eq.123
DELETE /rest/v1/dicionario_produtos?codigo_produto=eq.123

Histórico de Custos
GET    /rest/v1/historico_custos?select=*&data_referencia=gte.2026-03-01&data_referencia=lte.2026-03-31
POST   /rest/v1/historico_custos
```

## 19.5 Tratamento de erros

| HTTP | Cenário | Exemplo de resposta |
|------|---------|---------------------|
| 400 | Relação ausente no schema cache | `{ "message": "Could not find a relationship..." }` |
| 401 | Token inválido/ausente | `{ "message": "JWT invalid" }` |
| 409 | Conflito de chave | `{ "message": "duplicate key value" }` |
| 500 | Erro interno | `{ "message": "unexpected failure" }` |

## 19.6 Limites e boas práticas
A integração opera com melhor desempenho quando utiliza filtros e paginação.

| Boa prática | Descrição |
|-------------|-----------|
| Seleção de colunas | Usar `select` mínimo necessário |
| Paginação | Aplicar `limit` e `range` |
| Datas ISO | Enviar `YYYY-MM-DD` |
| Retentativas | Aplicar retry exponencial em falhas transitórias |
