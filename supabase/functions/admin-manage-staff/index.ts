import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const organizationRoles = [
  'admin',
  'director',
  'management',
  'it_data',
  'communications',
  'secretariat',
  'program_manager',
  'case_worker',
  'child_protection',
  'education_support',
  'health_nutrition',
  'finance',
  'fundraiser',
  'volunteer_manager',
  'advocacy_lead',
  'hr',
  'staff',
];

type RequestBody =
  | { action: 'list' }
  | { action: 'update'; userId: string; email?: string; password?: string };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'Method not allowed.' }, 405);

  const authorization = request.headers.get('Authorization');
  const accessToken = authorization?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return response({ error: 'Sign in as an administrator to continue.' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('Staff management function is missing Supabase environment configuration.');
    return response({ error: 'Account management is temporarily unavailable.' }, 500);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return response({ error: 'Your session is invalid or expired.' }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminRole, error: roleError } = await adminClient
    .from('user_roles')
    .select('id')
    .eq('user_id', authData.user.id)
    .eq('role_name', 'admin')
    .maybeSingle();
  if (roleError) {
    console.error('Could not verify staff-management permissions.', roleError);
    return response({ error: 'Could not verify administrator permissions.' }, 500);
  }
  if (!adminRole) return response({ error: 'Only administrators can manage staff accounts.' }, 403);

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return response({ error: 'The request could not be read.' }, 400);
  }

  if (body.action === 'list') {
    const { data: roleRows, error: staffRolesError } = await adminClient
      .from('user_roles')
      .select('user_id,role_name')
      .in('role_name', organizationRoles);
    if (staffRolesError) {
      console.error('Could not load staff account roles.', staffRolesError);
      return response({ error: 'Unable to load staff accounts.' }, 500);
    }

    const rolesByUser = new Map<string, string[]>();
    for (const row of roleRows ?? []) {
      rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role_name]);
    }

    const users = [];
    for (let page = 1; ; page += 1) {
      const { data, error: usersError } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
      if (usersError) {
        console.error('Could not load Supabase Auth users.', usersError);
        return response({ error: 'Unable to load staff accounts.' }, 500);
      }
      users.push(...data.users.filter((user) => rolesByUser.has(user.id)));
      if (data.users.length < 1000) break;
    }

    return response({
      accounts: users.map((user) => ({
        user_id: user.id,
        email: user.email ?? '',
        full_name: typeof user.user_metadata.full_name === 'string' ? user.user_metadata.full_name : '',
        roles: rolesByUser.get(user.id) ?? [],
        created_at: user.created_at,
      })),
    });
  }

  if (body.action !== 'update' || !/^[0-9a-f-]{36}$/i.test(body.userId)) {
    return response({ error: 'Choose a valid staff account.' }, 400);
  }

  const updates: { email?: string; password?: string } = {};
  if (body.email !== undefined) {
    const email = body.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return response({ error: 'Enter a valid work email address.' }, 400);
    }
    updates.email = email;
  }
  if (body.password !== undefined && body.password !== '') {
    if (body.password.length < 12) {
      return response({ error: 'Use a password with at least 12 characters.' }, 400);
    }
    updates.password = body.password;
  }
  if (!Object.keys(updates).length) return response({ error: 'Enter a new email address or password.' }, 400);

  const { data: targetRoles, error: targetRoleError } = await adminClient
    .from('user_roles')
    .select('role_name')
    .eq('user_id', body.userId)
    .in('role_name', organizationRoles);
  if (targetRoleError) {
    console.error('Could not verify the target staff account.', targetRoleError);
    return response({ error: 'Could not verify the selected staff account.' }, 500);
  }
  if (!targetRoles?.length) return response({ error: 'The selected account is not an organization staff account.' }, 404);

  const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(body.userId, updates);
  if (updateError) return response({ error: updateError.message }, 400);

  const { error: auditError } = await adminClient.from('audit_events').insert({
    table_name: 'auth.users',
    record_id: body.userId,
    action: 'UPDATE',
    actor_id: authData.user.id,
  });
  if (auditError) console.error('Could not record the staff account update in audit history.', auditError);

  return response({
    account: {
      user_id: updatedUser.user.id,
      email: updatedUser.user.email ?? '',
      roles: targetRoles.map((row) => row.role_name),
    },
    ...(auditError ? { auditWarning: 'The account changed, but the audit event could not be recorded.' } : {}),
  });
});
