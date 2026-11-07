import { getSupabaseClient, supabasePublicKey, supabaseUrl } from './supabase';

export type AdminTable =
  | 'organizations'
  | 'website_sections'
  | 'team_years'
  | 'team_members'
  | 'programs'
  | 'partner_organizations'
  | 'galleries'
  | 'events'
  | 'announcements'
  | 'advocacy_campaigns'
  | 'campaign_categories'
  | 'donation_campaigns'
  | 'contact_details'
  | 'social_links'
  | 'newsletter_subscribers'
  | 'website_page_views'
  | 'volunteer_applications'
  | 'volunteers'
  | 'volunteer_assignments'
  | 'donations'
  | 'donation_methods'
  | 'finance_transactions'
  | 'donors'
  | 'contact_messages'
  | 'secretariat_documents'
  | 'department_updates'
  | 'families'
  | 'children'
  | 'student_support_updates'
  | 'case_records'
  | 'case_notes'
  | 'assistance_records'
  | 'audit_events'
  | 'email_notification_jobs'
  | 'grant_opportunities'
  | 'staff_accounts';

export type DataRow = Record<string, unknown>;

export type StaffAccount = {
  user_id: string;
  email: string;
  full_name: string;
  roles: string[];
  created_at: string;
};

const request = async <T>(
  table: AdminTable,
  query: string,
  method = 'GET',
  body?: DataRow,
) => {
  const client = getSupabaseClient();
  const {
    data: { session },
    error: sessionError,
  } = await client.auth.getSession();
  if (sessionError) throw new Error(`Could not verify session: ${sessionError.message}`);
  if (!session?.access_token) throw new Error('Your session expired. Sign in again.');

  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method,
    headers: {
      apikey: supabasePublicKey,
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let result: unknown = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`The database returned an unreadable response for ${table}.`);
    }
  }
  if (!response.ok) {
    const errorResult =
      typeof result === 'object' && result !== null
        ? (result as { message?: string; details?: string; hint?: string })
        : {};
    const details = [errorResult.message, errorResult.details, errorResult.hint]
      .filter(Boolean)
      .join(' ');
    throw new Error(details || `Database request failed (${response.status}).`);
  }
  return result as T;
};

export async function listAdminRows(table: AdminTable, search = '') {
  if (table === 'staff_accounts') {
    const { data, error } = await getSupabaseClient().rpc('get_staff_directory');
    if (error) throw new Error(`Unable to load staff accounts: ${error.message}`);
    const normalizedSearch = search.trim().toLocaleLowerCase();
    const rows = (data ?? []) as DataRow[];
    if (!normalizedSearch) return rows;
    return rows.filter((row) =>
      Object.values(row).some(
        (value) =>
          (typeof value === 'string' || typeof value === 'number' || Array.isArray(value)) &&
          String(value).toLocaleLowerCase().includes(normalizedSearch),
      ),
    );
  }

  const filters = ['select=*'];
  const archivedTables: AdminTable[] = [
    'galleries',
    'partner_organizations',
    'events',
    'announcements',
    'campaign_categories',
    'donation_campaigns',
    'advocacy_campaigns',
    'finance_transactions',
    'contact_details',
    'social_links',
    'secretariat_documents',
    'grant_opportunities',
  ];
  if (archivedTables.includes(table)) {
    filters.push('archived_at=is.null');
  }
  const activeFilters: Partial<Record<AdminTable, string[]>> = {
    website_sections: ['is_published=eq.true'],
    team_years: ['is_published=eq.true'],
    team_members: ['is_published=eq.true', 'status=eq.active'],
    programs: ['is_published=eq.true'],
    volunteers: ['status=neq.inactive'],
    volunteer_assignments: ['status=neq.cancelled'],
    donation_methods: ['is_active=eq.true'],
    department_updates: ['status=neq.archived'],
    families: ['status=neq.closed'],
    children: ['status=neq.closed'],
    case_records: ['status=neq.closed'],
    email_notification_jobs: ['status=neq.cancelled'],
    grant_opportunities: ['status=neq.archived'],
    advocacy_campaigns: ['status=neq.cancelled'],
  };
  filters.push(...(activeFilters[table] ?? []));
  if (table === 'newsletter_subscribers') {
    filters.push('is_confirmed=eq.true', 'unsubscribed_at=is.null');
  }
  if (table === 'organizations') filters.push('order=created_at.asc');
  else if (table === 'website_sections') filters.push('order=updated_at.desc');
  else if (table === 'partner_organizations') filters.push('order=sort_order.asc,name.asc');
  else if (table === 'audit_events') filters.push('order=occurred_at.desc');
  else if (table === 'secretariat_documents' || table === 'department_updates' || table === 'grant_opportunities' || table === 'advocacy_campaigns') {
    filters.push('order=updated_at.desc');
  } else if (table === 'finance_transactions') {
    filters.push('order=transaction_date.desc');
  } else {
    filters.push('order=created_at.desc');
  }
  filters.push('limit=250');

  const rows = await request<DataRow[]>(table, filters.join('&'));
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return rows;
  return rows.filter((row) =>
    Object.values(row).some(
      (value) =>
        (typeof value === 'string' || typeof value === 'number') &&
        String(value).toLocaleLowerCase().includes(normalizedSearch),
    ),
  );
}

