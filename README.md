📊 Painel de Auditoria de Custos | Germani Alimentos
Este projeto é uma ferramenta de Business Intelligence (BI) e Data Automation desenvolvida para monitorar a volatilidade de custos de produtos, automatizar a leitura de planilhas complexas e gerar relatórios analíticos integrados ao banco de dados Supabase.

🚀 Funcionalidades Principais
1. Importação Inteligente (Zero-Format)
O sistema foi projetado para aceitar as planilhas extraídas diretamente do sistema, sem necessidade de limpeza prévia pelo usuário.

Limpeza de Moeda: O código identifica e remove automaticamente símbolos como R$, pontos de milhar e converte a vírgula decimal para ponto (formato SQL).

Mapeamento Flexível: Identifica as colunas necessárias (Produto, Descrição e Custo Total) mesmo que existam colunas desnecessárias ao redor ou espaços extras nos nomes dos cabeçalhos.

Controle de Datas: Permite definir uma "Data de Referência" para cada upload, possibilitando a criação de um histórico semanal/mensal.

2. Auditoria Analítica em Cascata
O sistema de filtros foi estruturado em três níveis hierárquicos para facilitar a busca em grandes bases de dados:

Origem: Filtro macro por canal ou tipo de produto.

Família: Filtro intermediário que carrega apenas as famílias pertencentes à origem selecionada.

Agrupamento: Filtro granular que permite isolar grupos específicos de produtos.

3. Visualização de Dados Profissional
Gráfico de Volatilidade: Gráfico de barras (Chart.js) que destaca visualmente os aumentos de custo em Vermelho e reduções/estabilidade em Cinza.

Status de Atenção: A tabela de dados destaca automaticamente em vermelho (row-alert) qualquer produto que apresente uma variação superior a 5% entre o início e o fim do período selecionado.

🛠️ Tecnologias Utilizadas
Frontend: HTML5, CSS3 (Variáveis modernas) e JavaScript Vanilla.

Banco de Dados: Supabase (PostgreSQL) para armazenamento de históricos e dicionários.

Processamento de Planilhas: SheetJS (XLSX) para leitura de arquivos .xlsx no navegador.

Gráficos: Chart.js para visualização de tendências.

Ícones: Remix Icon.

📂 Estrutura do Banco de Dados (Supabase)
O sistema opera sobre três tabelas fundamentais:

historico_custos: Armazena os valores de custo atrelados a uma data e um código de produto.

dicionario_produtos: Tabela mestre que contém as amarrações de cada produto com sua Origem, Família e Agrupamento.

categorias_origem / categorias_familia: Tabelas auxiliares para preenchimento dos filtros.

📝 Histórico de Alterações (Changelog)
v1.0: Estrutura inicial de upload e conexão com Supabase.

v1.1: Implementação dos filtros em cascata (Origem -> Família -> Agrupamento).

v1.2: Adicionado suporte para limpeza de strings de moeda (R$ 0,00) e correção de erros de salvamento.

v1.3: Otimização do gráfico para destacar aumentos de preço e inclusão de badges de status na tabela.

v1.4: Ajuste na consulta SQL (Left Join) para permitir a visualização de produtos que ainda não possuem cadastro completo no dicionário.

💡 Como Usar
Acesse a aba Importação: Selecione a data de referência no calendário.

Upload: Arraste a planilha semanal para a área demarcada. Aguarde a mensagem verde de "SUCESSO ABSOLUTO".

Auditoria: Vá para a aba Auditoria, selecione o período desejado (Início e Fim) e utilize os filtros para refinar a busca.

Análise: Observe o gráfico para identificar picos de custo e a tabela para conferir os valores exatos e variações percentuais.

Nota de Desenvolvimento: Este sistema foi construído focando na autonomia do usuário, eliminando a necessidade de edição manual de arquivos Excel antes do upload.
