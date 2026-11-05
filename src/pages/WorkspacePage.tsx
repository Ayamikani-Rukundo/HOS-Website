import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Activity,
  BookOpen,
  Check,
  ClipboardCopy,
  CircleDollarSign,
  FileDown,
  FileText,
  HeartHandshake,
  Eye,
  ImageUp,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { canAccessRole, getPortalTeam, getPortals, type OrganizationRole, type PortalKind } from '../lib/authorization';
import { getSupabaseClient } from '../lib/supabase';
import {
  archiveAdminRow,
  loadAdminAnalytics,
  listAdminRows,
  saveAdminRow,
  uploadPublicImage,
  type AdminTable,
  type DataRow,
} from '../lib/admin-api';

type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'json' | 'tags' | 'image' | 'image-list' | 'reference';
type Field = { key: string; label: string; kind?: FieldKind; required?: boolean; options?: string[]; placeholder?: string; referenceTable?: AdminTable; referenceLabel?: string[] };
type TableConfig = {
  table: AdminTable;
  title: string;
  description: string;
  columns: string[];
  fields: Field[];
  readOnly?: boolean;
  canCreate?: boolean;
  canArchive?: boolean;
  archiveLabel?: string;
};

const field = (key: string, label = key.replaceAll('_', ' '), kind: FieldKind = 'text', options?: string[], required = false): Field => ({ key, label, kind, options, required });
const referenceField = (key: string, label: string, referenceTable: AdminTable, referenceLabel: string[], required = false): Field => ({
  key,
  label,
  kind: 'reference',
  referenceTable,
  referenceLabel,
  required,
});

