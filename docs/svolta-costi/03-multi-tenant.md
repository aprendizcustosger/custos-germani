# Capítulo 3 — Arquitetura Multi-tenant

## 3.1 Situação atual
A implementação atual não utiliza isolamento multi-tenant explícito.

| Propriedade | Valor | Propósito |
|-------------|-------|-----------|
| Modelo atual | Tenant único | Operação interna da empresa |
| Isolamento por cliente | Não implementado | Não aplicável no estado atual |

## 3.2 Estratégia de evolução
A evolução recomendada adiciona chave de tenant no modelo e políticas RLS.

| Item | Descrição |
|------|-----------|
| Campo sugerido | `tenant_id` nas tabelas de negócio |
| Segurança | RLS por `auth.uid()` + tenant |
| Aplicação | Header/claim para resolução de tenant |
