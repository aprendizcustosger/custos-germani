🗄️ Documentação de Engenharia de Dados: Supabase (PostgreSQL)
Este documento descreve a estrutura de tabelas, relacionamentos e restrições (constraints) do sistema de auditoria de custos. O objetivo é garantir que o histórico de preços seja imutável e que os filtros em cascata funcionem com 100% de precisão.

🏗️ Diagrama de Arquitetura de Dados
O banco foi desenhado seguindo a lógica de Snowflake Schema (Esquema Floco de Neve), onde as dimensões (categorias) são separadas das tabelas de fatos (histórico).

1. Tabela: categorias_origem
A base da pirâmide de filtros.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| id | UUID (PK) | Identificador único gerado automaticamente. |
| descricao | Text | Nome da Origem (Ex: Moagem, Massas, Biscoitos). |

2. Tabela: categorias_familia
Segundo nível da hierarquia.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| id | UUID (PK) | Identificador único. |
| descricao | Text | Nome da Família (Ex: Farinhas, Massas Ovos, Recheados). |

3. Tabela: dicionario_produtos
A tabela mestre de "amarração". Ela define onde cada produto "mora" na hierarquia da empresa.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| codigo_produto | Text (PK) | Código identificador único da Germani. |
| origem_cod | UUID (FK) | Relaciona com categorias_origem.id. |
| familia_cod | UUID (FK) | Relaciona com categorias_familia.id. |
| agrupamento_cod| Text | Nome do agrupamento específico. |

4. Tabela: historico_custos (Tabela de Fatos)
Onde os dados das suas planilhas semanais são armazenados.
| Coluna | Tipo | Descrição |
| :--- | :--- | :--- |
| id | BigInt | ID sequencial. |
| codigo_produto | Text (FK) | Referência ao dicionario_produtos. |
| descricao | Text | Nome do produto no momento da importação. |
| custo_total | Numeric | O valor financeiro (limpo de R$). |
| data_referencia | Date | A data que você seleciona no calendário do site. |
| criado_em | Timestamp | Registro automático de quando o upload foi feito. |

🔒 Regras de Negócio e Constraints (Variações)
A Chave Primária Composta (Composite Key)
Para o seu sistema de histórico funcionar, aplicamos uma regra de Unique Constraint na tabela historico_custos:

UNIQUE (codigo_produto, data_referencia)

O que isso faz?
Impede que o mesmo produto tenha dois preços diferentes na mesma data. Se você subir a planilha da "Semana 12" duas vezes, o Supabase fará o Upsert: ele identifica que o par (Produto + Data) já existe e apenas atualiza o valor, mantendo o banco limpo.

Integridade Referencial (Foreign Keys)
As tabelas estão conectadas para evitar "dados órfãos".

Se você tentar excluir uma Origem que possui Famílias vinculadas, o banco bloqueará a ação (RESTRICT). Isso garante que os filtros do site nunca fiquem vazios por erro humano.

Otimização de Performance (Indexes)
Criamos índices nas colunas de data e código:

idx_historico_data: Acelera a geração de relatórios mensais.

idx_dicionario_hierarquia: Acelera os filtros em cascata (Origem -> Família).

💻 Exemplo de Query Profissional (SQL)
Esta é a lógica que o seu site usa para buscar a variação, unindo as tabelas (Join):

SQL
SELECT 
  h.codigo_produto,
  h.descricao,
  h.custo_total,
  h.data_referencia,
  d.agrupamento_cod
FROM historico_custos h
LEFT JOIN dicionario_produtos d ON h.codigo_produto = d.codigo_produto
WHERE h.data_referencia BETWEEN '2026-03-01' AND '2026-03-31'
ORDER BY h.data_referencia ASC;
🛠️ Manutenção e Evolução
As tabelas foram desenhadas para suportar a Auditoria por Usuário que você pediu ao Codex. Para isso, basta adicionar a coluna:

alter table historico_custos add column criado_por uuid references auth.users;

Isso vinculará cada linha de custo ao e-mail de quem fez o upload.