const configs: Record<AdminTable, TableConfig> = {
  organizations: { table: 'organizations', title: 'Organization profile', description: 'Public identity and official contact details.', columns: ['name', 'tagline', 'location', 'email'], fields: [field('name', 'Name', 'text', undefined, true), field('tagline'), field('location'), field('founded_year'), field('mission', 'Mission', 'textarea'), field('email'), field('phone'), field('address', 'Address', 'textarea'), field('currency_code')], canCreate: false, canArchive: false },
  website_sections: { table: 'website_sections', title: 'Website sections', description: 'Titles and structured content for public pages.', columns: ['section_key', 'title', 'is_published'], fields: [field('section_key', 'Section key', 'text', undefined, true), field('title', 'Title', 'text', undefined, true), field('content', 'Page content', 'json'), field('is_published', 'Published', 'boolean')] },
  team_years: { table: 'team_years', title: 'Team years', description: 'Published annual team rosters.', columns: ['year_label', 'active', 'is_published'], fields: [field('year_label', 'Year', 'text', undefined, true), field('active', 'Active', 'boolean'), field('is_published', 'Published', 'boolean'), field('sort_order', 'Display order', 'number')] },
  team_members: { table: 'team_members', title: 'Team members', description: 'Approved staff and leadership biographies.', columns: ['full_name', 'role_title', 'status', 'is_published'], fields: [referenceField('team_year_id', 'Team year', 'team_years', ['year_label'], true), field('full_name', 'Full name', 'text', undefined, true), field('role_title', 'Role title'), field('focus_area'), field('biography', 'Biography', 'textarea'), field('email'), field('avatar_url', 'Profile image', 'image'), field('status', 'Status', 'select', ['active', 'inactive', 'archived']), field('is_published', 'Published', 'boolean'), field('sort_order', 'Display order', 'number')] },
  programs: { table: 'programs', title: 'Programs', description: 'Public program information and summaries.', columns: ['name', 'slug', 'is_published'], fields: [field('slug', 'URL slug', 'text', undefined, true), field('name', 'Name', 'text', undefined, true), field('summary', 'Summary', 'textarea', undefined, true), field('description', 'Description', 'textarea'), field('impact', 'Focus / impact', 'textarea'), field('feature_label'), field('cover_image_url', 'Cover image', 'image'), field('additional_images', 'Additional images', 'json'), field('objectives', 'Objectives (one per line)', 'json'), field('is_featured', 'Featured', 'boolean'), field('is_published', 'Published', 'boolean'), field('sort_order', 'Display order', 'number')] },
  projects: { table: 'projects', title: 'Projects', description: 'Public project status and verified outcomes.', columns: ['title', 'status', 'location', 'is_published'], fields: [referenceField('program_id', 'Program', 'programs', ['name']), field('title', 'Title', 'text', undefined, true), field('description', 'Description', 'textarea'), field('status', 'Status', 'select', ['planned', 'active', 'completed', 'on_hold', 'cancelled']), field('location'), field('start_date', 'Start date', 'date'), field('end_date', 'End date', 'date'), field('completed_at', 'Completed date', 'date'), field('budget_amount', 'Budget amount', 'number'), field('currency_code', 'Currency'), field('cover_image_url', 'Cover image', 'image'), field('outcome_summary', 'Verified outcome', 'textarea'), field('is_published', 'Published', 'boolean')] },
  galleries: { table: 'galleries', title: 'Gallery', description: 'Create a photo post with one or more original images.', columns: ['title', 'collection_name', 'is_published'], fields: [field('title', 'Post title'), field('additional_images', 'Post images', 'image-list', undefined, true), field('alt_text', 'Alternative text'), field('caption', 'Caption', 'textarea'), field('description', 'Description', 'textarea'), field('collection_name', 'Collection'), field('activity_date', 'Activity date', 'date'), field('is_published', 'Published', 'boolean'), field('sort_order', 'Display order', 'number')] },
  events: { table: 'events', title: 'Events', description: 'Public event details, timing and registration links.', columns: ['title', 'event_date', 'status', 'is_published'], fields: [field('title', 'Title', 'text', undefined, true), field('summary', 'Description', 'textarea', undefined, true), field('event_date', 'Event date', 'date'), field('starts_at', 'Starts at', 'datetime'), field('ends_at', 'Ends at', 'datetime'), field('location'), field('image_url', 'Image', 'image'), field('cover_image_url', 'Cover image', 'image'), field('registration_url', 'Registration URL'), field('status', 'Status', 'select', ['draft', 'published', 'cancelled']), field('is_published', 'Published', 'boolean')] },
  announcements: { table: 'announcements', title: 'Announcements', description: 'Public and internal organization updates.', columns: ['title', 'audience', 'status', 'published_at'], fields: [field('title', 'Title', 'text', undefined, true), field('body', 'Announcement', 'textarea', undefined, true), field('audience', 'Audience', 'select', ['public', 'staff']), field('published_at', 'Publish date', 'datetime'), field('expires_at', 'Expiry date', 'datetime'), field('cover_image_url', 'Cover image', 'image'), field('status', 'Status', 'select', ['draft', 'published', 'archived']), field('is_published', 'Published', 'boolean')] },
  campaign_categories: { table: 'campaign_categories', title: 'Campaign categories', description: 'Giving areas used to organize campaigns.', columns: ['name', 'is_published'], fields: [field('name', 'Name', 'text', undefined, true), field('description', 'Description', 'textarea'), field('icon'), field('sort_order', 'Display order', 'number'), field('is_published', 'Published', 'boolean')] },
  donation_campaigns: { table: 'donation_campaigns', title: 'Campaigns', description: 'Giving targets and verified offline campaign updates. No payment is processed here.', columns: ['title', 'status', 'target_amount', 'raised_amount'], fields: [referenceField('category_id', 'Category', 'campaign_categories', ['name']), field('slug'), field('title', 'Title', 'text', undefined, true), field('description', 'Description', 'textarea'), field('target_amount', 'Target amount', 'number'), field('raised_amount', 'Verified amount raised', 'number'), field('currency_code', 'Currency'), field('status', 'Status', 'select', ['draft', 'active', 'paused', 'completed', 'archived']), field('starts_at', 'Start date', 'date'), field('ends_at', 'End date', 'date'), field('cover_image_url', 'Cover image', 'image'), field('donation_instructions', 'Giving instructions', 'textarea'), field('suggested_amounts', 'Suggested amounts', 'json'), field('payment_methods', 'Payment methods (one per line)', 'json'), field('sort_order', 'Display order', 'number'), field('is_published', 'Published', 'boolean')] },
  contact_details: { table: 'contact_details', title: 'Contact details', description: 'Official contact points displayed on the public website.', columns: ['label', 'category', 'value', 'is_public'], fields: [field('label', 'Label', 'text', undefined, true), field('value', 'Value', 'text', undefined, true), field('category', 'Category', 'text', undefined, true), field('is_public', 'Public', 'boolean'), field('sort_order', 'Display order', 'number')] },
  social_links: { table: 'social_links', title: 'Social links', description: 'Verified organization social profiles.', columns: ['platform', 'url', 'is_active'], fields: [field('platform', 'Platform', 'text', undefined, true), field('url', 'URL', 'text', undefined, true), field('is_active', 'Active', 'boolean'), field('sort_order', 'Display order', 'number')] },
  impact_metrics: { table: 'impact_metrics', title: 'Impact metrics', description: 'Reviewed impact figures only; do not enter estimates.', columns: ['label', 'value', 'is_published'], fields: [field('label', 'Label', 'text', undefined, true), field('value', 'Verified value', 'text', undefined, true), field('description', 'Description', 'textarea'), field('is_published', 'Published', 'boolean'), field('sort_order', 'Display order', 'number')] },
  success_stories: { table: 'success_stories', title: 'Community stories', description: 'Stories must have informed consent and approval before publication.', columns: ['title', 'is_published', 'published_at'], fields: [referenceField('program_id', 'Program', 'programs', ['name']), field('title', 'Title', 'text', undefined, true), field('summary', 'Summary', 'textarea', undefined, true), field('story', 'Story', 'textarea'), field('image_url', 'Image', 'image'), field('is_published', 'Published', 'boolean'), field('published_at', 'Publish date', 'datetime')] },
  newsletter_subscribers: { table: 'newsletter_subscribers', title: 'Newsletter subscribers', description: 'Subscriber email addresses and subscription status are private.', columns: ['email', 'is_confirmed', 'unsubscribed_at'], fields: [field('email', 'Email', 'text', undefined, true), field('name'), field('is_confirmed', 'Confirmed', 'boolean')], canCreate: false, archiveLabel: 'Unsubscribe address' },
  volunteer_applications: { table: 'volunteer_applications', title: 'Volunteer applications', description: 'Review incoming volunteer interest and update its status.', columns: ['full_name', 'email', 'status', 'created_at'], fields: [field('status', 'Status', 'select', ['new', 'reviewing', 'accepted', 'declined'])], canCreate: false, canArchive: false },
  volunteers: { table: 'volunteers', title: 'Volunteer records', description: 'Volunteer contacts, skills and current status.', columns: ['full_name', 'email', 'status'], fields: [field('full_name', 'Full name', 'text', undefined, true), field('email', 'Email'), field('phone', 'Phone'), field('skills', 'Skills (one per line)', 'json'), field('status', 'Status', 'select', ['applicant', 'active', 'inactive']), field('joined_at', 'Joined date', 'date')] },
  volunteer_assignments: { table: 'volunteer_assignments', title: 'Volunteer assignments', description: 'Event and project assignments for volunteers.', columns: ['volunteer_id', 'role_title', 'starts_at', 'status'], fields: [referenceField('volunteer_id', 'Volunteer', 'volunteers', ['full_name', 'email'], true), referenceField('project_id', 'Project', 'projects', ['title']), referenceField('event_id', 'Event', 'events', ['title']), field('role_title', 'Assignment role'), field('starts_at', 'Starts at', 'datetime'), field('ends_at', 'Ends at', 'datetime'), field('hours', 'Hours', 'number'), field('status', 'Status', 'select', ['planned', 'confirmed', 'completed', 'cancelled'])] },
  donations: { table: 'donations', title: 'Donation records', description: 'Record verified donations; never treat a browser submission as a payment.', columns: ['amount', 'currency_code', 'status', 'received_at'], fields: [referenceField('campaign_id', 'Campaign', 'donation_campaigns', ['title']), referenceField('donor_id', 'Donor', 'donors', ['full_name', 'organization_name']), field('amount', 'Amount', 'number', undefined, true), field('currency_code', 'Currency'), field('status', 'Status', 'select', ['pending', 'completed', 'failed', 'refunded', 'cancelled']), field('payment_provider', 'Provider'), field('provider_reference', 'Provider reference'), field('received_at', 'Received at', 'datetime'), field('notes', 'Notes', 'textarea')], canArchive: false },
  donors: { table: 'donors', title: 'Donors', description: 'Private donor contact records.', columns: ['full_name', 'organization_name', 'is_anonymous'], fields: [field('full_name', 'Name'), field('email', 'Email'), field('phone', 'Phone'), field('organization_name', 'Organization'), field('is_anonymous', 'Anonymous', 'boolean')], canArchive: false },
  contact_messages: { table: 'contact_messages', title: 'Contact inbox', description: 'Messages received from the public contact form.', columns: ['full_name', 'email', 'subject', 'status'], fields: [field('status', 'Status', 'select', ['new', 'in_progress', 'resolved', 'archived'])], canCreate: false, canArchive: false },
  secretariat_documents: { table: 'secretariat_documents', title: 'Documents & minutes', description: 'Create minutes, memos and internal reports; export as Word or print/save to PDF.', columns: ['title', 'document_type', 'meeting_date', 'status'], fields: [field('title', 'Title', 'text', undefined, true), field('document_type', 'Document type', 'select', ['note', 'meeting_minutes', 'memo', 'report']), field('meeting_date', 'Meeting date', 'date'), field('status', 'Status', 'select', ['draft', 'final']), field('body', 'Document notes', 'json')] },
  department_updates: { table: 'department_updates', title: 'Department updates', description: 'Submit a period update for management review.', columns: ['department', 'period_start', 'period_end', 'status'], fields: [field('department', 'Department', 'text', undefined, true), field('period_start', 'Period start', 'date', undefined, true), field('period_end', 'Period end', 'date', undefined, true), field('summary', 'Summary', 'textarea', undefined, true), field('progress', 'Progress notes (one per line)', 'json'), field('status', 'Status', 'select', ['draft', 'submitted', 'reviewed'])] },
  families: { table: 'families', title: 'Family records', description: 'Confidential family data. Access follows organization roles and database RLS.', columns: ['household_code', 'primary_contact_name', 'district', 'status'], fields: [field('household_code', 'Household code'), field('primary_contact_name', 'Primary contact', 'text', undefined, true), field('phone', 'Phone'), field('email', 'Email'), field('address', 'Address', 'textarea'), field('district', 'District'), field('sector', 'Sector'), field('household_size', 'Household size', 'number'), field('vulnerability_notes', 'Restricted notes', 'textarea'), field('status', 'Status', 'select', ['active', 'inactive', 'closed'])] },
  children: { table: 'children', title: 'Child records', description: 'Restricted and sensitive child information. Follow safeguarding policies.', columns: ['child_code', 'first_name', 'school_name', 'enrollment_status'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), field('child_code', 'Child code'), field('first_name', 'First name', 'text', undefined, true), field('last_name', 'Last name'), field('date_of_birth', 'Date of birth', 'date'), field('gender', 'Gender', 'select', ['female', 'male', 'other', 'undisclosed']), field('school_name', 'School'), field('grade_level', 'Grade'), field('enrollment_status', 'Enrollment', 'select', ['enrolled', 'not_enrolled', 'graduated', 'unknown']), field('safeguarding_notes', 'Safeguarding notes', 'textarea'), field('status', 'Status', 'select', ['active', 'inactive', 'closed'])] },
  case_records: { table: 'case_records', title: 'Case records', description: 'Restricted case-management records. Keep factual notes and minimum necessary details.', columns: ['title', 'priority', 'status', 'opened_at'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), referenceField('child_id', 'Child', 'children', ['first_name', 'last_name', 'child_code']), referenceField('program_id', 'Program', 'programs', ['name']), referenceField('project_id', 'Project', 'projects', ['title']), field('title', 'Case title', 'text', undefined, true), field('description', 'Description', 'textarea'), field('priority', 'Priority', 'select', ['low', 'normal', 'high', 'urgent']), field('status', 'Status', 'select', ['open', 'in_progress', 'on_hold', 'resolved', 'closed']), field('closed_at', 'Closed at', 'datetime')] },
  case_notes: { table: 'case_notes', title: 'Case notes', description: 'Internal notes; restricted notes are role-limited by RLS.', columns: ['case_id', 'visibility', 'created_at'], fields: [referenceField('case_id', 'Case', 'case_records', ['title'], true), field('note', 'Note', 'textarea', undefined, true), field('visibility', 'Visibility', 'select', ['internal', 'restricted'])], archiveLabel: 'Delete note' },
  assistance_records: { table: 'assistance_records', title: 'Assistance records', description: 'Record assistance actually provided; amounts are not donations.', columns: ['assistance_type', 'quantity', 'amount', 'provided_at'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), referenceField('child_id', 'Child', 'children', ['first_name', 'last_name', 'child_code']), referenceField('case_id', 'Case', 'case_records', ['title']), referenceField('program_id', 'Program', 'programs', ['name']), referenceField('project_id', 'Project', 'projects', ['title']), field('assistance_type', 'Assistance type', 'text', undefined, true), field('description', 'Description', 'textarea'), field('quantity', 'Quantity', 'number'), field('amount', 'Amount', 'number'), field('currency_code', 'Currency')], canArchive: false },
  audit_events: { table: 'audit_events', title: 'Audit history', description: 'Append-only record of database changes. Sensitive row values are not included.', columns: ['table_name', 'record_id', 'action', 'occurred_at'], fields: [], readOnly: true },
  email_notification_jobs: { table: 'email_notification_jobs', title: 'Notification delivery queue', description: 'Provider delivery state. Email sending requires a server-side provider configuration.', columns: ['notification_type', 'status', 'recipient_count', 'created_at'], fields: [], readOnly: true },
  website_page_views: { table: 'website_page_views', title: 'Website page views', description: 'Anonymous page-view records for basic traffic reporting.', columns: ['page_path', 'referrer_host', 'country_code', 'created_at'], fields: [], readOnly: true },
  grant_opportunities: { table: 'grant_opportunities', title: 'Grant opportunities', description: 'Track verified funding opportunities and application progress.', columns: ['title', 'funder_name', 'status', 'deadline'], fields: [field('title', 'Opportunity title', 'text', undefined, true), field('funder_name', 'Funder', 'text', undefined, true), field('status', 'Status', 'select', ['researching', 'planned', 'in_progress', 'submitted', 'awarded', 'declined', 'archived']), field('focus_area', 'Focus area'), field('amount', 'Potential amount', 'number'), field('currency_code', 'Currency'), field('deadline', 'Deadline', 'date'), field('application_url', 'Application URL'), field('notes', 'Notes', 'textarea')], archiveLabel: 'Archive opportunity' },
  staff_accounts: { table: 'staff_accounts', title: 'Staff accounts', description: 'Review the organization portal accounts and assigned team members.', columns: ['portal', 'account_email', 'role', 'team_members', 'password'], fields: [], readOnly: true, canCreate: false, canArchive: false },
};

