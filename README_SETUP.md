# Setup de Ambiente (Frontend com runtime-config.js)

## Variáveis obrigatórias

Crie um arquivo `.env` local com:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_KEY
VITE_ENABLE_VERBOSE_LOGS=false
```

## Regras operacionais

- A fonte principal no browser estático é `runtime-config.js` com `window.__ENV__`.

- Em deploy estático/browser clássico, publique `runtime-config.js` na raiz com `window.__ENV__` e as chaves `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_VERBOSE_LOGS`.
- `runtime-config.js` deve ser carregado antes do bootstrap em `index.html`.
- Em ambiente com bundler Vite, `import.meta.env` segue aceito apenas como fallback de compatibilidade.
- Se o runtime não permitir objeto global, o frontend também aceita fallback via `<meta name="VITE_SUPABASE_URL" ...>` e `<meta name="VITE_SUPABASE_ANON_KEY" ...>` no `index.html` servido.
- Nunca commitar `.env` com credenciais reais.
- Em Vercel (Development/Preview/Production), configure as mesmas chaves no painel de Environment Variables.

## Vercel (escopos obrigatórios)

No projeto da Vercel, configure as três variáveis nos escopos:

- Development
- Preview
- Production

Sem isso, o bundle frontend pode compilar com ambiente incompleto e abrir a tela de erro de configuração no bootstrap.

## Bootstrap

No bootstrap do frontend, se `VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` estiver ausente, a aplicação renderiza uma tela amigável de configuração em vez de quebrar com stacktrace bruto.

## Validação local (quando o frontend estiver corretamente montado)

Execute na raiz que contém `package.json`:

```bash
npm run dev
npm run build
```

Se aparecer erro de `package.json` ausente, o workspace atual não montou a raiz do frontend.


## Diagnóstico rápido de bootstrap

Quando faltar configuração obrigatória, a mensagem inclui as fontes avaliadas (`window.__ENV__/__RUNTIME_CONFIG__`, `import.meta.env`, `meta[name=VITE_*]`) para acelerar investigação operacional em produção.


## Geração automática do runtime-config (Vercel)

- O projeto inclui `scripts/generate-runtime-config.mjs`, executado no `buildCommand` da Vercel (`vercel.json`).
- Esse script valida `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no ambiente de deploy e gera `runtime-config.js` com `window.__ENV__` preenchido.
- Se faltar variável obrigatória, o build falha cedo para evitar publicação de frontend inválido.
- O browser **não usa** `process.env`; `process.env` é usado apenas no build/deploy para materializar `runtime-config.js`.
