# Capítulo 10 — Middlewares

## 10.1 Situação atual
A aplicação não possui middlewares backend próprios por ser frontend-only.

| Middleware | Assinatura | Situação |
|------------|------------|----------|
| verificarToken | N/A | Não aplicável |
| getTenantConnection | N/A | Não aplicável |

## 10.2 Camadas equivalentes no frontend
A lógica de proteção ocorre em fluxo de UI e tratamento de erro da API.

| Camada | Função |
|--------|--------|
| `autoAuthenticate` | Define contexto de usuário local |
| Tratamento em `runReport` | Interrompe fluxo em erro de consulta |
| Modal de validação | Garante qualidade de importação |