const staffAccountDirectory = [
  { portal: 'Administration', account_email: 'admin@hos.org', role: 'admin', team_members: 'Ayamikani Rukundo Emmanuel; Tuyizer Salim' },
  { portal: 'Communications', account_email: 'communications@hos.org', role: 'communications', team_members: 'KEZA Praise; Ayamikani Rukundo Emmanuel; Tuyizer Salim' },
  { portal: 'Secretariat', account_email: 'secretariat@hos.org', role: 'secretariat', team_members: 'DOTTO DIDIER Nixon; Nadege Shima Ntwari' },
  { portal: 'Volunteer Management', account_email: 'volunteers@hos.org', role: 'volunteer_manager', team_members: 'Ines Iradukunda; Bonheur DUFITIMANA; Amahirwe Joyeuse' },
  { portal: 'Finance', account_email: 'finance@hos.org', role: 'finance', team_members: 'FORGIVENESS Peace Love' },
  { portal: 'Programs / Child Support', account_email: 'programs@hos.org', role: 'program_manager', team_members: 'Tesor RWOGERE; Babra Singana; Uwunkunda Pacifique; Isaro Michaella' },
  { portal: 'Case Worker', account_email: 'caseworker@hos.org', role: 'case_worker', team_members: 'Tesor RWOGERE; Babra Singana; Uwunkunda Pacifique; Isaro Michaella' },
  { portal: 'Fundraising / Grants', account_email: 'fundraising@hos.org', role: 'fundraiser', team_members: 'Benoit Ntwali Ngabo Teto; Habimana Kaela Naomi; Isingizwe Anita; Queen Merveille; Niyonsuti Don Joel' },
];

const portalConfig: Record<PortalKind, { icon: typeof LayoutDashboard; tables: AdminTable[]; heading: string; intro: string }> = {
  content: { icon: BookOpen, tables: ['staff_accounts', 'audit_events', 'organizations', 'website_sections', 'team_years', 'team_members', 'programs', 'projects', 'events', 'announcements', 'galleries', 'impact_metrics', 'success_stories', 'contact_details', 'social_links', 'contact_messages', 'newsletter_subscribers'], heading: 'Administration', intro: 'Admins review staff access and audit history. Communications staff manage approved public content and website enquiries.' },
  secretariat: { icon: FileText, tables: ['secretariat_documents', 'department_updates', 'volunteer_applications', 'volunteers', 'volunteer_assignments'], heading: 'Secretariat', intro: 'Manage official records or assigned volunteer coordination, based on your role.' },
  programs: { icon: HeartHandshake, tables: ['programs', 'projects', 'department_updates', 'families', 'children', 'case_records', 'case_notes', 'assistance_records'], heading: 'Programs / Child Support', intro: 'Program managers coordinate delivery; case workers access only the family and case records needed for their work.' },
  finance: { icon: CircleDollarSign, tables: ['donations'], heading: 'Finance', intro: 'Maintain verified donation records. Donor relationship management belongs to Fundraising.' },
  fundraising: { icon: HeartHandshake, tables: ['campaign_categories', 'donation_campaigns', 'donors', 'grant_opportunities'], heading: 'Fundraising / Grants', intro: 'Manage fundraising campaigns, donor relationships and grant opportunities. This workspace does not process payments.' },
};

const labels: Record<PortalKind, string> = {
  content: 'Administration',
  secretariat: 'Secretariat',
  programs: 'Programs / Child Support',
  finance: 'Finance',
  fundraising: 'Fundraising / Grants',
};

const readable = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

function localDateValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDateTimeValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function generatedRecordCode(prefix: string) {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 6).toUpperCase();
  return `${prefix}-${localDateValue().replaceAll('-', '')}-${suffix}`;
}

function parseStructuredField(key: string, text: string): unknown {
  if (!text) return ['content', 'body', 'progress'].includes(key) ? {} : [];
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      // Plain text remains the simple input format for these fields.
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (key === 'additional_images') {
    return lines.map((line) => {
      const [url, ...caption] = line.split('|').map((part) => part.trim());
      return caption.length ? { url, caption: caption.join(' | ') } : { url };
    });
  }
  if (key === 'suggested_amounts') {
    const amounts = lines.map(Number);
    if (amounts.some((amount) => !Number.isFinite(amount))) {
      throw new Error('Enter one valid number per line for suggested amounts.');
    }
    return amounts;
  }
  if (['skills', 'objectives', 'payment_methods'].includes(key)) return lines;
  if (key === 'content') {
    const entries = lines.map((line) => {
      const separator = line.indexOf(':');
      return separator < 1 ? null : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()] as const;
    });
    if (entries.every((entry): entry is readonly [string, string] => entry !== null)) {
      return Object.fromEntries(entries);
    }
    return { intro: text };
  }
  if (key === 'progress') return { notes: lines };
  return { text };
}

