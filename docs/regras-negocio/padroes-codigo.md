# Capítulo 11 — Padrões de Código

## Camadas
- UI/controller: `view/ui-controller.js`
- Regras de domínio: `core/*.js`
- Integração de dados: `src/services/api.js`

## Práticas essenciais
- Não usar texto de descrição para lógica de categorização.
- Usar códigos e FKs para relacionamento.
- Filtrar valores nulos nos dados de interface.
- Manter validação por linha na importação.
