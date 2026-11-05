import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedAccounts = [
  ['Administration', 'admin@hos.org', 'admin'],
  ['Communications', 'communications@hos.org', 'communications'],
  ['Secretariat', 'secretariat@hos.org', 'secretariat'],
  ['Volunteer Management', 'volunteers@hos.org', 'volunteer_manager'],
  ['Finance', 'finance@hos.org', 'finance'],
  ['Programs / Child Support', 'programs@hos.org', 'program_manager'],
  ['Case Worker', 'caseworker@hos.org', 'case_worker'],
  ['Fundraising / Grants', 'fundraising@hos.org', 'fundraiser'],
];

const readEnv = (path) => {
  const parsed = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    const separator = value.indexOf('=');
    if (separator <= 0) continue;
    parsed[value.slice(0, separator).trim()] = value.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return parsed;
};

const envPath = resolve(process.cwd(), '.env.local');
if (!existsSync(envPath)) throw new Error('Missing .env.local. Copy .env.example to .env.local and set Supabase credentials.');
const env = readEnv(envPath);
const supabaseUrl = env.VITE_SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey || serviceKey.startsWith('YOUR_')) {
  throw new Error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Run staff account provisioning locally, not from a production build process.');
}
if (env.ALLOW_STAFF_ACCOUNT_PROVISIONING !== 'true') {
  throw new Error('Set ALLOW_STAFF_ACCOUNT_PROVISIONING=true in your private .env.local to enable staff account changes.');
}

const passwordMode = process.argv[2] === '--password';
const targetEmail = passwordMode ? (process.argv[3] ?? '').trim().toLowerCase() : null;
const csvPath = resolve(process.cwd(), passwordMode ? process.argv[4] ?? 'staff-accounts.csv' : process.argv[2] ?? 'staff-accounts.csv');
if (!existsSync(csvPath)) throw new Error(`Account list not found: ${csvPath}. Run npm run staff:template first.`);

const csvLines = readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
const parseCsvRow = (line) => {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else cell += char;
  }
  if (quoted) throw new Error('Unclosed quote in staff CSV.');
  cells.push(cell.trim());
  return cells;
};

const headers = parseCsvRow(csvLines[0]).map((header) => header.toLowerCase());
for (const required of ['portal', 'account_email', 'role', 'team_members', 'password']) {
  if (!headers.includes(required)) throw new Error(`CSV must include a ${required} column.`);
}

const accounts = csvLines.slice(1).map((line, index) => {
  const values = parseCsvRow(line);
  const record = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? '']));
  const account = {
    portal: record.portal.trim(),
    email: record.account_email.trim().toLowerCase(),
    role: record.role.trim(),
    teamMembers: record.team_members.split(';').map((name) => name.trim()).filter(Boolean),
    password: record.password.trim(),
  };
  const expected = expectedAccounts[index];
  if (!expected || account.portal !== expected[0] || account.email !== expected[1] || account.role !== expected[2]) {
    throw new Error(`CSV line ${index + 2} must match the preset portal, email and role order. Do not edit those columns.`);
  }
  if ((!passwordMode || account.email === targetEmail) && account.password.length < 8) {
    throw new Error(`Enter a password of at least 8 characters for ${account.portal} on CSV line ${index + 2}.`);
  }
  if (!/^[^\s@]+@hos\.org$/.test(account.email)) {
    throw new Error(`The shared login for ${account.portal} must use its preset @hos.org email.`);
  }
  return account;
});

if (accounts.length !== expectedAccounts.length) {
  throw new Error(`The CSV must contain exactly ${expectedAccounts.length} portal rows. Recreate it with npm run staff:template if necessary.`);
}
if (passwordMode && !accounts.some((account) => account.email === targetEmail)) {
  throw new Error(`No preset portal account matches ${targetEmail}.`);
}

const headersForApi = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};
const api = async (path, options = {}) => {
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: { ...headersForApi, ...options.headers },
  });
  const bodyText = await response.text();
  let body = {};
  if (bodyText) {
    try { body = JSON.parse(bodyText); } catch { throw new Error(`Supabase returned unreadable data for ${path}.`); }
  }
  if (!response.ok) {
    const message = body.msg || body.message || body.error_description || body.error;
    throw new Error(`${path} failed (${response.status}): ${message || 'Supabase request failed.'}`);
  }
  return body;
};

const users = [];
for (let page = 1; ; page += 1) {
  const result = await api(`/auth/v1/admin/users?page=${page}&per_page=1000`);
  const batch = result.users ?? [];
  users.push(...batch);
  if (batch.length < 1000) break;
}

const selectedAccounts = passwordMode ? accounts.filter((account) => account.email === targetEmail) : accounts;
for (const account of selectedAccounts) {
  const existingUser = users.find((user) => user.email?.toLowerCase() === account.email);
  let user;
  if (passwordMode) {
    if (!existingUser?.id) throw new Error(`No Supabase Auth account exists for ${account.email}.`);
    user = await api(`/auth/v1/admin/users/${encodeURIComponent(existingUser.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ password: account.password }),
    });
  } else if (existingUser?.id) {
    user = await api(`/auth/v1/admin/users/${encodeURIComponent(existingUser.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: `Heart of Sympathy ${account.portal} Team` },
      }),
    });
  } else {
    user = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        email_confirm: true,
        user_metadata: { full_name: `Heart of Sympathy ${account.portal} Team` },
      }),
    });
  }
  const userId = user.id ?? existingUser?.id;
  if (!userId) throw new Error(`Supabase did not return a user ID for ${account.email}.`);

  if (!passwordMode) {
    await api('/rest/v1/profiles?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ id: userId, full_name: `Heart of Sympathy ${account.portal} Team`, role_name: account.role }),
    });
    await api(`/rest/v1/user_roles?user_id=eq.${encodeURIComponent(userId)}&role_name=neq.${encodeURIComponent(account.role)}`, {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    });
    await api('/rest/v1/user_roles?on_conflict=user_id,role_name', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: userId, role_name: account.role }),
    });
  }
  console.log(passwordMode
    ? `Updated password for ${account.portal} (${account.email}).`
    : `Account ready for ${account.portal} (${account.email}).`);
}

console.log(passwordMode
  ? 'Password updated. The password was not printed.'
  : `Ready: ${accounts.length} shared portal accounts. Passwords were not printed.`);