function formatStructuredField(key: string, value: unknown) {
  if (Array.isArray(value)) {
    if (key === 'additional_images') {
      return value.map((image) => {
        if (typeof image !== 'object' || image === null) return String(image);
        const item = image as Record<string, unknown>;
        return `${String(item.url ?? '')}${item.caption ? ` | ${String(item.caption)}` : ''}`;
      }).join('\n');
    }
    return value.map((item) => typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item)).join('\n');
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    if (key === 'body' && typeof (value as Record<string, unknown>).text === 'string') {
      return (value as Record<string, string>).text;
    }
    if (key === 'progress' && Array.isArray((value as Record<string, unknown>).notes)) {
      return ((value as { notes: unknown[] }).notes).map(String).join('\n');
    }
    return entries.map(([entryKey, entryValue]) => `${entryKey}: ${typeof entryValue === 'string' ? entryValue : JSON.stringify(entryValue)}`).join('\n');
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

export function WorkspacePage() {
  const { portal: routePortal } = useParams();
  const { user, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const available = getPortals(roles);
  const portal = routePortal
    ? available.find((availablePortal) => availablePortal === routePortal)
    : available[0];
  const [selection, setSelection] = useState<{ portal: PortalKind; table: AdminTable } | null>(null);
  const selectedTable = portal && selection?.portal === portal ? selection.table : null;
  const [activeView, setActiveView] = useState<'overview' | 'team' | 'admin'>('overview');
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const visibleTables = portal ? pageTablesForRole(portal, roles) : [];
  const isAdmin = canAccessRole(roles, ['admin']);
  const setSelectedTable = (table: AdminTable | null) => {
    if (portal) {
      setSelection(table ? { portal, table } : null);
    }
  };

  if (!portal) return <Navigate to={`/workspace/${available[0]}`} replace />;
  const page = portalConfig[portal];

  const handleSignOut = async () => {
    setSignOutError(null);
    try {
      await signOut();
      navigate('/portal', { replace: true });
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Unable to sign out.');
    }
  };

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <Link to="/" className="portal-brand"><img src="/hos-logo.png" alt="" /><span><span className="portal-brand-title">Heart of Sympathy</span><span className="portal-brand-caption">Staff workspace</span></span></Link>
        <div className="portal-kicker">Your workspace</div>
        <div className="portal-nav-link active"><LayoutDashboard /><span>{labels[portal]}</span></div>
        <div className="portal-kicker">Sections</div>
        <nav className="portal-nav" aria-label="Workspace sections">
          <button className={`portal-nav-link${selectedTable === null && activeView === 'overview' ? ' active' : ''}`} type="button" onClick={() => { setSelectedTable(null); setActiveView('overview'); }}><LayoutDashboard /><span>Overview</span></button>
          <button className={`portal-nav-link${selectedTable === null && activeView === 'team' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('team'); }}><Users /><span>Team</span></button>
          {portal === 'content' && isAdmin && <button className={`portal-nav-link${selectedTable === null && activeView === 'admin' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('admin'); }}><Shield /><span>Admin dashboard</span></button>}
        </nav>
        <div className="portal-sidebar-bottom">
          <div className="user-chip"><div className="user-avatar">{(user?.email?.[0] ?? 'U').toUpperCase()}</div><div className="user-identity"><div className="user-name">{typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : 'Signed in'}</div><div className="user-role">{roles.join(', ')}</div><div className="user-email">{user?.email}</div></div></div>
          <Link className="portal-nav-link" to="/"><ArrowLeft /><span>Public website</span></Link>
          <button type="button" className="portal-nav-link" onClick={() => void handleSignOut()}><LogOut /><span>Sign out</span></button>
          {signOutError && <p className="form-message error">{signOutError}</p>}
        </div>
      </aside>
      <main className="portal-main">
        <div className="portal-topbar">
          <div>
            {selectedTable && <button type="button" className="workspace-back-link" onClick={() => setSelectedTable(null)}><ArrowLeft size={14} /> All sections</button>}
            <div className="eyebrow">{labels[portal]}</div><h1>{selectedTable ? configs[selectedTable].title : activeView === 'team' ? 'Team' : activeView === 'admin' ? 'Admin dashboard' : page.heading}</h1><p>{selectedTable ? configs[selectedTable].description : activeView === 'team' ? 'People assigned to this portal and working together.' : activeView === 'admin' ? 'Review staff access and audit history.' : page.intro}</p>
          </div>
          {!selectedTable && <div className="portal-actions"><span className="pill"><Shield size={13} /> Role-protected</span></div>}
        </div>
        {selectedTable
          ? selectedTable === 'staff_accounts'
            ? <StaffAccountsWorkspace />
            : <RecordWorkspace key={selectedTable} config={getTableConfig(portal, selectedTable, roles)} />
          : activeView === 'team'
            ? <PortalTeam team={getPortalTeam(portal, roles)} />
            : activeView === 'admin'
              ? <PortalSummary portal={portal} tables={visibleTables} onSelect={setSelectedTable} />
            : <PortalOverview portal={portal} tables={visibleTables} onSelect={setSelectedTable} />}
      </main>
    </div>
  );
}

function PortalTeam({ team }: { team: ReturnType<typeof getPortalTeam> }) {
  if (!team) {
    return <section className="portal-team-empty"><p>No team roster is configured for this role yet.</p></section>;
  }
  return (
    <section className="portal-team" aria-labelledby="portal-team-heading">
      <div className="portal-team-heading"><Users size={20} /><div><h2 id="portal-team-heading">{team.label}</h2><p>{team.members.length} {team.members.length === 1 ? 'person' : 'people'} assigned to this portal</p></div></div>
      <ul className="portal-team-list">
        {team.members.map((member, index) => <li key={member}><span className="portal-team-number">{String(index + 1).padStart(2, '0')}</span><span>{member}</span></li>)}
      </ul>
    </section>
  );
}

function pageTablesForRole(portal: PortalKind, roles: string[]) {
  const allowedRoles: Partial<Record<AdminTable, OrganizationRole[]>> = {
    staff_accounts: ['admin'],
    audit_events: ['admin'],
    organizations: ['communications'],
    website_sections: ['communications'],
    team_years: ['communications'],
    team_members: ['communications'],
    programs: ['communications', 'program_manager'],
    projects: ['program_manager'],
    events: ['communications'],
    announcements: ['communications'],
    galleries: ['communications'],
    impact_metrics: ['communications'],
    success_stories: ['communications'],
    contact_details: ['communications'],
    social_links: ['communications'],
    contact_messages: ['communications'],
    newsletter_subscribers: ['communications'],
    secretariat_documents: ['secretariat'],
    department_updates: ['secretariat', 'program_manager'],
    volunteer_applications: ['volunteer_manager', 'hr'],
    volunteers: ['volunteer_manager', 'hr'],
    volunteer_assignments: ['volunteer_manager'],
    families: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    children: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    case_records: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    case_notes: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    assistance_records: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    donations: ['finance'],
    donors: ['fundraiser'],
    campaign_categories: ['fundraiser'],
    donation_campaigns: ['fundraiser'],
    grant_opportunities: ['fundraiser'],
  };
  return portalConfig[portal].tables.filter((table) => {
    const requiredRoles = allowedRoles[table];
    return Boolean(requiredRoles && canAccessRole(roles, requiredRoles));
  });
}

function getTableConfig(portal: PortalKind, table: AdminTable, roles: string[]): TableConfig {
  const writeRoles: Partial<Record<AdminTable, OrganizationRole[]>> = {
    organizations: ['communications'],
    website_sections: ['communications'],
    team_years: ['communications'],
    team_members: ['communications'],
    programs: ['communications'],
    projects: ['program_manager'],
    events: ['communications'],
    announcements: ['communications'],
    campaign_categories: ['fundraiser'],
    donation_campaigns: ['fundraiser'],
    galleries: ['communications'],
    contact_details: ['communications'],
    social_links: ['communications'],
    impact_metrics: ['communications'],
    success_stories: ['communications'],
    newsletter_subscribers: ['communications'],
    volunteer_applications: ['volunteer_manager', 'hr'],
    volunteers: ['volunteer_manager', 'hr'],
    volunteer_assignments: ['volunteer_manager'],
    donations: ['finance'],
    donors: ['fundraiser'],
    contact_messages: ['communications'],
    secretariat_documents: ['secretariat'],
    department_updates: ['program_manager', 'secretariat'],
    families: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    children: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    case_records: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    case_notes: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
    assistance_records: ['case_worker', 'child_protection', 'education_support', 'health_nutrition'],
  };
  const hasWriteAccess = Boolean(writeRoles[table] && canAccessRole(roles, writeRoles[table]));
  const readOnly = portal === 'content' && canAccessRole(roles, ['admin'])
    || table === 'staff_accounts'
    || table === 'audit_events'
    || !hasWriteAccess;
  return { ...configs[table], readOnly };
}

type AnalyticsPoint = { date: string; label: string; value: number };
type AnalyticsSlice = { label: string; value: number; color: string };

const communicationTables = [
  'organizations', 'website_sections', 'team_years', 'team_members', 'programs', 'events',
  'announcements', 'galleries', 'impact_metrics', 'success_stories',
  'contact_details', 'social_links',
];
const activityGroups: Array<{ label: string; color: string; tables: string[] }> = [
  { label: 'Communications', color: '#ffe353', tables: communicationTables },
  { label: 'Programs & child support', color: '#70c4a8', tables: ['projects', 'families', 'children', 'case_records', 'case_notes', 'assistance_records', 'department_updates'] },
  { label: 'Finance', color: '#91c9ce', tables: ['donations'] },
  { label: 'Fundraising', color: '#d99bff', tables: ['donors', 'campaign_categories', 'donation_campaigns', 'grant_opportunities'] },
  { label: 'Secretariat & volunteers', color: '#ff9d73', tables: ['secretariat_documents', 'volunteers', 'volunteer_assignments', 'volunteer_applications'] },
];
const analyticsAnchorTime = Date.now();

