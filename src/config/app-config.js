/* Responsabilidade: configuração centralizada (env, flags, URLs e modo operacional). */
const runtimeConfig = globalThis.__KUSTOS_CONFIG__ || {};

function requireValue(key, value) {
  if (!value) {
    throw new Error(`Configuração obrigatória ausente: ${key}. Verifique runtime-config.js / variáveis de ambiente.`);
  }
  return value;
}

export const appConfig = {
  appEnv: runtimeConfig.APP_ENV || 'development',
  appMode: runtimeConfig.APP_MODE || 'secure_gate',
  enableVerboseLogs: runtimeConfig.ENABLE_VERBOSE_LOGS === 'true',
  supabase: {
    url: requireValue('SUPABASE_URL', runtimeConfig.SUPABASE_URL),
    anonKey: requireValue('SUPABASE_ANON_KEY', runtimeConfig.SUPABASE_ANON_KEY)
  }
};

export function debugLog(...args) {
  if (!appConfig.enableVerboseLogs) return;
  console.info('[debug]', ...args);
}
