import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const allowedRoles = new Set([
  'admin',
  'director',
  'secretariat',
  'finance',
  'fundraiser',
  'program_manager',
  'case_worker',
  'communications',
  'volunteer_manager',
  'hr',
  'staff',
]);

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

const envPath = resolve(process.cwd(), '.env.local');
const credentialsPath = resolve(process.cwd(), '.dev-accounts.generated.json');
const rotateGeneratedAccounts = process.argv.includes('--rotate');
let env;
try {
  env = parseEnv(readFileSync(envPath, 'utf8'));
} catch {
  console.error('Missing .env.local. Copy .env.example to .env.local before seeding development users.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('Development account seeding is forbidden in a production environment.');
  process.exit(1);
}
if (env.ALLOW_DEV_ACCOUNTS !== 'true') {
  console.log('Development account creation is disabled. Set ALLOW_DEV_ACCOUNTS=true in .env.local to enable it.');
  process.exit(0);
}

const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (
  !supabaseUrl ||
  !serviceKey ||
  supabaseUrl.includes('YOUR_PROJECT') ||
  serviceKey.includes('YOUR_SUPABASE')
) {
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const shouldGenerateAccounts = env.AUTO_GENERATE_DEV_ACCOUNTS === 'true';
let accounts = [];
if (shouldGenerateAccounts) {
  if (existsSync(credentialsPath) && !rotateGeneratedAccounts) {
    console.error(
      '.dev-accounts.generated.json already exists. Run with --rotate to refresh the development accounts and their passwords.',
    );
    process.exit(1);
  }

  const generatedRoles = [
    { role: 'admin', full_name: 'Local Test Administrator' },
    { role: 'communications', full_name: 'Local Test Communications Officer' },
    { role: 'secretariat', full_name: 'Local Test Secretariat Officer' },
    { role: 'volunteer_manager', full_name: 'Local Test Volunteer Manager' },
    { role: 'finance', full_name: 'Local Test Finance Officer' },
    { role: 'program_manager', full_name: 'Local Test Program Manager' },
    { role: 'case_worker', full_name: 'Local Test Case Worker' },
    { role: 'fundraiser', full_name: 'Local Test Fundraising Officer' },
  ];
  const emailAliases = {
    admin: 'adm',
    communications: 'com',
    secretariat: 'sec',
    volunteer_manager: 'vol',
    finance: 'fin',
    program_manager: 'prog',
    case_worker: 'case',
    fundraiser: 'fund',
  };

  let existingAccounts = [];
  if (rotateGeneratedAccounts && existsSync(credentialsPath)) {
    try {
      const previous = JSON.parse(readFileSync(credentialsPath, 'utf8'));
      existingAccounts = Array.isArray(previous.accounts)
        ? previous.accounts
        : Array.isArray(previous.workspaces)
          ? previous.workspaces.flatMap((workspace) => workspace.accounts ?? [])
          : [];
    } catch {
      console.error('.dev-accounts.generated.json is not valid JSON; it was not changed.');
      process.exit(1);
    }
  }

  accounts = generatedRoles.map(({ role, full_name }) => {
    const previous = existingAccounts.find((account) => account.role === role);
    return {
      email: `${emailAliases[role]}@hos.example.com`,
      previous_email: previous?.email,
      full_name,
      password: randomBytes(9).toString('base64url'),
      role,
    };
  });
} else {
  try {
    accounts = JSON.parse(env.DEV_ACCOUNTS_JSON || '[]');
  } catch {
    console.error('DEV_ACCOUNTS_JSON must contain a valid JSON array.');
    process.exit(1);
  }

  if (!Array.isArray(accounts)) {
    console.error('DEV_ACCOUNTS_JSON must contain a JSON array.');
    process.exit(1);
  }
  if (accounts.length === 0) {
    console.log('No development users configured.');
    process.exit(0);
  }
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

const request = async (path, options = {}) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  });
  const responseText = await response.text();
  let responseBody = {};
  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      throw new Error(`Supabase returned an unreadable response for ${path}.`);
    }
  }
  if (!response.ok) {
    const detail = responseBody.msg || responseBody.message || responseBody.error_description || responseBody.error;
    throw new Error(`${path} failed (${response.status}): ${detail || 'Supabase request failed.'}`);
  }
  return responseBody;
};