export async function listStaffAccounts() {
  const { data, error } = await getSupabaseClient().functions.invoke<{ accounts: StaffAccount[] }>(
    'admin-manage-staff',
    { body: { action: 'list' } },
  );
  if (error) throw new Error(`Unable to load staff accounts: ${error.message}`);
  if (!data) throw new Error('The staff account service returned no account list.');
  return data.accounts;
}

export async function updateStaffAccount(userId: string, email: string, password: string) {
  const { data, error } = await getSupabaseClient().functions.invoke<{
    account: Pick<StaffAccount, 'user_id' | 'email' | 'roles'>;
    auditWarning?: string;
  }>('admin-manage-staff', {
    body: {
      action: 'update',
      userId,
      ...(email.trim() ? { email: email.trim() } : {}),
      ...(password ? { password } : {}),
    },
  });
  if (error) throw new Error(`Unable to update staff account: ${error.message}`);
  if (!data) throw new Error('The staff account service returned no update result.');
  return { ...data.account, auditWarning: data.auditWarning };
}

export async function loadAdminAnalytics(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  since.setHours(0, 0, 0, 0);
  const loadRows = async (table: 'website_page_views' | 'audit_events', dateColumn: string, columns: string) => {
    const records: DataRow[] = [];
    const limit = 1000;
    for (let offset = 0; ; offset += limit) {
      const query = `select=${columns}&${dateColumn}=gte.${encodeURIComponent(since.toISOString())}&order=${dateColumn}.asc&limit=${limit}&offset=${offset}`;
      const batch = await request<DataRow[]>(table, query);
      records.push(...batch);
      if (batch.length < limit) return records;
    }
  };
  const [pageViews, auditEvents] = await Promise.all([
    loadRows('website_page_views', 'created_at', 'page_path,created_at'),
    loadRows('audit_events', 'occurred_at', 'table_name,action,occurred_at'),
  ]);
  return { pageViews, auditEvents };
}

export async function saveAdminRow(
  table: AdminTable,
  values: DataRow,
  id?: string,
) {
  const body = { ...values };
  const query = id
    ? `id=eq.${encodeURIComponent(id)}`
    : 'select=*';
  const result = await request<DataRow[]>(
    table,
    query,
    id ? 'PATCH' : 'POST',
    body,
  );
  if (Array.isArray(result)) return result[0] ?? null;
  return null;
}

export async function deleteAdminRow(table: AdminTable, row: DataRow) {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) throw new Error('Cannot delete a record without an ID.');

  const changedRows = await request<DataRow[]>(table, `id=eq.${encodeURIComponent(id)}`, 'DELETE');
  if (!Array.isArray(changedRows) || changedRows.length === 0) {
    throw new Error('No record was changed. It may already be removed, or your account may not have permission to delete it.');
  }
}

const acceptedImageTypes = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
]);

export async function uploadPublicImage(file: File, folder: string) {
  const extension = acceptedImageTypes.get(file.type);
  if (!extension) {
    throw new Error('Choose a JPEG, PNG, WebP, or AVIF image. SVG files are not allowed.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const client = getSupabaseClient();
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage.from('hos-public').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  return client.storage.from('hos-public').getPublicUrl(path).data.publicUrl;
}

export async function submitPageView(pagePath: string, referrerHost: string | null) {
  const { error } = await getSupabaseClient()
    .from('website_page_views')
    .insert({ page_path: pagePath.slice(0, 200), referrer_host: referrerHost, country_code: null });
  if (error) throw new Error(`Page view could not be recorded: ${error.message}`);
}
