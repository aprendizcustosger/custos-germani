# Capítulo 2 — Stack Tecnológico

## 2.1 Tecnologias principais
A solução utiliza stack frontend leve com serviços diretos ao Supabase.

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| JavaScript (ES Modules) | Atual do navegador | Lógica de interface e serviços |
| Supabase JS | 2.x (CDN) | Autenticação e acesso ao Postgres |
| SheetJS (XLSX) | Runtime via browser | Leitura de planilhas |
| Chart.js | Runtime via browser | Visualização analítica |
| SweetAlert2 | Runtime via browser | Feedback e diálogos |

## 2.2 Justificativas
A stack privilegia tempo de entrega e baixo custo operacional.

| Escolha | Justificativa | Impacto |
|---------|---------------|---------|
| SPA sem backend próprio | Reduz complexidade de infraestrutura | Menor manutenção |
| Supabase | Banco + auth + API em serviço único | Acelera evolução |
| Bibliotecas em CDN | Simplifica build | Dependência de rede |
