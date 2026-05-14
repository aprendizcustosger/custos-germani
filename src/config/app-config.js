/* Responsabilidade: configuração centralizada (env, flags, URLs e modo operacional). */
function requireValue(key, value) {
  if (!value) {
    throw new Error(`Configuração obrigatória ausente: ${key}. Verifique as variáveis de ambiente.`);
  }

  return value;
}

function resolveEnvSource() {
  const importMetaEnv =
    typeof import.meta !== 'undefined' && import.meta && import.meta.env
      ? import.meta.env
      : null;

  if (importMetaEnv) {
    return { source: 'import.meta.env', env: importMetaEnv };
  }

  const runtimeEnv =
    typeof window !== 'undefined' && window.__ENV__ && typeof window.__ENV__ === 'object'
      ? window.__ENV__
      : null;

  if (runtimeEnv) {
    return { source: 'window.__ENV__', env: runtimeEnv };
  }

  return { source: 'none', env: {} };
}

const { env, source: envSource } = resolveEnvSource();

export const appConfig = {
  appEnv: env.MODE || env.NODE_ENV || 'development',
  envSource,
  enableVerboseLogs: env.VITE_ENABLE_VERBOSE_LOGS === 'true',
  supabase: {
    url: requireValue('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL),
    anonKey: requireValue('VITE_SUPABASE_ANON_KEY', env.VITE_SUPABASE_ANON_KEY)
  }
};

export function debugLog(...args) {
  if (!appConfig.enableVerboseLogs) return;
  console.info('[debug]', ...args);
}
