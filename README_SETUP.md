# Setup de Ambiente (Frontend Runtime Híbrido)

## Variáveis obrigatórias

Crie um arquivo `.env` local com:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_SUPABASE_ANON_KEY
VITE_ENABLE_VERBOSE_LOGS=false
```

## Regras operacionais

- Em ambiente com bundler Vite, use variáveis com prefixo `VITE_` no frontend.
- Em deploy estático sem `import.meta.env`, injete `window.__ENV__` (ou `window.__RUNTIME_CONFIG__`) antes do bootstrap com as mesmas chaves (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_VERBOSE_LOGS`).
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
