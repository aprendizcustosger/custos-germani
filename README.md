# Germani Custos

Painel web para **importação** e **auditoria de custos** de produtos, com persistência no Supabase.

O projeto é uma aplicação front-end enxuta (HTML + CSS + JavaScript puro) centrada em dois fluxos:

1. **Importar planilhas `.xlsx`** com custos por produto para uma data de referência.
2. **Gerar relatório analítico** por período, origem e família, comparando custo inicial vs. final.

---

## Visão geral funcional

### 1) Importação de custos

Na aba **Importação**, o usuário:

- seleciona uma **data de referência**;
- envia uma planilha `.xlsx` por clique ou arrastar/soltar;
- o sistema lê a primeira aba da planilha e tenta identificar colunas de:
  - `produto` (código);
  - `custo total`;
  - `descrição`;
- transforma os registros em payload e faz `upsert` na tabela `historico_custos` com conflito em `codigo_produto, data_referencia`.

Resultado esperado:

- **sucesso**: quantidade de itens salvos para a data;
- **erro**: mensagem orientando checagem de cadastro no dicionário de produtos.

### 2) Relatório analítico

Na aba **Auditoria**, o usuário informa:

- período inicial e final;
- filtro de origem (opcional);
- filtro de família (opcional, em cascata conforme origem).

A consulta busca dados de `historico_custos` (com relacionamento `dicionario_produtos`) e:

- agrupa por produto;
- calcula variação percentual entre primeiro e último custo no período;
- apresenta tabela com status:
  - `ALTA` quando variação > 5%;
  - `OK` caso contrário.

---

## Arquitetura técnica

- **Front-end:** arquivo único `index.html`.
- **Estilo:** CSS embutido.
- **Lógica:** JavaScript embutido.
- **Banco/API:** Supabase (`@supabase/supabase-js` via CDN).
- **Leitura de planilhas:** `xlsx` via CDN.
- **Ícones:** Remix Icon via CDN.
- **Chart.js:** carregado via CDN (estrutura preparada para gráfico, mas sem renderização explícita no código atual).

---

## Estrutura do repositório

```text
.
├── index.html   # Aplicação completa (UI + lógica)
└── README.md    # Este documento
```

---

## Dependências externas (CDN)

Carregadas diretamente no `index.html`:

- `@supabase/supabase-js@2`
- `xlsx.full.min.js`
- `chart.js`
- `remixicon`

> Observação: por usar CDN, não há `package.json` nem etapa de build.

---

## Modelo de dados esperado no Supabase

Com base no código, a aplicação espera (no mínimo) as tabelas:

- `categorias_origem`
- `categorias_familia`
- `dicionario_produtos`
- `historico_custos`

Campos usados diretamente:

- `historico_custos`
  - `codigo_produto`
  - `descricao`
  - `custo_total`
  - `data_referencia`
- `dicionario_produtos`
  - `origem_cod`
  - `familia_cod`
- `categorias_origem` / `categorias_familia`
  - `id`
  - `descricao`

Também é assumida chave de conflito para upsert:

- `codigo_produto, data_referencia`

---

## Como executar

Como é um front-end estático, basta servir os arquivos localmente.

### Opção 1: Python

```bash
python3 -m http.server 8080
```

Acesse:

- `http://localhost:8080`

### Opção 2: abrir direto no navegador

Também pode funcionar abrindo o `index.html` diretamente, mas recomenda-se servidor local para evitar limitações de ambiente.

---

## Configuração

As credenciais do Supabase estão definidas no próprio `index.html` nas constantes:

- `S_URL`
- `S_KEY`

Se necessário, substitua pelos valores do seu projeto Supabase.

---

## Pontos de atenção

- **Segurança:** atualmente a `anon key` está no código cliente, o que é comum para apps Supabase client-side, mas exige políticas RLS corretas.
- **Validação de planilha:** a detecção de colunas depende do nome dos cabeçalhos; variações podem quebrar a importação.
- **Tratamento de erro:** ainda básico; pode ser expandido para mensagens mais detalhadas por linha.
- **Gráfico:** existe `<canvas>` e dependência do Chart.js, mas não há plotagem implementada no trecho atual.

---

## Melhorias recomendadas

- Extrair JS/CSS para arquivos dedicados.
- Criar camada de serviços para consultas Supabase.
- Implementar testes de parsing de planilha.
- Adicionar autenticação e auditoria por usuário.
- Padronizar template de planilha de importação.
- Implementar gráfico de tendência por produto/família.

---

## Licença

Sem licença definida no repositório até o momento.