const findUser = async (email) => {
  for (let page = 1; page <= 20; page += 1) {
    const result = await request(`/auth/v1/admin/users?page=${page}&per_page=100`);
    const users = Array.isArray(result.users) ? result.users : [];
    const found = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < 100) return null;
  }
  throw new Error('Stopped searching after 2,000 Auth users. Find the test account manually and rerun.');
};

const createUser = async (account) => {
  const existingUser = await findUser(account.email);
  if (existingUser) {
    if (shouldGenerateAccounts && rotateGeneratedAccounts) {
      await request(`/auth/v1/admin/users/${existingUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          password: account.password,
          user_metadata: { full_name: account.full_name },
        }),
      });
      console.log(`Rotated development account password: ${account.role}`);
    }
    return existingUser;
  }

  if (
    shouldGenerateAccounts &&
    rotateGeneratedAccounts &&
    account.previous_email &&
    account.previous_email.toLowerCase() !== account.email.toLowerCase()
  ) {
    const previousUser = await findUser(account.previous_email);
    if (previousUser) {
      await request(`/auth/v1/admin/users/${previousUser.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          email: account.email,
          email_confirm: true,
          password: account.password,
          user_metadata: { full_name: account.full_name },
        }),
      });
      console.log(`Updated development account login: ${account.role}`);
      return previousUser;
    }
  }

  const result = await request('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name },
    }),
  });
  console.log(`Created Auth user: ${account.role}`);
  return result;
};

try {
  const generatedAccounts = [];
  const workspaceForRole = {
    admin: 'Website Administration',
    communications: 'Website Administration',
    secretariat: 'Secretariat',
    volunteer_manager: 'Secretariat',
    finance: 'Finance',
    program_manager: 'Programs / Child Support',
    case_worker: 'Programs / Child Support',
    fundraiser: 'Fundraising / Grants',
  };
  const workspaceRoleLabels = {
    admin: 'Administrator',
    communications: 'Website content editor',
    secretariat: 'Secretariat officer',
    volunteer_manager: 'Volunteer coordinator',
    finance: 'Finance officer',
    program_manager: 'Program manager',
    case_worker: 'Case worker',
    fundraiser: 'Fundraising officer',
  };
  for (const account of accounts) {
    const email = typeof account.email === 'string' ? account.email.trim() : '';
    const fullName = typeof account.full_name === 'string' ? account.full_name.trim() : '';
    const password = typeof account.password === 'string' ? account.password : '';
    const role = typeof account.role === 'string' ? account.role : '';

    if (!email || !fullName || password.length < 12 || !allowedRoles.has(role)) {
      throw new Error(
        'Each development user needs a valid email, full_name, password of at least 12 characters, and an allowed role.',
      );
    }

    const user = await createUser({ email, full_name: fullName, password, role });
    if (!user.id) {
      throw new Error(`Supabase did not return a user ID for ${email}.`);
    }

    await request('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        id: user.id,
        full_name: fullName,
        role_name: role,
      }),
    });

    await request('/rest/v1/user_roles?on_conflict=user_id,role_name', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: user.id,
        role_name: role,
      }),
    });

    if (shouldGenerateAccounts) {
      generatedAccounts.push({
        email,
        full_name: fullName,
        password,
        role,
        workspace: workspaceForRole[role],
        workspace_role: workspaceRoleLabels[role],
      });
      const workspaces = [
        'Website Administration',
        'Secretariat',
        'Finance',
        'Programs / Child Support',
        'Fundraising / Grants',
      ].map((workspace) => ({
        label: workspace,
        accounts: generatedAccounts.filter((item) => item.workspace === workspace),
      }));
      writeFileSync(
        credentialsPath,
        JSON.stringify({ generated_at: new Date().toISOString(), workspaces }, null, 2),
        { encoding: 'utf8', mode: 0o600 },
      );
    }

    console.log(`Assigned role: ${role}`);
  }

  if (shouldGenerateAccounts) {
    console.log('Development account credentials are grouped by workspace in .dev-accounts.generated.json. Keep the file private.');
  } else {
    console.log('Development user seeding complete.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Development user seeding failed.');
  process.exit(1);
}
