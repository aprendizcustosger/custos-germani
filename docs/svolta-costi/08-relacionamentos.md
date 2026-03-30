# Capítulo 8 — Relacionamentos

## 8.1 Integridade referencial
Os relacionamentos garantem consistência dos filtros e da auditoria.

| Tabela Origem | Campo FK | Tabela Destino | Campo PK | ON DELETE |
|---------------|----------|----------------|----------|-----------|
| dicionario_produtos | origem_cod | categorias_origem | id | RESTRICT |
| dicionario_produtos | familia_cod | categorias_familia | id | RESTRICT |
| dicionario_produtos | agrupamento_cod | categorias_agrupamento | id | RESTRICT |
| historico_custos | codigo_produto | dicionario_produtos | codigo_produto | RESTRICT |

## 8.2 Diagrama de dependências
O diagrama resume a hierarquia de dados.

```
categorias_origem ----+
                      |
categorias_familia ---+--> dicionario_produtos --> historico_custos
                      |
categorias_agrupamento+
```
