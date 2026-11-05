import { getSupabaseClient, supabasePublicKey, supabaseUrl } from './supabase';

export type AdminTable =
  | 'organizations'
  | 'website_sections'
  | 'team_years'
  | 'team_members'
  | 'programs'
  | 'projects'
  | 'galleries'
  | 'events'
  | 'announcements'
  | 'campaign_categories'
  | 'donation_campaigns'
  | 'contact_details'
  | 'social_links'
  | 'impact_metrics'
  | 'success_stories'
  | 'newsletter_subscribers'
  | 'website_page_views'
  | 'volunteer_applications'
  | 'volunteers'
  | 'volunteer_assignments'
  | 'donations'
  | 'donors'
  | 'contact_messages'
  | 'secretariat_documents'
  | 'department_updates'
  | 'families'
  | 'children'
  | 'case_records'
  | 'case_notes'
  | 'assistance_records'
  | 'audit_events'
  | 'email_notification_jobs'
  | 'grant_opportunities'
  | 'staff_accounts';

export type DataRow = Record<string, unknown>;

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
    'projects',
    'galleries',
    'events',
    'announcements',
    'campaign_categories',
    'donation_campaigns',
    'contact_details',
    'social_links',
    'secretariat_documents',
    'grant_opportunities',
  ];
  if (archivedTables.includes(table)) {
    filters.push('archived_at=is.null');
  }
  if (table === 'organizations') filters.push('order=created_at.asc');
  else if (table === 'website_sections' || table === 'impact_metrics') filters.push('order=updated_at.desc');
  else if (table === 'audit_events') filters.push('order=occurred_at.desc');
  else if (table === 'secretariat_documents' || table === 'department_updates' || table === 'grant_opportunities') {
    filters.push('order=updated_at.desc');
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

export async function archiveAdminRow(table: AdminTable, row: DataRow) {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) throw new Error('Cannot archive a record without an ID.');

  const archiveFields: Record<AdminTable, DataRow | null> = {
    organizations: null,
    website_sections: { is_published: false },
    team_years: { is_published: false, active: false },
    team_members: { is_published: false, status: 'archived' },
    programs: { is_published: false },
    projects: { is_published: false, archived_at: new Date().toISOString() },
    galleries: { is_published: false, archived_at: new Date().toISOString() },
    events: { is_published: false, status: 'archived', archived_at: new Date().toISOString() },
    announcements: { is_published: false, status: 'archived', archived_at: new Date().toISOString() },
    campaign_categories: { is_published: false, archived_at: new Date().toISOString() },
    donation_campaigns: { is_published: false, status: 'archived', archived_at: new Date().toISOString() },
    contact_details: { is_public: false, archived_at: new Date().toISOString() },
    social_links: { is_active: false, archived_at: new Date().toISOString() },
    impact_metrics: { is_published: false },
    success_stories: { is_published: false },
    newsletter_subscribers: { unsubscribed_at: new Date().toISOString() },
    volunteer_applications: null,
    volunteers: { status: 'inactive' },
    volunteer_assignments: { status: 'cancelled' },
    donations: null,
    donors: null,
    contact_messages: null,
    secretariat_documents: { status: 'archived', archived_at: new Date().toISOString() },
    department_updates: { status: 'archived' },
    families: { status: 'closed' },
    children: { status: 'closed' },
    case_records: { status: 'closed', closed_at: new Date().toISOString() },
    case_notes: null,
    assistance_records: null,
    audit_events: null,
    email_notification_jobs: { status: 'cancelled' },
    website_page_views: null,
    grant_opportunities: { status: 'archived' },
    staff_accounts: null,
  };
  const archive = archiveFields[table];
  if (!archive) {
    await request<DataRow[]>(table, `id=eq.${encodeURIComponent(id)}`, 'DELETE');
    return;
  }
  await request<DataRow[]>(table, `id=eq.${encodeURIComponent(id)}`, 'PATCH', archive);
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
