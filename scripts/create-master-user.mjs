function getArg(name) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length).trim() : '';
}

const login = getArg('login');
const password = getArg('password');

if (!login || !password) {
  console.error('Uso: node scripts/create-master-user.mjs --login=<usuario_ou_email> --password=<senha>');
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Variáveis obrigatórias ausentes: VITE_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const normalizedLogin = login.trim().toLowerCase();
const email = normalizedLogin.includes('@') ? normalizedLogin : `${normalizedLogin}@master.local`;

const apiBase = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin`;

async function adminFetch(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(init.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.msg || body?.message || `HTTP ${response.status}`);
  }
  return body;
}

const listed = await adminFetch('/users?page=1&per_page=1000');
const users = Array.isArray(listed?.users) ? listed.users : [];
const already = users.find((user) => user.email?.toLowerCase() === email);

if (already) {
  console.log(`Usuário já existe: ${email} (id: ${already.id})`);
  process.exit(0);
}

const created = await adminFetch('/users', {
  method: 'POST',
  body: JSON.stringify({
    email,
    password,
    email_confirm: true,
    user_metadata: { login, role: 'master' }
  })
});

console.log(`Usuário master criado com sucesso: ${created?.email} (id: ${created?.id})`);