function AnalyticsDashboard() {
  const [pageViews, setPageViews] = useState<DataRow[]>([]);
  const [auditEvents, setAuditEvents] = useState<DataRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const analytics = await loadAdminAnalytics(30);
      setPageViews(analytics.pageViews);
      setAuditEvents(analytics.auditEvents);
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Analytics data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const dailySeries = useMemo(() => {
    const today = new Date(analyticsAnchorTime);
    today.setUTCHours(0, 0, 0, 0);
    const dates = Array.from({ length: 30 }, (_, index) => {
      const date = new Date(today);
      date.setUTCDate(today.getUTCDate() - (29 - index));
      const key = date.toISOString().slice(0, 10);
      return { date, key, label: date.toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }) };
    });
    const countByDay = (rows: DataRow[], key: string) => {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const value = row[key];
        if (typeof value !== 'string') continue;
        const dateKey = new Date(value).toISOString().slice(0, 10);
        counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
      }
      return dates.map(({ key: date, label }) => ({ date, label, value: counts.get(date) ?? 0 }));
    };
    return {
      visits: countByDay(pageViews, 'created_at'),
      changes: countByDay(auditEvents, 'occurred_at'),
      communicationChanges: countByDay(auditEvents.filter((row) => typeof row.table_name === 'string' && communicationTables.includes(row.table_name)), 'occurred_at'),
    };
  }, [auditEvents, pageViews]);

  const communicationBars = useMemo(() => communicationTables
    .map((table) => ({ label: configs[table as AdminTable]?.title ?? table.replaceAll('_', ' '), value: auditEvents.filter((row) => row.table_name === table).length }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 7), [auditEvents]);
  const teamSlices = useMemo<AnalyticsSlice[]>(() => activityGroups
    .map((group) => ({
      label: group.label,
      color: group.color,
      value: auditEvents.filter((row) => typeof row.table_name === 'string' && group.tables.includes(row.table_name)).length,
    }))
    .filter((group) => group.value > 0), [auditEvents]);
  const totalChanges = auditEvents.length;
  const communicationTotal = auditEvents.filter((row) => typeof row.table_name === 'string' && communicationTables.includes(row.table_name)).length;
  const topPages = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of pageViews) {
      if (typeof row.page_path === 'string') counts.set(row.page_path, (counts.get(row.page_path) ?? 0) + 1);
    }
    return [...counts].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [pageViews]);

  return (
    <section className="analytics-dashboard" aria-labelledby="analytics-heading">
      <div className="analytics-heading">
        <div><div className="eyebrow">Organization dashboard · Last 30 days</div><h2 id="analytics-heading">Activity at a glance</h2><p>Website traffic and recorded staff changes from Supabase audit logs.</p></div>
        <div className="analytics-refresh">{lastUpdated && <span>Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}<button type="button" className="button button-outline button-small" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> {loading ? 'Updating…' : 'Refresh'}</button></div>
      </div>
      {error && <div role="alert" className="form-message error">{error}</div>}
      <div className="analytics-kpis">
        <article className="analytics-kpi"><Eye size={18} /><span>Page views</span><strong>{loading ? '—' : pageViews.length.toLocaleString()}</strong><small>Recorded visits; not unique visitors</small></article>
        <article className="analytics-kpi"><Activity size={18} /><span>Staff changes</span><strong>{loading ? '—' : totalChanges.toLocaleString()}</strong><small>Audited inserts, updates and deletes</small></article>
        <article className="analytics-kpi"><BookOpen size={18} /><span>Communications</span><strong>{loading ? '—' : communicationTotal.toLocaleString()}</strong><small>Website/content records changed</small></article>
      </div>
      <div className="analytics-grid">
        <AnalyticsLineChart title="Website page views" description="Daily page loads recorded on public pages." points={dailySeries.visits} color="#ffe353" loading={loading} />
        <AnalyticsLineChart title="Communications work" description="Daily edits to published website and content records." points={dailySeries.communicationChanges} color="#70c4a8" loading={loading} />
        <AnalyticsBarChart title="Communications activity" description="Content areas with recorded changes in the last 30 days." items={communicationBars} loading={loading} />
        <AnalyticsDonutChart title="Recorded work by team" description="Based on which audited data areas were changed; categories follow portal responsibilities." slices={teamSlices} loading={loading} />
        <div className="analytics-card analytics-card-wide">
          <div className="analytics-card-heading"><div><h3>Recent staff activity</h3><p>All teams · audited record changes per day</p></div><span className="analytics-card-icon"><Activity size={16} /></span></div>
          <AnalyticsLineChart title="" description="" points={dailySeries.changes} color="#d99bff" loading={loading} compact />
        </div>
        <div className="analytics-card">
          <div className="analytics-card-heading"><div><h3>Most visited pages</h3><p>Public-site views, last 30 days</p></div><span className="analytics-card-icon"><Eye size={16} /></span></div>
          {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={15} /> Loading page views…</div> : topPages.length ? <div className="analytics-page-list">{topPages.map((page) => <div key={page.label}><span>{page.label}</span><strong>{page.value.toLocaleString()}</strong></div>)}</div> : <p className="analytics-empty">No page views have been recorded in this period.</p>}
        </div>
      </div>
      <p className="analytics-footnote">These charts report only events stored in the database. Page views are not deduplicated into unique people; staff activity is limited to tables with audit triggers. This dashboard does not track staff productivity or private visitor identities.</p>
    </section>
  );
}

function AnalyticsLineChart({ title, description, points, color, loading, compact = false }: { title: string; description: string; points: AnalyticsPoint[]; color: string; loading: boolean; compact?: boolean }) {
  const width = 620;
  const height = 190;
  const padX = 12;
  const padY = 16;
  const max = Math.max(1, ...points.map((point) => point.value));
  const plotted = points.map((point, index) => ({
    ...point,
    x: padX + index * (width - padX * 2) / Math.max(points.length - 1, 1),
    y: height - padY - point.value / max * (height - padY * 2),
  }));
  const path = plotted.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
  const total = points.reduce((sum, point) => sum + point.value, 0);
  return (
    <div className={`analytics-card${compact ? ' analytics-card-chart-only' : ''}`}>
      {!compact && <div className="analytics-card-heading"><div><h3>{title}</h3><p>{description}</p></div><strong className="analytics-total">{loading ? '—' : total.toLocaleString()}</strong></div>}
      {loading ? <div className="analytics-chart-loading"><span className="loading-dot" /> Loading chart…</div> : points.length ? <>
        <svg className="analytics-line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title || 'Activity'} over the last 30 days; ${total} total`}>
          {[0, 1, 2, 3].map((line) => <line key={line} x1={padX} x2={width - padX} y1={padY + line * (height - padY * 2) / 3} y2={padY + line * (height - padY * 2) / 3} className="analytics-gridline" />)}
          <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          {plotted.map((point) => point.value > 0 && <circle key={point.date} cx={point.x} cy={point.y} r="3" fill={color}><title>{point.label}: {point.value}</title></circle>)}
        </svg>
        <div className="analytics-axis-labels"><span>{points[0]?.label}</span><span>{points[Math.floor(points.length / 2)]?.label}</span><span>{points.at(-1)?.label}</span></div>
      </> : <p className="analytics-empty">No tracked activity in this period.</p>}
    </div>
  );
}

function AnalyticsBarChart({ title, description, items, loading }: { title: string; description: string; items: Array<{ label: string; value: number }>; loading: boolean }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="analytics-card">
      <div className="analytics-card-heading"><div><h3>{title}</h3><p>{description}</p></div><span className="analytics-card-icon"><Activity size={16} /></span></div>
      {loading ? <div className="analytics-chart-loading"><span className="loading-dot" /> Loading chart…</div> : items.length ? <div className="analytics-bars">{items.map((item) => <div className="analytics-bar-row" key={item.label}><span title={item.label}>{item.label}</span><div><i style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></div><strong>{item.value}</strong></div>)}</div> : <p className="analytics-empty">No communications changes were audited in this period.</p>}
    </div>
  );
}

