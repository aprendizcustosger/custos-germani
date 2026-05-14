#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const requiredKeys = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'];
const optionalDefaults = {
  VITE_ENABLE_VERBOSE_LOGS: 'false'
};

const missing = requiredKeys.filter(key => !process.env[key] || !String(process.env[key]).trim());
if (missing.length) {
  console.error(`[runtime-config] Variáveis obrigatórias ausentes: ${missing.join(', ')}`);
  process.exit(1);
}

const runtimeEnv = {
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL.trim(),
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY.trim(),
  VITE_ENABLE_VERBOSE_LOGS: (process.env.VITE_ENABLE_VERBOSE_LOGS || optionalDefaults.VITE_ENABLE_VERBOSE_LOGS).trim()
};

const fileContent = `/* Arquivo gerado automaticamente em deploy/build. Não editar manualmente. */\nwindow.__ENV__ = Object.freeze(${JSON.stringify(runtimeEnv, null, 2)});\n`;

writeFileSync('runtime-config.js', fileContent, 'utf8');
console.log('[runtime-config] runtime-config.js gerado com sucesso.');
