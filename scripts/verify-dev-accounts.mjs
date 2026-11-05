import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const parseEnv = (contents) => {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
};

const parseResponse = async (response, label) => {
  const responseText = await response.text();
  let body = {};
  if (responseText) {
    try {
      body = JSON.parse(responseText);
    } catch {
      throw new Error(`${label}: Supabase returned an unreadable response.`);
    }
  }
  if (!response.ok) {
    const detail = body.msg || body.message || body.error_description || body.error;
    throw new Error(`${label}: Supabase returned ${response.status}${detail ? ` (${detail})` : ''}.`);
  }
  return body;
};

const env = parseEnv(readFileSync(resolve(process.cwd(), '.env.local'), 'utf8'));
const credentialFile = resolve(process.cwd(), '.dev-accounts.generated.json');
const generated = JSON.parse(readFileSync(credentialFile, 'utf8'));
const accounts = Array.isArray(generated.accounts)
  ? generated.accounts
  : Array.isArray(generated.workspaces)
    ? generated.workspaces.flatMap((workspace) => workspace.accounts ?? [])
    : [];
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
const publicKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publicKey || !serviceKey) {
  throw new Error('Set the Supabase URL, public key, and service-role key in .env.local.');
}
if (accounts.length === 0) {
  throw new Error('The generated credentials file contains no accounts.');
}

for (const account of accounts) {
  const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: account.email, password: account.password }),
  });
  const login = await parseResponse(loginResponse, `Sign-in test for ${account.role}`);

  try {
    const roleResponse = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?select=role_name&user_id=eq.${encodeURIComponent(login.user.id)}&role_name=eq.${encodeURIComponent(account.role)}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
      },
    );
    const roleRows = await parseResponse(roleResponse, `Role verification for ${account.role}`);
    if (!Array.isArray(roleRows) || roleRows.length !== 1) {
      throw new Error(`Account ${account.email} can sign in but its ${account.role} role is missing.`);
    }
    console.log(`Sign-in and role verified: ${account.role}`);
  } finally {
    const logoutResponse = await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: publicKey,
        Authorization: `Bearer ${login.access_token}`,
      },
    });
    await parseResponse(logoutResponse, `Session cleanup for ${account.role}`);
  }
}

console.log(`Verified ${accounts.length} development accounts. No passwords or tokens were printed.`);
