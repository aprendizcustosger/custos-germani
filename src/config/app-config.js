/* Responsabilidade: configuração centralizada (env, flags, URLs e modo operacional). */
function requireValue(key, value) {
  if (!value) {
    throw new Error(`Configuração obrigatória ausente: ${key}. Verifique as variáveis de ambiente.`);
  }

  return value;
}

function readWindowEnv() {
  if (typeof window === 'undefined') return null;

  const candidates = [window.__ENV__, window.__RUNTIME_CONFIG__];
  return candidates.find(candidate => candidate && typeof candidate === 'object') || null;
}

function resolveEnvSource() {
  const importMetaEnv =
    typeof import.meta !== 'undefined' && import.meta && import.meta.env
      ? import.meta.env
      : null;

  if (importMetaEnv) {
    return { source: 'import.meta.env', env: importMetaEnv };
  }

  const runtimeEnv = readWindowEnv();
  if (runtimeEnv) {
    return { source: 'window runtime env', env: runtimeEnv };
  }

  return { source: 'none', env: {} };
}

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === 'true';
}

const { env, source: envSource } = resolveEnvSource();

export const appConfig = {
  appEnv: env.MODE || env.NODE_ENV || 'development',
  envSource,
  enableVerboseLogs: parseBoolean(env.VITE_ENABLE_VERBOSE_LOGS),
  supabase: {
    url: requireValue('VITE_SUPABASE_URL', env.VITE_SUPABASE_URL),
    anonKey: requireValue('VITE_SUPABASE_ANON_KEY', env.VITE_SUPABASE_ANON_KEY)
  }
};

export function debugLog(...args) {
  if (!appConfig.enableVerboseLogs) return;
  console.info('[debug]', ...args);
}