function AnalyticsDonutChart({ title, description, slices, loading }: { title: string; description: string; slices: AnalyticsSlice[]; loading: boolean }) {
  const circumference = 2 * Math.PI * 45;
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  return (
    <div className="analytics-card">
      <div className="analytics-card-heading"><div><h3>{title}</h3><p>{description}</p></div><span className="analytics-card-icon"><Activity size={16} /></span></div>
      {loading ? <div className="analytics-chart-loading"><span className="loading-dot" /> Loading chart…</div> : total ? <div className="analytics-donut-layout">
        <svg className="analytics-donut" viewBox="0 0 120 120" role="img" aria-label={`${total} tracked changes by team`}>
          <circle cx="60" cy="60" r="45" fill="none" stroke="var(--line)" strokeWidth="16" />
          {slices.map((slice, index) => {
            const length = slice.value / total * circumference;
            const currentOffset = slices.slice(0, index).reduce((sum, previous) => sum + previous.value / total * circumference, 0);
            return <circle key={slice.label} cx="60" cy="60" r="45" fill="none" stroke={slice.color} strokeWidth="16" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-currentOffset} transform="rotate(-90 60 60)"><title>{slice.label}: {slice.value}</title></circle>;
          })}
          <text x="60" y="58" textAnchor="middle" className="analytics-donut-number">{total}</text>
          <text x="60" y="72" textAnchor="middle" className="analytics-donut-label">changes</text>
        </svg>
        <div className="analytics-legend">{slices.map((slice) => <div key={slice.label}><i style={{ background: slice.color }} /><span>{slice.label}</span><strong>{slice.value}</strong></div>)}</div>
      </div> : <p className="analytics-empty">No audited work to categorize in this period.</p>}
    </div>
  );
}

function PortalOverview({ portal, tables, onSelect }: { portal: PortalKind; tables: AdminTable[]; onSelect: (table: AdminTable) => void }) {
  const { roles } = useAuth();

  return (
    <>
      {portal === 'content' && canAccessRole(roles, ['admin']) && <AnalyticsDashboard />}
      {!canAccessRole(roles, ['admin']) && <PortalSummary portal={portal} tables={tables} onSelect={onSelect} />}
      <div className="panel portal-overview-note"><div className="panel-heading"><h2>Workspaces available to your roles</h2></div><p className="field-hint">Only the sections assigned to your verified account are shown. If a data area is not available, request access from an administrator.</p><div className="filter-row">{roles.map((role) => <span className="pill" key={role}>{role}</span>)}</div></div>
    </>
  );
}

function PortalSummary({ portal, tables, onSelect }: { portal: PortalKind; tables: AdminTable[]; onSelect: (table: AdminTable) => void }) {
  const { user, roles } = useAuth();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const Icon = portalConfig[portal].icon;
  const displayName = typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : 'team member';

  useEffect(() => {
    let active = true;
    void Promise.all(tables.map(async (table): Promise<{ table: AdminTable; count: string | null; error: string | null }> => {
      if (table === 'staff_accounts') return { table, count: String(staffAccountDirectory.length), error: null };
      try {
        const rows = await listAdminRows(table);
        return { table, count: rows.length === 250 ? '250+' : String(rows.length), error: null };
      } catch (error) {
        return { table, count: null, error: error instanceof Error ? error.message : 'Access denied or unavailable.' };
      }
    })).then((results) => {
      if (!active) return;
      const failed = results.filter((result) => result.count === null).map((result) => `${configs[result.table].title}: ${result.error}`);
      const availableCounts: Record<string, string> = {};
      results.forEach(({ table, count }) => {
        if (count !== null) availableCounts[table] = count;
      });
      setCounts(availableCounts);
      if (failed.length) setMessage(`Some summaries are unavailable due to database permissions or setup: ${failed.join('; ')}.`);
    });
    return () => { active = false; };
  }, [tables]);

  return (
    <>
      <div className="portal-welcome-line"><Icon size={17} /><span>Welcome, {displayName}. Choose a section to continue.</span><span className="portal-role-note">{roles.map((role) => role.replaceAll('_', ' ')).join(' · ')}</span></div>
      {message && <div role="status" className="form-message">{message}</div>}
      <div className="portal-overview">
        {tables.map((table) => <button className="metric-card portal-summary-card" type="button" onClick={() => onSelect(table)} key={table}><div className="metric-number">{counts[table] ?? '—'}</div><div className="metric-label">{configs[table].title}</div><ArrowRight size={15} /></button>)}
      </div>
    </>
  );
}

