# Capítulo 11 — Padrões de Código

## 11.1 Arquitetura em camadas aplicada
A solução aplica separação por responsabilidade mesmo sem backend dedicado.

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| UI/Controller | `view/ui-controller.js` | Eventos, estado e renderização |
| Domínio/Regra | `core/*.js` | Transformações e cálculos |
| Serviço/API | `src/services/api.js` | Acesso ao Supabase |

## 11.2 Fluxo padrão
O fluxo padrão de consulta segue uma trilha previsível.

```
Ação do usuário -> ui-controller -> api.js -> Supabase -> report-engine -> UI
```

## 11.3 Convenções
As funções utilizam nomes em português e camelCase no código.

| Convenção | Exemplo | Observação |
|-----------|---------|------------|
| Função | `runReport` | Ação principal de auditoria |
| Serviço | `getHistorico` | Método de consulta |
| Campo DB | `data_referencia` | snake_case no banco |
