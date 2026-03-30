# Capítulo 14 — Rotas e Navegação

## 14.1 Mapa de navegação
A aplicação usa navegação por views no mesmo documento.

| Rota lógica | Título | Proteção | Arquivo principal |
|-------------|--------|----------|-------------------|
| `view-import` | Importação | Contexto de usuário local/supabase | `view/ui-controller.js` |
| `view-report` | Auditoria | Exige período válido | `view/ui-controller.js` |

## 14.2 Regras de transição
A troca de view ocorre por botões com atributo `data-view-trigger`.

| Trigger | Destino | Efeito |
|---------|---------|--------|
| Importação | `#view-import` | Exibe upload |
| Auditoria | `#view-report` | Exibe filtros e relatório |