function StaffAccountsWorkspace() {
  return (
    <section className="panel record-panel">
      <div className="table-wrap">
        <table className="data-table">
          <thead><tr><th>Portal</th><th>Account email</th><th>Role</th><th>Team members</th></tr></thead>
          <tbody>
            {staffAccountDirectory.map((account) => (
              <tr key={account.account_email}>
                <td data-label="Portal">{account.portal}</td>
                <td data-label="Account email">{account.account_email}</td>
                <td data-label="Role">{account.role}</td>
                <td data-label="Team members">{account.team_members}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RecordWorkspace({ config }: { config: TableConfig }) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<DataRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [page, setPage] = useState(0);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyingEmails, setCopyingEmails] = useState(false);
  const { user } = useAuth();
  const pageSize = 12;
  const canEdit = !config.readOnly;

  const refresh = useCallback(async (term: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminRows(config.table, term);
      setRows(result);
      setPage(0);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : `Unable to load ${config.title.toLowerCase()}.`);
    } finally {
      setLoading(false);
    }
  }, [config.table, config.title]);
  useEffect(() => {
    void listAdminRows(config.table)
      .then(setRows)
      .catch((loadError: unknown) => setError(loadError instanceof Error ? loadError.message : `Unable to load ${config.title.toLowerCase()}.`))
      .finally(() => setLoading(false));
  }, [config.table, config.title]);
  const visibleRows = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [page, rows]);

  const startNew = () => {
    const initial: DataRow = {};
    for (const item of config.fields) {
      if (item.kind === 'boolean') initial[item.key] = false;
      else if (item.kind === 'json') initial[item.key] = ['content', 'body', 'progress'].includes(item.key) ? {} : [];
      else if (item.kind === 'date') initial[item.key] = item.key === 'date_of_birth' ? '' : localDateValue();
      else if (item.kind === 'datetime') initial[item.key] = localDateTimeValue();
      else if (item.kind === 'select' && item.options?.length) initial[item.key] = item.options[0];
      else initial[item.key] = '';
    }
    if (config.table === 'families') initial.household_code = generatedRecordCode('FAM');
    if (config.table === 'children') initial.child_code = generatedRecordCode('CH');
    setEditing(initial);
    setIsNew(true);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const values: DataRow = {};
      for (const item of config.fields) {
        const raw = formData.get(item.key);
        if (item.required && String(raw ?? '').trim() === '') {
          throw new Error(`${item.label} is required.`);
        }
        if (item.kind === 'boolean') values[item.key] = raw === 'on';
        else if (item.kind === 'number') values[item.key] = String(raw ?? '').trim() === '' ? null : Number(raw);
        else if (item.kind === 'image-list') {
          let assets: Array<{ url: string; caption: string }>;
          try {
            const parsed: unknown = JSON.parse(String(raw ?? '[]'));
            if (!Array.isArray(parsed)) throw new Error('Choose at least one image.');
            assets = parsed.filter((asset): asset is { url: string; caption: string } =>
              typeof asset === 'object' && asset !== null &&
              typeof (asset as { url?: unknown }).url === 'string' &&
              typeof (asset as { caption?: unknown }).caption === 'string',
            );
          } catch (parseError) {
            throw new Error(parseError instanceof Error ? parseError.message : `${item.label} must contain valid images.`);
          }
          if (!assets.length || assets.some((asset) => !asset.url.trim())) throw new Error('Add at least one image to this post.');
          values[item.key] = assets;
          if (config.table === 'galleries') values.image_url = assets[0].url;
        }
        else if (item.kind === 'json') {
          values[item.key] = parseStructuredField(item.key, String(raw ?? '').trim());
        } else {
          const text = String(raw ?? '').trim();
          values[item.key] = text || null;
        }
      }
      if (isNew && config.table === 'department_updates' && user?.id) values.submitted_by = user.id;
      if (config.table === 'secretariat_documents' && user?.id) {
        values[isNew ? 'created_by' : 'updated_by'] = user.id;
      }
      if (isNew && config.table === 'families' && user?.id) values.created_by = user.id;
      if (isNew && config.table === 'case_notes' && user?.id) values.created_by = user.id;
      if (isNew && config.table === 'assistance_records' && user?.id) values.provided_by = user.id;
      if (isNew && config.table === 'donations' && user?.id) values.recorded_by = user.id;
      const recordId = typeof editing.id === 'string' ? editing.id : undefined;
      await saveAdminRow(config.table, values, recordId);
      setEditing(null);
      await refresh(search);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this record.');
    } finally {
      setBusy(false);
    }
  };

  const archive = async (row: DataRow) => {
    const recordId = typeof row.id === 'string' ? row.id : '';
    if (!recordId) {
      setError('This record cannot be removed because it has no database ID.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await archiveAdminRow(config.table, row);
      setConfirmingId(null);
      await refresh(search);
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : 'Could not archive this record.');
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    setError(null);
    try {
      const escapeCsv = (value: unknown) => `"${readable(value).replaceAll('"', '""')}"`;
      const lines = [
        config.columns.map((column) => escapeCsv(column.replaceAll('_', ' '))).join(','),
        ...rows.map((row) => config.columns.map((column) => escapeCsv(row[column])).join(',')),
      ];
      downloadBlob(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${safeName(config.title)}.csv`);
    } catch (exportError) {
      setError(exportError instanceof Error ? `Export failed: ${exportError.message}` : 'Export failed.');
    }
  };

  const exportDocument = async (row: DataRow) => {
    try {
      const { Document, Packer, Paragraph, TextRun } = await import('docx');
      const text = config.table === 'secretariat_documents'
        ? Object.entries(row.body && typeof row.body === 'object' ? row.body as Record<string, unknown> : {}).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${readable(value)}`).join('\n\n')
        : JSON.stringify(row, null, 2);
      const document = new Document({ sections: [{ children: [
        new Paragraph({ children: [new TextRun({ text: String(row.title ?? config.title), bold: true, size: 32 })] }),
        new Paragraph({ text: `Heart of Sympathy · ${new Date().toLocaleDateString()}` }),
        ...text.split(/\n{1,}/).map((line) => new Paragraph({ text: line })),
      ] }] });
      downloadBlob(await Packer.toBlob(document), `${safeName(String(row.title ?? config.title))}.docx`);
    } catch (exportError) {
      setError(exportError instanceof Error ? `Document export failed: ${exportError.message}` : 'Document export failed.');
    }
  };

  const printDocument = (row: DataRow) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('The print window was blocked. Allow pop-ups for this site and try again.');
      return;
    }
    const docBody = row.body && typeof row.body === 'object' ? row.body as Record<string, unknown> : {};
    const content = Object.entries(docBody).map(([key, value]) => `${key.replaceAll('_', ' ')}: ${readable(value)}`).join('\n\n');
    const heading = printWindow.document.createElement('h1');
    heading.textContent = String(row.title ?? config.title);
    const subtitle = printWindow.document.createElement('p');
    subtitle.textContent = `Heart of Sympathy · ${new Date().toLocaleDateString()}`;
    const body = printWindow.document.createElement('main');
    for (const paragraphText of content.split(/\n{1,}/)) {
      const paragraph = printWindow.document.createElement('p');
      paragraph.textContent = paragraphText;
      body.append(paragraph);
    }
    const style = printWindow.document.createElement('style');
    style.textContent = 'body{max-width:760px;margin:48px auto;padding:0 24px;color:#1b2821;font:16px/1.65 Cambria,Georgia,serif}h1{font:32px/1.1 Georgia,serif}p{white-space:pre-wrap}@media print{body{margin:0 auto}}';
    printWindow.document.head.append(style);
    printWindow.document.title = safeName(String(row.title ?? config.title));
    printWindow.document.body.append(heading, subtitle, body);
    printWindow.focus();
    printWindow.print();
  };

  const filterRows = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await refresh(search);
  };

  const copySubscriberEmails = async () => {
    setCopyingEmails(true);
    setCopyMessage(null);
    try {
      const emails: string[] = [];
      try {
        const pageSize = 1000;
        const client = getSupabaseClient();
        for (let offset = 0; ; offset += pageSize) {
          const { data, error: queryError } = await client
            .from('newsletter_subscribers')
            .select('email')
            .eq('is_confirmed', true)
            .is('unsubscribed_at', null)
            .order('email')
            .range(offset, offset + pageSize - 1);
          if (queryError) throw queryError;
          const batch = (data ?? []).map((row) => row.email.trim()).filter(Boolean);
          emails.push(...batch);
          if (batch.length < pageSize) break;
        }
      } catch (queryError) {
        setCopyMessage(queryError instanceof Error ? `Could not load active subscriber emails: ${queryError.message}` : 'Could not load active subscriber emails.');
        return;
      }
      if (!emails.length) {
        setCopyMessage('No confirmed, active subscriber emails were found.');
        return;
      }
      if (!navigator.clipboard?.writeText) {
        setCopyMessage('Clipboard access is unavailable in this browser. Use a secure browser connection and try again.');
        return;
      }
      await navigator.clipboard.writeText(emails.join('; '));
      setCopyMessage(`${emails.length} active email${emails.length === 1 ? '' : 's'} copied. Paste them into BCC to protect subscriber privacy.`);
    } catch (copyError) {
      setCopyMessage(copyError instanceof Error ? `Could not copy subscriber emails: ${copyError.message}` : 'Could not copy subscriber emails.');
    } finally {
      setCopyingEmails(false);
    }
  };

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  return (
    <section className="panel record-panel">
      <div className="toolbar">
        <form className="toolbar-left" onSubmit={(event) => void filterRows(event)}><div className="search-field"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search these records" aria-label="Search records" /></div><button type="submit" className="button button-outline button-small">Search</button></form>
        <div className="toolbar-right">{config.table === 'newsletter_subscribers' && <button type="button" className="button button-outline button-small" onClick={() => void copySubscriberEmails()} disabled={loading || copyingEmails}><ClipboardCopy size={14} /> {copyingEmails ? 'Copying…' : 'Copy active emails'}</button>}<button type="button" className="button button-outline button-small" onClick={() => void exportExcel()} disabled={loading || rows.length === 0}><ArrowDownToLine size={14} /> CSV / Excel</button>{canEdit && !config.readOnly && config.canCreate !== false && <button type="button" className="button button-primary button-small" onClick={startNew}><Plus size={14} /> Add record</button>}</div>
      </div>
      {copyMessage && <div role={copyMessage.startsWith('Could not') || copyMessage.startsWith('Clipboard') ? 'alert' : 'status'} className={`form-message subscriber-copy-message${copyMessage.startsWith('Could not') || copyMessage.startsWith('Clipboard') ? ' error' : ''}`}>{copyMessage}</div>}
      {rows.length === 250 && <p className="field-hint">The table loads at most 250 records at a time. Use search to find other records or narrow an export.</p>}
      {error && <div role="alert" className="form-message error">{error}</div>}
      {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading records…</div> : rows.length === 0 ? <div className="empty-state">No records are available in this area. Add the first record or adjust your search.</div> : (
        <div className="table-wrap">
          <table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{!config.readOnly && <th>Actions</th>}</tr></thead><tbody>
            {visibleRows.map((row, index) => {
              const rowId = String(row.id ?? index);
              const removeLabel = config.archiveLabel ?? 'Archive record';
              return (
                <tr key={rowId}>
                  {config.columns.map((column) => <td className="truncate" key={column} data-label={column.replaceAll('_', ' ')} title={readable(row[column])}>{readable(row[column])}</td>)}
                  {!config.readOnly && <td data-label="Actions">
                    <div className="row-actions">
                      {config.table === 'secretariat_documents' && <>
                        <button className="icon-button" type="button" onClick={() => void exportDocument(row)} aria-label="Download Word document" title="Download Word document"><ArrowDownToLine size={14} /></button>
                        <button className="icon-button" type="button" onClick={() => printDocument(row)} aria-label="Print or save as PDF" title="Print or save as PDF"><FileDown size={14} /></button>
                      </>}
                      {canEdit && <button className="icon-button" type="button" onClick={() => { setEditing(row); setIsNew(false); }} aria-label="Edit record" title="Edit record"><Pencil size={14} /></button>}
                      {canEdit && config.canArchive !== false && <button className="icon-button" type="button" onClick={() => setConfirmingId(confirmingId === rowId ? null : rowId)} disabled={busy} aria-label={removeLabel} title={removeLabel}><Trash2 size={14} /></button>}
                    </div>
                    {confirmingId === rowId && <div className="row-confirmation" role="group" aria-label={`Confirm ${removeLabel.toLowerCase()}`}>
                      <span>{removeLabel} this record?</span>
                      <button type="button" className="button button-danger button-small" disabled={busy} onClick={() => void archive(row)}>{busy ? 'Working…' : 'Confirm'}</button>
                      <button type="button" className="button button-outline button-small" disabled={busy} onClick={() => setConfirmingId(null)}>Cancel</button>
                    </div>}
                  </td>}
                </tr>
              );
            })}
          </tbody></table>
        </div>
      )}
      {!loading && rows.length > pageSize && <div className="pagination"><span className="field-hint">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span><div className="row-actions"><button className="button button-outline button-small" type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button button-outline button-small" type="button" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(null); }}><div className="modal record-modal" role="dialog" aria-modal="true" aria-labelledby="record-editor-title"><div className="modal-header"><div><div className="eyebrow">{isNew ? 'Create record' : 'Update record'}</div><h2 id="record-editor-title">{config.title}</h2></div><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Close form"><X size={17} /></button></div><form className="modal-body" onSubmit={(event) => void save(event)}>{['events', 'announcements'].includes(config.table) && <div className="notice"><Shield size={16} /><span>Subscriber email notifications are not configured. Publishing a record will not send email.</span></div>}<div className="form-grid">{config.fields.map((item) => <FieldEditor key={item.key} field={item} value={getEditorFieldValue(editing, item)} folder={safeName(config.table)} isNew={isNew} />)}</div>{error && <div role="alert" className="form-message error">{error}</div>}<div className="record-form-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create record' : 'Save changes'} <Check size={14} /></button></div></form></div></div>}
    </section>
  );
}

function getEditorFieldValue(record: DataRow, item: Field) {
  const value = record[item.key];
  if (item.kind === 'image-list' && typeof record.image_url === 'string' && record.image_url.trim() && (!Array.isArray(value) || value.length === 0)) {
    return [{ url: record.image_url, caption: '' }];
  }
  return value;
}

function FieldEditor({ field: item, value, folder, isNew }: { field: Field; value: unknown; folder: string; isNew: boolean }) {
  const [imageUrl, setImageUrl] = useState(typeof value === 'string' ? value : '');
  const [imageList, setImageList] = useState<Array<{ url: string; caption: string }>>(
    Array.isArray(value)
      ? value.flatMap((asset) => {
          if (typeof asset !== 'object' || asset === null || !('url' in asset) || typeof asset.url !== 'string') return [];
          return [{ url: asset.url, caption: 'caption' in asset && typeof asset.caption === 'string' ? asset.caption : '' }];
        })
      : [],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const valueForField = item.kind === 'json'
    ? formatStructuredField(item.key, value ?? (item.key === 'content' || item.key === 'body' || item.key === 'progress' ? {} : []))
    : item.kind === 'tags' && Array.isArray(value) ? value.join(', ')
      : item.kind === 'date' ? typeof value === 'string' && value ? value.slice(0, 10) : isNew && item.key !== 'date_of_birth' ? localDateValue() : ''
        : item.kind === 'datetime' ? typeof value === 'string' && value ? value.slice(0, 16) : isNew ? localDateTimeValue() : ''
          : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (item.kind === 'image-list') {
    const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      if (!files.length) return;
      setUploading(true);
      setUploadError(null);
      try {
        const uploaded = await Promise.all(files.map(async (file) => ({ url: await uploadPublicImage(file, folder), caption: '' })));
        setImageList((current) => [...current, ...uploaded]);
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'One or more images could not be uploaded.');
      } finally {
        setUploading(false);
      }
    };
    return (
      <div className="field field-span">
        <span className="field-label">{item.label} *</span>
        <input type="hidden" name={item.key} value={JSON.stringify(imageList)} />
        <label className="image-upload-button">
          <ImageUp size={16} /> {uploading ? 'Uploading images…' : 'Add image(s) — select one or several'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => void handleFiles(event)} disabled={uploading} />
        </label>
        <span className="field-hint">JPEG, PNG, WebP or AVIF; up to 5 MB each. Uploaded originals are retained without cropping.</span>
        {imageList.length > 0 && <div className="gallery-upload-list">{imageList.map((asset, index) => (
          <div className="gallery-upload-item" key={`${asset.url}-${index}`}>
            <img className="upload-preview" src={asset.url} alt={`Gallery image ${index + 1} preview`} />
            <label className="field"><span className="field-label">Image {index + 1} caption</span><input className="input" value={asset.caption} onChange={(event) => setImageList((current) => current.map((currentAsset, assetIndex) => assetIndex === index ? { ...currentAsset, caption: event.target.value } : currentAsset))} /></label>
            <button type="button" className="button button-outline button-small" onClick={() => setImageList((current) => current.filter((_, assetIndex) => assetIndex !== index))} aria-label={`Remove image ${index + 1}`}>Remove</button>
          </div>
        ))}</div>}
        {uploadError && <span role="alert" className="form-message error">{uploadError}</span>}
      </div>
    );
  }
  if (item.kind === 'image') {
    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        setImageUrl(await uploadPublicImage(file, folder));
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : 'Image upload failed.');
      } finally {
        setUploading(false);
      }
    };
    return (
      <div className="field field-span">
        <span className="field-label">{item.label}{item.required && ' *'}</span>
        <input type="hidden" name={item.key} value={imageUrl} required={item.required} />
        <label className="image-upload-button">
          <ImageUp size={16} /> {uploading ? 'Uploading image…' : 'Choose image (JPEG, PNG, WebP or AVIF, up to 5 MB)'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void handleFile(event)} disabled={uploading} />
        </label>
        <label className="field"><span className="field-label">Or enter an existing image URL</span><input className="input" type="url" name={`${item.key}_manual`} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></label>
        {imageUrl && <img className="upload-preview" src={imageUrl} alt="Selected image preview" />}
        {uploadError && <span role="alert" className="form-message error">{uploadError}</span>}
      </div>
    );
  }
  if (item.kind === 'reference' && item.referenceTable) {
    return <ReferenceFieldEditor field={item} value={value} />;
  }
  const helperText: Record<string, string> = {
    content: 'Enter one section per line, for example: intro: Our community supports every child.',
    additional_images: 'Enter one image URL per line. Add | and a caption after the URL if needed.',
    objectives: 'Enter one objective per line.',
    suggested_amounts: 'Enter one suggested amount per line.',
    payment_methods: 'Enter one giving method per line.',
    skills: 'Enter one skill per line.',
    body: 'Write the document notes in plain text.',
    progress: 'Enter progress notes, one per line.',
  };
  return (
    <label className={`field${item.kind === 'textarea' || item.kind === 'json' ? ' field-span' : ''}`}>
      <span className="field-label">{item.label}{item.required && ' *'}</span>
      {item.kind === 'boolean' ? <span className="checkbox-field"><input type="checkbox" name={item.key} defaultChecked={Boolean(value)} /> Yes / enabled</span>
        : item.kind === 'select' ? <select className="select" name={item.key} defaultValue={String(value ?? item.options?.[0] ?? '')}>{item.options?.map((option) => <option value={option} key={option}>{option.replaceAll('_', ' ')}</option>)}</select>
          : item.kind === 'textarea' || item.kind === 'json' ? <textarea className="textarea" name={item.key} required={item.required} rows={item.kind === 'json' ? 5 : 5} defaultValue={valueForField} placeholder={item.placeholder ?? (item.kind === 'json' ? 'Enter each item on a new line' : undefined)} />
            : <input className="input" name={item.key} type={item.kind === 'date' ? 'date' : item.kind === 'datetime' ? 'datetime-local' : item.kind === 'number' ? 'number' : 'text'} step={item.kind === 'number' ? 'any' : undefined} required={item.required} defaultValue={valueForField} placeholder={item.placeholder} /> }
      {item.kind === 'json' && helperText[item.key] && <span className="field-hint">{helperText[item.key]}</span>}
    </label>
  );
}

function ReferenceFieldEditor({ field: item, value }: { field: Field; value: unknown }) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(typeof value === 'string' ? value : '');
  useEffect(() => {
    let active = true;
    if (!item.referenceTable) return () => { active = false; };
    void listAdminRows(item.referenceTable)
      .then((result) => { if (active) setRows(result); })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : `Unable to load ${item.label.toLowerCase()} choices.`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.label, item.referenceTable]);
  const selectedExists = rows.some((row) => row.id === selectedId);
  return (
    <label className="field">
      <span className="field-label">{item.label}{item.required && ' *'}</span>
      <select className="select" name={item.key} required={item.required} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">{loading ? 'Loading choices…' : `Choose ${item.label.toLowerCase()}`}</option>
        {selectedId && !selectedExists && <option value={selectedId}>Keep existing linked record</option>}
        {rows.map((row) => {
          const id = typeof row.id === 'string' ? row.id : '';
          const label = (item.referenceLabel ?? []).map((key) => row[key]).filter((part) => typeof part === 'string' && part.trim()).join(' · ');
          return <option value={id} key={id}>{label || 'Unnamed record'}</option>;
        })}
      </select>
      {error && <span role="alert" className="field-hint form-error-text">{error}</span>}
      {!loading && !error && rows.length === 0 && <span className="field-hint">No available records to link yet. Create the related record first.</span>}
    </label>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeName(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'hos-export';
}
