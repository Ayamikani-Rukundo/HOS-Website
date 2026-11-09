import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
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
  FileUp,
  HeartHandshake,
  Eye,
  EyeOff,
  ImageUp,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Mail,
  MailOpen,
  Megaphone,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Sun,
  Trash2,
  Users,
  X,
  Moon,
} from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import { canAccessRole, getPortalTeam, getPortals, type OrganizationRole, type PortalKind } from '../lib/authorization';
import { getSupabaseClient } from '../lib/supabase';
import { useTheme } from '../lib/theme-context';
import { StudentSupportWorkspace } from './StudentSupportWorkspace';
import { SecretariatDocumentsWorkspace } from './SecretariatDocumentsWorkspace';
import {
  deleteAdminRow,
  loadAdminAnalytics,
  listAdminRows,
  saveAdminRow,
  listStaffAccounts,
  updateStaffAccount,
  uploadPublicImage,
  type AdminTable,
  type DataRow,
  type StaffAccount,
} from '../lib/admin-api';

type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'boolean' | 'select' | 'json' | 'tags' | 'image' | 'image-list' | 'document' | 'private-file' | 'reference';
type Field = { key: string; label: string; kind?: FieldKind; required?: boolean; options?: string[]; placeholder?: string; referenceTable?: AdminTable; referenceLabel?: string[] };
type DocumentAttachment = { path: string; name: string; size: number; type: string };
type TableConfig = {
  table: AdminTable;
  title: string;
  description: string;
  columns: string[];
  fields: Field[];
  readOnly?: boolean;
  canCreate?: boolean;
  canDelete?: boolean;
  deleteLabel?: string;
  createLabel?: string;
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
  organizations: { table: 'organizations', title: 'Organization profile', description: 'Public identity and official contact details.', columns: ['name', 'tagline', 'location', 'email'], fields: [field('name', 'Name', 'text', undefined, true), field('tagline'), field('location'), field('founded_year'), field('mission', 'Mission', 'textarea'), field('email'), field('phone'), field('address', 'Address', 'textarea'), field('currency_code')], canCreate: false, canDelete: false },
  website_sections: { table: 'website_sections', title: 'Website sections', description: 'Titles and structured content for public pages. Saving changes publishes them immediately.', columns: ['section_key', 'title'], fields: [field('section_key', 'Section key', 'text', undefined, true), field('title', 'Title', 'text', undefined, true), field('content', 'Page content', 'json')] },
  team_years: { table: 'team_years', title: 'Team years', description: 'Annual team rosters. Saving publishes the roster immediately.', columns: ['year_label'], fields: [field('year_label', 'Year', 'text', undefined, true), field('sort_order', 'Display order', 'number')] },
  team_members: { table: 'team_members', title: 'Team members', description: 'Staff and leadership biographies. Saving publishes the profile immediately.', columns: ['full_name', 'role_title'], fields: [referenceField('team_year_id', 'Team year', 'team_years', ['year_label'], true), field('full_name', 'Full name', 'text', undefined, true), field('role_title', 'Role title'), field('focus_area'), field('biography', 'Biography', 'textarea'), field('email'), field('avatar_url', 'Profile image', 'image'), field('sort_order', 'Display order', 'number')] },
  programs: { table: 'programs', title: 'Programs', description: 'Public program information and summaries. Saving publishes the program immediately.', columns: ['name', 'slug'], fields: [field('slug', 'URL slug', 'text', undefined, true), field('name', 'Name', 'text', undefined, true), field('summary', 'Summary', 'textarea', undefined, true), field('description', 'Description', 'textarea'), field('impact', 'Focus / impact', 'textarea'), field('feature_label'), field('cover_image_url', 'Cover image', 'image'), field('additional_images', 'Additional images', 'json'), field('objectives', 'Objectives (one per line)', 'json'), field('is_featured', 'Featured', 'boolean'), field('sort_order', 'Display order', 'number')] },
  partner_organizations: { table: 'partner_organizations', title: 'Partner organizations', description: 'Manage the organizations working alongside Heart of Sympathy. Saving publishes the partner immediately.', columns: ['name', 'focus_area', 'website_url'], fields: [field('name', 'Organization name', 'text', undefined, true), field('focus_area', 'Partnership focus'), field('description', 'About the partnership', 'textarea'), field('logo_url', 'Organization logo', 'image'), field('website_url', 'Website'), field('sort_order', 'Display order', 'number')] },
  galleries: { table: 'galleries', title: 'Gallery', description: 'Create a photo post with one or more original images. Saving publishes it immediately.', columns: ['title', 'collection_name'], fields: [field('title', 'Post title'), field('additional_images', 'Post images', 'image-list', undefined, true), field('alt_text', 'Alternative text'), field('caption', 'Caption', 'textarea'), field('description', 'Description', 'textarea'), field('collection_name', 'Collection'), field('activity_date', 'Activity date', 'date'), field('sort_order', 'Display order', 'number')] },
  events: { table: 'events', title: 'Events', description: 'Publish an event with its date, venue, and optional registration details.', columns: ['title', 'event_date', 'location'], fields: [field('title', 'Event title', 'text', undefined, true), field('summary', 'What will happen?', 'textarea', undefined, true), field('starts_at', 'Date and start time', 'datetime', undefined, true), field('ends_at', 'End time', 'datetime'), field('location', 'Venue', 'text', undefined, true), field('cover_image_url', 'Event image', 'image'), field('registration_url', 'Registration link')] },
  announcements: { table: 'announcements', title: 'Announcements', description: 'Publish a public update on the Events page.', columns: ['title', 'published_at'], fields: [field('title', 'Announcement title', 'text', undefined, true), field('body', 'Announcement', 'textarea', undefined, true), field('cover_image_url', 'Announcement image', 'image')] },
  advocacy_campaigns: { table: 'advocacy_campaigns', title: 'Advocacy campaigns', description: 'Plan a public learning or awareness campaign with its focus, schedule, venue, and optional image.', columns: ['title', 'focus_area', 'starts_at', 'location'], fields: [field('title', 'Campaign title', 'text', undefined, true), field('focus_area', 'Advocacy focus', 'text', undefined, true), field('summary', 'What will participants learn or do?', 'textarea', undefined, true), field('starts_at', 'Date and start time', 'datetime', undefined, true), field('ends_at', 'Date and end time', 'datetime'), field('location', 'Venue', 'text', undefined, true), field('cover_image_url', 'Campaign image', 'image')] },
  campaign_categories: { table: 'campaign_categories', title: 'Giving area categories', description: 'Categories are entered directly on each giving area.', columns: ['name'], fields: [field('name', 'Name', 'text', undefined, true), field('description', 'Description', 'textarea'), field('icon'), field('sort_order', 'Display order', 'number')] },
  donation_campaigns: { table: 'donation_campaigns', title: 'Giving areas', description: 'Add the category, description, image, wanted and available amounts, currency, dates, and display order. Saving publishes the giving area on the public Donate page immediately.', columns: ['category', 'target_amount', 'raised_amount'], fields: [field('category', 'Category', 'text', undefined, true), field('description', 'Description', 'textarea', undefined, true), field('cover_image_url', 'Image', 'image', undefined, true), field('target_amount', 'Amount wanted', 'number', undefined, true), field('raised_amount', 'Amount available so far', 'number', undefined, true), field('currency_code', 'Currency', 'text', undefined, true), field('starts_at', 'Start date', 'date'), field('ends_at', 'End date', 'date'), field('sort_order', 'Display order', 'number')] },
  contact_details: { table: 'contact_details', title: 'Contact details', description: 'Add public email, phone, WhatsApp, map, or website contact information. Saving publishes it on the Contact page and footer.', columns: ['label', 'category', 'value'], fields: [field('label', 'Contact label', 'text', undefined, true), field('value', 'Contact information', 'text', undefined, true), field('category', 'Contact type', 'select', ['email', 'phone', 'whatsapp', 'location', 'website', 'other'], true), field('sort_order', 'Display order', 'number')] },
  social_links: { table: 'social_links', title: 'Social links', description: 'Verified organization social profiles. Saving publishes them immediately.', columns: ['platform', 'url'], fields: [field('platform', 'Platform', 'text', undefined, true), field('url', 'URL', 'text', undefined, true), field('sort_order', 'Display order', 'number')] },
  newsletter_subscribers: { table: 'newsletter_subscribers', title: 'Newsletter subscribers', description: 'Only people who signed up are listed. Unsubscribing removes their record from this list.', columns: ['email', 'consented_at'], fields: [], canCreate: false, deleteLabel: 'Delete subscriber' },
  volunteer_applications: { table: 'volunteer_applications', title: 'Volunteer applications', description: 'Review incoming volunteer interest and update its status.', columns: ['full_name', 'email', 'status', 'created_at'], fields: [field('status', 'Status', 'select', ['new', 'reviewing', 'accepted', 'declined'])], canCreate: false, canDelete: false },
  volunteers: { table: 'volunteers', title: 'Volunteer records', description: 'Volunteer contacts, skills and current status.', columns: ['full_name', 'email', 'status'], fields: [field('full_name', 'Full name', 'text', undefined, true), field('email', 'Email'), field('phone', 'Phone'), field('skills', 'Skills (one per line)', 'json'), field('status', 'Status', 'select', ['applicant', 'active', 'inactive']), field('joined_at', 'Joined date', 'date')] },
  volunteer_assignments: { table: 'volunteer_assignments', title: 'Volunteer assignments', description: 'Event assignments and scheduled volunteer hours.', columns: ['volunteer_id', 'role_title', 'starts_at', 'status'], fields: [referenceField('volunteer_id', 'Volunteer', 'volunteers', ['full_name', 'email'], true), referenceField('event_id', 'Event', 'events', ['title']), field('role_title', 'Assignment role'), field('starts_at', 'Starts at', 'datetime'), field('ends_at', 'Ends at', 'datetime'), field('hours', 'Hours', 'number'), field('status', 'Status', 'select', ['planned', 'confirmed', 'completed', 'cancelled'])] },
  donations: { table: 'donations', title: 'Donation records', description: 'Record verified donations; never treat a browser submission as a payment.', columns: ['amount', 'currency_code', 'status', 'received_at'], fields: [referenceField('campaign_id', 'Campaign', 'donation_campaigns', ['title']), referenceField('donor_id', 'Donor', 'donors', ['full_name', 'organization_name']), field('amount', 'Amount', 'number', undefined, true), field('currency_code', 'Currency', 'select', ['RWF', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'BIF', 'CDF']), field('status', 'Status', 'select', ['pending', 'completed', 'failed', 'refunded', 'cancelled']), field('payment_provider', 'Payment method', 'select', ['mobile_money', 'bank_transfer', 'cash', 'card', 'cheque', 'other']), field('provider_reference', 'Payment reference'), field('received_at', 'Received at', 'datetime'), field('notes', 'Notes', 'textarea')], canDelete: false, createLabel: 'Record donation' },
  donors: { table: 'donors', title: 'Donors', description: 'Private donor contact records.', columns: ['full_name', 'organization_name', 'is_anonymous'], fields: [field('full_name', 'Donor name'), field('email', 'Email'), field('phone', 'Phone'), field('organization_name', 'Organization'), field('is_anonymous', 'Anonymous donor', 'boolean')], canDelete: false, createLabel: 'Add donor' },
  donation_methods: { table: 'donation_methods', title: 'Donation methods', description: 'Add official bank, mobile-money, or other giving instructions. Saving makes them available to visitors immediately.', columns: ['label', 'method_type', 'details'], fields: [field('label', 'Method name', 'text', undefined, true), field('method_type', 'Method type', 'select', ['mobile_money', 'bank_transfer', 'other'], true), field('details', 'Account or contact details', 'textarea', undefined, true), field('instructions', 'Instructions', 'textarea'), field('sort_order', 'Display order', 'number')] },
  contact_messages: { table: 'contact_messages', title: 'Contact inbox', description: 'Read and follow up on messages received from the public contact form.', columns: ['full_name', 'email', 'subject', 'created_at'], fields: [], readOnly: true, canCreate: false, canDelete: false },
  secretariat_documents: { table: 'secretariat_documents', title: 'Documents & minutes', description: 'Create minutes, memos and internal reports, or upload completed records for secure storage.', columns: ['title', 'document_type', 'meeting_date', 'status'], fields: [field('title', 'Title', 'text', undefined, true), field('document_type', 'Document type', 'select', ['note', 'meeting_minutes', 'memo', 'report']), field('meeting_date', 'Meeting date', 'date'), field('status', 'Status', 'select', ['draft', 'final']), field('body', 'Notes and attached files', 'document')] },
  department_updates: { table: 'department_updates', title: 'Department updates', description: 'Submit a period update for management review.', columns: ['department', 'period_start', 'period_end', 'status'], fields: [field('department', 'Department', 'text', undefined, true), field('period_start', 'Period start', 'date', undefined, true), field('period_end', 'Period end', 'date', undefined, true), field('summary', 'Summary', 'textarea', undefined, true), field('progress', 'Progress notes (one per line)', 'json'), field('status', 'Status', 'select', ['draft', 'submitted', 'reviewed'])] },
  families: { table: 'families', title: 'Family records', description: 'Confidential family data. Access follows organization roles and database RLS.', columns: ['household_code', 'primary_contact_name', 'district', 'status'], fields: [field('household_code', 'Household code'), field('primary_contact_name', 'Primary contact', 'text', undefined, true), field('phone', 'Phone'), field('email', 'Email'), field('address', 'Address', 'textarea'), field('district', 'District'), field('sector', 'Sector'), field('household_size', 'Household size', 'number'), field('vulnerability_notes', 'Restricted notes', 'textarea'), field('status', 'Status', 'select', ['active', 'inactive', 'closed'])] },
  children: { table: 'children', title: 'Child records', description: 'Restricted and sensitive child information. Follow safeguarding policies.', columns: ['child_code', 'first_name', 'school_name', 'enrollment_status'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), field('child_code', 'Child code'), field('first_name', 'First name', 'text', undefined, true), field('last_name', 'Last name'), field('date_of_birth', 'Date of birth', 'date'), field('gender', 'Gender', 'select', ['female', 'male', 'other', 'undisclosed']), field('school_name', 'School'), field('grade_level', 'Grade'), field('enrollment_status', 'Enrollment', 'select', ['enrolled', 'not_enrolled', 'graduated', 'unknown']), field('safeguarding_notes', 'Safeguarding notes', 'textarea'), field('status', 'Status', 'select', ['active', 'inactive', 'closed'])] },
  student_support_updates: { table: 'student_support_updates', title: 'Support milestones', description: 'Recorded support events in student journeys.', columns: ['child_id', 'occurred_on', 'category', 'title'], fields: [], readOnly: true },
  case_records: { table: 'case_records', title: 'Case records', description: 'Restricted case-management records. Keep factual notes and minimum necessary details.', columns: ['title', 'priority', 'status', 'opened_at'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), referenceField('child_id', 'Child', 'children', ['first_name', 'last_name', 'child_code']), referenceField('program_id', 'Program', 'programs', ['name']), field('title', 'Case title', 'text', undefined, true), field('description', 'Description', 'textarea'), field('priority', 'Priority', 'select', ['low', 'normal', 'high', 'urgent']), field('status', 'Status', 'select', ['open', 'in_progress', 'on_hold', 'resolved', 'closed']), field('closed_at', 'Closed at', 'datetime')] },
  case_notes: { table: 'case_notes', title: 'Case notes', description: 'Internal notes; restricted notes are role-limited by RLS.', columns: ['case_id', 'visibility', 'created_at'], fields: [referenceField('case_id', 'Case', 'case_records', ['title'], true), field('note', 'Note', 'textarea', undefined, true), field('visibility', 'Visibility', 'select', ['internal', 'restricted'])], deleteLabel: 'Delete note' },
  assistance_records: { table: 'assistance_records', title: 'Assistance records', description: 'Record assistance actually provided; amounts are not donations.', columns: ['assistance_type', 'quantity', 'amount', 'provided_at'], fields: [referenceField('family_id', 'Family', 'families', ['primary_contact_name', 'household_code'], true), referenceField('child_id', 'Child', 'children', ['first_name', 'last_name', 'child_code']), referenceField('case_id', 'Case', 'case_records', ['title']), referenceField('program_id', 'Program', 'programs', ['name']), field('assistance_type', 'Assistance type', 'text', undefined, true), field('description', 'Description', 'textarea'), field('quantity', 'Quantity', 'number'), field('amount', 'Amount', 'number'), field('currency_code', 'Currency')], canDelete: false },
  audit_events: { table: 'audit_events', title: 'Audit history', description: 'Append-only record of database changes. Sensitive row values are not included.', columns: ['table_name', 'record_id', 'action', 'occurred_at'], fields: [], readOnly: true },
  email_notification_jobs: { table: 'email_notification_jobs', title: 'Notification delivery queue', description: 'Provider delivery state. Email sending requires a server-side provider configuration.', columns: ['notification_type', 'status', 'recipient_count', 'created_at'], fields: [], readOnly: true },
  website_page_views: { table: 'website_page_views', title: 'Website page views', description: 'Anonymous page-view records for basic traffic reporting.', columns: ['page_path', 'referrer_host', 'country_code', 'created_at'], fields: [], readOnly: true },
  grant_opportunities: { table: 'grant_opportunities', title: 'Grant opportunities', description: 'Track verified funding opportunities and application progress.', columns: ['title', 'funder_name', 'status', 'deadline'], fields: [field('title', 'Opportunity title', 'text', undefined, true), field('funder_name', 'Funder', 'text', undefined, true), field('status', 'Status', 'select', ['researching', 'planned', 'in_progress', 'submitted', 'awarded', 'declined', 'archived']), field('focus_area', 'Focus area', 'select', ['child_welfare', 'education', 'healthcare', 'child_protection', 'poverty_alleviation', 'community_development', 'advocacy', 'organizational_capacity', 'other']), field('amount', 'Potential amount', 'number'), field('currency_code', 'Currency', 'select', ['RWF', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'BIF', 'CDF']), field('deadline', 'Deadline', 'date'), field('application_url', 'Application URL'), field('notes', 'Notes', 'textarea')], deleteLabel: 'Delete opportunity', createLabel: 'Add grant opportunity' },
  finance_transactions: { table: 'finance_transactions', title: 'Finance records', description: 'Track income, spending, team contributions and supporting document references.', columns: ['transaction_date', 'transaction_type', 'category', 'description', 'amount', 'currency_code', 'status'], fields: [field('transaction_type', 'Record type', 'select', ['income', 'expense', 'team_contribution']), field('category', 'Category', 'select', ['donation', 'grant', 'fundraising', 'program_expense', 'education', 'healthcare', 'food_and_supplies', 'transport', 'staff_costs', 'administration', 'bank_fees', 'team_contribution', 'in_kind_contribution', 'other'], true), field('description', 'Transaction description', 'text', undefined, true), field('amount', 'Amount', 'number', undefined, true), field('currency_code', 'Currency', 'select', ['RWF', 'USD', 'EUR', 'GBP', 'KES', 'UGX', 'TZS', 'BIF', 'CDF'], true), field('transaction_date', 'Transaction date', 'date', undefined, true), field('payment_method', 'Payment method', 'select', ['mobile_money', 'bank_transfer', 'cash', 'card', 'cheque', 'in_kind', 'other']), field('reference_number', 'Reference number'), field('document_url', 'External evidence URL'), field('document_path', 'Upload supporting file', 'private-file'), field('notes', 'Additional notes', 'textarea'), field('status', 'Status', 'select', ['draft', 'confirmed', 'cancelled'])], createLabel: 'Add finance transaction' },
  staff_accounts: { table: 'staff_accounts', title: 'Staff accounts', description: 'Review staff sign-in accounts and securely update work email or password.', columns: ['portal', 'account_email', 'role', 'team_members'], fields: [], readOnly: true, canCreate: false, canDelete: false },
};

const staffAccountDirectory = [
  { portal: 'Administration', account_email: 'admin@hos.org', role: 'admin', team_members: 'Ayamikani Rukundo Emmanuel; Tuyizer Salim' },
  { portal: 'Communications', account_email: 'communications@hos.org', role: 'communications', team_members: 'KEZA Praise; Ayamikani Rukundo Emmanuel; Tuyizer Salim' },
  { portal: 'Secretariat', account_email: 'secretariat@hos.org', role: 'secretariat', team_members: 'DOTTO DIDIER Nixon; Nadege Shima Ntwari' },
  { portal: 'Volunteer Management', account_email: 'volunteers@hos.org', role: 'volunteer_manager', team_members: 'Ines Iradukunda; Bonheur DUFITIMANA; Amahirwe Joyeuse' },
  { portal: 'Finance', account_email: 'finance@hos.org', role: 'finance', team_members: 'FORGIVENESS Peace Love' },
  { portal: 'Programs / Child Support', account_email: 'programs@hos.org', role: 'program_manager', team_members: 'Tesor RWOGERE; Babra Singana; Uwunkunda Pacifique; Isaro Michaella' },
  { portal: 'Fundraising / Grants', account_email: 'fundraising@hos.org', role: 'fundraiser', team_members: 'Benoit Ntwali Ngabo Teto; Habimana Kaela Naomi; Isingizwe Anita; Queen Merveille; Niyonsuti Don Joel' },
  { portal: 'Advocacy', account_email: 'events@hos.org', role: 'advocacy_lead', team_members: 'Kelvin Izibyose (Dancer); Uwase Shiffa (MC)' },
];

const portalConfig: Record<PortalKind, { icon: typeof LayoutDashboard; tables: AdminTable[]; heading: string; intro: string }> = {
  content: { icon: BookOpen, tables: ['organizations', 'website_sections', 'team_years', 'team_members', 'programs', 'partner_organizations', 'galleries', 'contact_details', 'social_links', 'contact_messages', 'newsletter_subscribers'], heading: 'Administration', intro: 'Communications staff manage public website content, while administrators review organization-wide progress.' },
  secretariat: { icon: FileText, tables: ['secretariat_documents', 'volunteer_applications', 'volunteers', 'volunteer_assignments', 'partner_organizations', 'newsletter_subscribers', 'contact_messages', 'contact_details', 'social_links'], heading: 'Secretariat', intro: 'Manage volunteer coordination and shared organization contacts assigned to your role.' },
  programs: { icon: HeartHandshake, tables: ['programs'], heading: 'Programs / Child Support', intro: 'Manage child support profiles, milestones, and the programs serving children and families.' },
  finance: { icon: CircleDollarSign, tables: ['donations', 'donors', 'finance_transactions', 'donation_methods', 'grant_opportunities'], heading: 'Finance', intro: 'Manage donor records, giving methods, verified donations, team contributions, income, and expenses.' },
  fundraising: { icon: HeartHandshake, tables: ['donation_campaigns', 'donors', 'donation_methods', 'grant_opportunities'], heading: 'Fundraising / Grants', intro: 'Manage giving areas and grant opportunities, and view finance-managed donor and payment-method records.' },
  advocacy: { icon: Megaphone, tables: ['events', 'announcements', 'advocacy_campaigns'], heading: 'Advocacy', intro: 'Plan public events, share announcements, and coordinate campaigns that bring people together to learn and take action.' },
};

const labels: Record<PortalKind, string> = {
  content: 'Administration',
  secretariat: 'Secretariat',
  programs: 'Programs / Child Support',
  finance: 'Finance',
  fundraising: 'Fundraising / Grants',
  advocacy: 'Advocacy',
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

function friendlyDatabaseError(error: unknown, fields: Field[]) {
  const message = error instanceof Error ? error.message : 'Could not save this record.';
  const nullColumn = message.match(/null value in column "([^"]+)"/i);
  if (nullColumn) {
    const column = nullColumn[1];
    const label = fields.find((item) => item.key === column)?.label ?? column.replaceAll('_', ' ');
    return `Please fill in ${label}.`;
  }
  if (/duplicate key|unique constraint/i.test(message)) return 'A record with the same identifying information already exists.';
  if (/foreign key constraint/i.test(message)) return 'Choose an existing related record before saving.';
  if (/invalid input syntax/i.test(message)) return 'Check the values in the form and try again.';
  return message;
}

function documentAttachments(row: DataRow): DocumentAttachment[] {
  const body = row.body;
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return [];
  const attachments = (body as Record<string, unknown>).attachments;
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((item): item is DocumentAttachment =>
    typeof item === 'object' && item !== null &&
    typeof (item as DocumentAttachment).path === 'string' &&
    typeof (item as DocumentAttachment).name === 'string' &&
    typeof (item as DocumentAttachment).size === 'number' &&
    typeof (item as DocumentAttachment).type === 'string',
  );
}

async function downloadPrivateDocument(attachment: DocumentAttachment, reportError: (message: string | null) => void) {
  await downloadStorageFile('secretariat-documents', attachment.path, attachment.name, reportError);
}

async function downloadStorageFile(bucket: string, path: string, name: string, reportError: (message: string | null) => void) {
  reportError(null);
  try {
    const { data, error } = await getSupabaseClient()
      .storage.from(bucket)
      .createSignedUrl(path, 60, { download: name });
    if (error) {
      reportError(`Unable to open ${name}: ${error.message}`);
      return;
    }
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = name;
    link.rel = 'noopener noreferrer';
    document.body.append(link);
    link.click();
    link.remove();
  } catch (error) {
    reportError(error instanceof Error ? `Unable to open ${name}: ${error.message}` : `Unable to open ${name}.`);
  }
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
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const available = getPortals(roles);
  const portal = routePortal
    ? available.find((availablePortal) => availablePortal === routePortal)
    : available[0];
  const [selection, setSelection] = useState<{ portal: PortalKind; table: AdminTable } | null>(null);
  const selectedTable = portal && selection?.portal === portal ? selection.table : null;
  const [activeView, setActiveView] = useState<'overview' | 'team' | 'uploaded' | 'students' | 'accounts' | 'progress'>('overview');
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const canManagePartners = canAccessRole(roles, ['communications', 'volunteer_manager']);
  const canManageGallery = canAccessRole(roles, ['communications']);
  const visibleTables = portal
    ? pageTablesForRole(portal, roles).filter((table) => table !== 'partner_organizations' && table !== 'galleries' && table !== 'donation_methods' && table !== 'secretariat_documents')
    : [];
  const isAdmin = canAccessRole(roles, ['admin']);
  const setSelectedTable = (table: AdminTable | null) => {
    if (portal) {
      setSelection(table ? { portal, table } : null);
    }
  };

  if (!portal) return <Navigate to={`/workspace/${available[0]}`} replace />;
  const page = portalConfig[portal];
  const isVolunteerManagerOnly = portal === 'secretariat'
    && canAccessRole(roles, ['volunteer_manager'])
    && !canAccessRole(roles, ['secretariat']);
  const portalTitle = isVolunteerManagerOnly ? 'Volunteer Management' : labels[portal];
  const canAccessStudents = canAccessRole(roles, ['program_manager', 'case_worker', 'child_protection', 'education_support', 'health_nutrition']);

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
        <div className="portal-nav-link active"><LayoutDashboard /><span>{portalTitle}</span></div>
        <div className="portal-kicker">Sections</div>
        <nav className="portal-nav" aria-label="Workspace sections">
          <button className={`portal-nav-link${selectedTable === null && activeView === 'overview' ? ' active' : ''}`} type="button" onClick={() => { setSelectedTable(null); setActiveView('overview'); }}><LayoutDashboard /><span>Overview</span></button>
          <button className={`portal-nav-link${selectedTable === null && activeView === 'team' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('team'); }}><Users /><span>Team &amp; guide</span></button>
          {portal === 'programs' && canAccessStudents && <button className={`portal-nav-link${selectedTable === null && activeView === 'students' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('students'); }}><HeartHandshake /><span>Our children</span></button>}
          {canManageGallery && <button className={`portal-nav-link${selectedTable === 'galleries' ? ' active' : ''}`} type="button" onClick={() => { setActiveView('overview'); setSelectedTable('galleries'); }}><ImageUp /><span>Gallery</span></button>}
          {canManagePartners && <button className={`portal-nav-link${selectedTable === 'partner_organizations' ? ' active' : ''}`} type="button" onClick={() => { setActiveView('overview'); setSelectedTable('partner_organizations'); }}><HeartHandshake /><span>Partners</span></button>}
          {['finance', 'fundraising'].includes(portal) && canAccessRole(roles, ['finance', 'fundraiser']) && <button className={`portal-nav-link${selectedTable === 'donation_methods' ? ' active' : ''}`} type="button" onClick={() => { setActiveView('overview'); setSelectedTable('donation_methods'); }}><CircleDollarSign /><span>Donation methods</span></button>}
          {portal === 'secretariat' && canAccessRole(roles, ['secretariat']) && <button className={`portal-nav-link${selectedTable === null && activeView === 'uploaded' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('uploaded'); }}><FileText /><span>Uploaded docs</span></button>}
          {portal === 'content' && isAdmin && <button className={`portal-nav-link${selectedTable === null && activeView === 'accounts' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('accounts'); }}><Users /><span>Staff accounts</span></button>}
          {portal === 'content' && isAdmin && <button className={`portal-nav-link${selectedTable === null && activeView === 'progress' ? ' active' : ''}`} type="button" onClick={() => { setSelection(null); setActiveView('progress'); }}><Activity /><span>Track progress</span></button>}
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
            <div className="eyebrow">{portalTitle}</div><h1>{selectedTable ? configs[selectedTable].title : activeView === 'team' ? 'Team & guide' : activeView === 'accounts' ? 'Staff accounts' : activeView === 'progress' ? 'Track progress' : activeView === 'uploaded' ? 'Uploaded docs' : activeView === 'students' ? 'Our children' : isVolunteerManagerOnly ? 'Volunteer Management' : page.heading}</h1><p>{selectedTable === 'donors' && portal === 'fundraising' ? 'View donor records managed by Finance. You cannot edit or delete donor records here.' : selectedTable === 'grant_opportunities' && portal === 'finance' ? 'View grant opportunities managed by Fundraising. You cannot edit or delete grant records here.' : selectedTable === 'donation_methods' && portal === 'fundraising' ? 'View official giving instructions managed by Finance. You cannot edit or delete these methods here.' : selectedTable ? configs[selectedTable].description : activeView === 'team' ? 'Meet your portal team, then use the quick guide below to complete common tasks.' : activeView === 'accounts' ? 'Manage one account for each team portal.' : activeView === 'progress' ? 'Review live metrics and activity history across the organization.' : activeView === 'uploaded' ? 'Browse and manage completed records uploaded to secure storage.' : activeView === 'students' ? 'Manage child profiles, family context, and support milestones in one place.' : isVolunteerManagerOnly ? 'Coordinate volunteer applications, active volunteers, assignments, and shared partner records.' : portal === 'secretariat' && canAccessRole(roles, ['secretariat']) ? 'Create and manage internal Secretariat documents and meeting minutes.' : page.intro}</p>
          </div>
          <div className="portal-actions">
            <button type="button" className="button button-outline portal-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}<span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
            </button>
            {!selectedTable && <span className="pill"><Shield size={13} /> Role-protected</span>}
          </div>
        </div>
        {selectedTable
          ? selectedTable === 'staff_accounts'
            ? <StaffAccountsWorkspace />
            : selectedTable === 'contact_messages'
              ? <ContactInboxWorkspace />
              : <RecordWorkspace key={selectedTable} config={getTableConfig(portal, selectedTable, roles)} />
          : activeView === 'students'
            ? <StudentSupportWorkspace roles={roles} />
            : activeView === 'accounts'
              ? <StaffAccountsWorkspace />
            : activeView === 'progress'
              ? <AdminProgressWorkspace />
            : activeView === 'team'
              ? <><PortalTeam team={getPortalTeam(portal, roles)} /><PortalGuide portal={portal} roles={roles} /></>
            : portal === 'secretariat' && activeView === 'uploaded'
              ? <SecretariatDocumentsWorkspace key="uploaded" mode="uploads" />
              : portal === 'secretariat' && canAccessRole(roles, ['secretariat'])
                ? <SecretariatDocumentsWorkspace key="documents" mode="documents" />
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

function PortalGuide({ portal, roles }: { portal: PortalKind; roles: string[] }) {
  const isAdmin = roles.includes('admin');
  const sections: Array<{ title: string; details: string; items: string[] }> = portal === 'content'
    ? isAdmin
      ? [
          { title: 'Run the workspace', details: 'Use the sidebar to choose a task; the overview summarizes the sections available to your role.', items: ['Open Overview to see your accessible records.', 'Use Staff accounts to change an existing team login.', 'Use Track progress to review live totals and selected audit history.'] },
          { title: 'Manage public information', details: 'Communications maintains public site content. Admin can review organization-wide progress and account access.', items: ['Keep gallery items, partners, programs, and website copy current.', 'Advocacy manages events, announcements, and public advocacy campaigns.', 'Review contact messages and newsletter subscriptions in their shared sections.'] },
        ]
      : [
          { title: 'Update the public website', details: 'New and edited public content appears as soon as it saves, so check it before saving.', items: ['Use Gallery, Partners, Programs, and Team for the organization information visitors see.', 'Advocacy manages Events, Announcements, and Advocacy campaigns.', 'Use Contact messages and Newsletter subscribers to follow up with people.'] },
          { title: 'Keep content consistent', details: 'Changes are shared with other authorized workspaces and refresh on the public site.', items: ['Preview image cards before saving.', 'Check dates, links, descriptions, and image captions.', 'Use Overview to return to the section list.'] },
        ]
    : portal === 'secretariat'
      ? roles.includes('volunteer_manager')
        ? [
            { title: 'Coordinate volunteers', details: 'Keep applications and volunteer records up to date from their shared sections.', items: ['Review new volunteer applications and follow up with applicants.', 'Maintain the volunteer roster and shared partner records.', 'Use Contact inbox, subscriber list, contact details, and social links for shared communications.'] },
            { title: 'Work with shared records', details: 'Updates made here are visible to other authorized teams.', items: ['Check existing entries before adding a new one.', 'Use search and preview cards to find records quickly.', 'Confirm a change saved before moving to another section.'] },
          ]
        : [
              { title: 'Create Secretariat documents', details: 'Use Overview to create and maintain meeting minutes, memos, and reports.', items: ['Select New document to open the full-page editor.', 'Set the document type, date, and time, then format the content.', 'Save to return to the dated document previews.'] },
              { title: 'Store completed records', details: 'Use Uploaded docs for files that already exist outside the workspace.', items: ['Upload PDF, Word, TXT, or RTF files with a clear title and date.', 'Open files from their private storage links.', 'Edit the record details or delete the document and its stored files.'] },
          ]
      : portal === 'programs'
        ? [
            { title: 'Keep each student’s work together', details: 'The student record combines private staff details, a profile draft, a photo, and the support timeline.', items: ['Add or edit a student from Our children; public-profile fields are in the same form.', 'Record follow-up with Log support; health and internal notes stay private.', 'Only publish appropriate, non-sensitive profile details. Never publish a full date of birth or private case information.'] },
            { title: 'Manage programs', details: 'Use the Programs section for the services delivered to students and families.', items: ['Keep program descriptions and status current.', 'Use the student timeline for individual follow-up.', 'Use Overview to see your available sections.'] },
          ]
        : portal === 'finance'
          ? [
              { title: 'Record financial activity', details: 'Keep donations, spending, and team contributions distinguishable and traceable.', items: ['Record verified donations and donors in their sections.', 'Use Finance records for income, expenses, and team contributions.', 'Attach supporting documents where available.'] },
              { title: 'Set the ways to give', details: 'Finance owns the official bank, mobile-money, and other payment instructions.', items: ['Add or update each method once in Donation methods.', 'Saving a method makes it available to visitors immediately.', 'Fundraising areas automatically show these methods when a visitor selects Donate.'] },
            ]
          : portal === 'advocacy'
            ? [
                { title: 'Publish events and announcements', details: 'Use Events for scheduled gatherings and Announcements for timely public updates.', items: ['Add a clear title, essential details, date, and venue for an event.', 'Use announcements for short updates that should appear on the Events page.', 'Upload an optional clear image; uploaded images are saved to the public media library.'] },
                { title: 'Coordinate advocacy campaigns', details: 'Campaigns are learning or awareness activities for groups, separate from donation campaigns and regular events.', items: ['Choose a specific advocacy focus and explain what participants will learn or do.', 'Add the scheduled date, venue, and an optional campaign image.', 'Review the public Events page after publishing; edits and deletions are reflected there.'] },
              ]
            : [
              { title: 'Create a giving area', details: 'Add a category, area name, description, photo, wanted and available amounts, currency, dates, and display order.', items: ['Save the form once; the giving area appears on the public Donate page automatically.', 'No separate category record, publishing switch, or payment-method setup is needed.', 'Visitors select Donate on the area to see the methods maintained by Finance.'] },
              { title: 'Manage grants and shared records', details: 'Fundraising owns giving areas and grant opportunities; Finance owns payment methods and donor records.', items: ['Keep grant deadlines and application links current.', 'Review donor and donation-method records maintained by Finance; these are view-only here.', 'Check the public Donate page after saving a giving area.'] },
            ];

  return <section className="portal-guide" aria-labelledby="portal-guide-title">
    <div className="portal-guide-heading"><div><span className="eyebrow">Quick guide</span><h2 id="portal-guide-title">How to use this workspace</h2><p>Short steps for the tasks your team handles most.</p></div><BookOpen size={22} aria-hidden="true" /></div>
    {portal === 'finance' && <div className="portal-guide-callout"><strong>Finance adds the official payment methods.</strong><span>Fundraising’s Donate cards use the methods you save here automatically.</span></div>}
    {portal === 'fundraising' && <div className="portal-guide-callout"><strong>Save a giving area once; it appears on Donate.</strong><span>When a visitor selects Donate, the payment methods Finance maintains are shown automatically.</span></div>}
    <div className="portal-guide-grid">{sections.map((section, index) => <article className="portal-guide-card" key={section.title}>
      <div className="portal-guide-index">{String(index + 1).padStart(2, '0')}</div><h3>{section.title}</h3><p>{section.details}</p><ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>)}</div>
  </section>;
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
    partner_organizations: ['communications', 'volunteer_manager'],
    events: ['advocacy_lead'],
    announcements: ['advocacy_lead'],
    advocacy_campaigns: ['advocacy_lead'],
    galleries: ['communications'],
    contact_details: ['communications', 'volunteer_manager'],
    social_links: ['communications', 'volunteer_manager'],
    contact_messages: ['communications', 'volunteer_manager'],
    newsletter_subscribers: ['communications', 'volunteer_manager'],
    finance_transactions: ['finance'],
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
    donors: ['finance', 'fundraiser'],
    donation_campaigns: ['fundraiser'],
    grant_opportunities: ['fundraiser', 'finance'],
    donation_methods: ['finance', 'fundraiser'],
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
    programs: ['communications', 'program_manager'],
    partner_organizations: ['communications', 'volunteer_manager'],
    events: ['advocacy_lead'],
    announcements: ['advocacy_lead'],
    advocacy_campaigns: ['advocacy_lead'],
    donation_campaigns: ['fundraiser'],
    galleries: ['communications'],
    contact_details: ['communications', 'volunteer_manager'],
    social_links: ['communications', 'volunteer_manager'],
    newsletter_subscribers: ['communications', 'volunteer_manager'],
    volunteer_applications: ['volunteer_manager', 'hr'],
    volunteers: ['volunteer_manager', 'hr'],
    volunteer_assignments: ['volunteer_manager'],
    donations: ['finance'],
    donors: ['finance'],
    grant_opportunities: ['fundraiser'],
    donation_methods: ['finance'],
    contact_messages: ['communications', 'volunteer_manager'],
    finance_transactions: ['finance'],
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
  'organizations', 'website_sections', 'team_years', 'team_members', 'programs', 'partner_organizations', 'galleries',
  'contact_details', 'social_links',
];
const activityGroups: Array<{ label: string; color: string; tables: string[] }> = [
  { label: 'Communications', color: 'var(--gold-bright)', tables: communicationTables },
  { label: 'Programs & child support', color: '#70c4a8', tables: ['families', 'children', 'case_records', 'case_notes', 'assistance_records', 'department_updates'] },
  { label: 'Finance', color: '#91c9ce', tables: ['donations', 'finance_transactions'] },
  { label: 'Fundraising', color: '#d99bff', tables: ['donors', 'donation_campaigns', 'grant_opportunities'] },
  { label: 'Secretariat & volunteers', color: '#ff9d73', tables: ['secretariat_documents', 'volunteers', 'volunteer_assignments', 'volunteer_applications'] },
  { label: 'Advocacy', color: '#e6c14f', tables: ['events', 'announcements', 'advocacy_campaigns'] },
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
        <AnalyticsLineChart title="Website page views" description="Daily page loads recorded on public pages." points={dailySeries.visits} color="var(--gold-bright)" loading={loading} />
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
      {loading ? <div className="analytics-chart-loading"><span className="loading-dot" /> Loading chart…</div> : items.length ? <div className="analytics-bars">{items.map((item) => <div className="analytics-bar-row" key={item.label}><span>{item.label}</span><div><i style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></div><strong>{item.value}</strong></div>)}</div> : <p className="analytics-empty">No communications changes were audited in this period.</p>}
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
  const Icon = portal === 'secretariat' && roles.includes('volunteer_manager') && !roles.includes('secretariat')
    ? Users
    : portalConfig[portal].icon;
  const displayName = typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : 'team member';

  useEffect(() => {
    let active = true;
    void Promise.all(tables.map(async (table): Promise<{ table: AdminTable; count: string | null; error: string | null }> => {
      if (table === 'staff_accounts') {
        try {
          const accounts = await listStaffAccounts();
          return { table, count: accounts.length === 250 ? '250+' : String(accounts.length), error: null };
        } catch (error) {
          return { table, count: null, error: error instanceof Error ? error.message : 'Staff account service is unavailable.' };
        }
      }
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

const progressGroups: Array<{ key: string; label: string; tables: AdminTable[] }> = [
  { key: 'communications', label: 'Communications', tables: ['organizations', 'website_sections', 'team_years', 'team_members', 'programs', 'partner_organizations', 'galleries', 'contact_details', 'social_links', 'contact_messages', 'newsletter_subscribers'] },
  { key: 'secretariat', label: 'Secretariat', tables: ['secretariat_documents'] },
  { key: 'volunteer_management', label: 'Volunteer Management', tables: ['volunteer_applications', 'volunteers', 'volunteer_assignments', 'partner_organizations', 'contact_details', 'social_links', 'contact_messages', 'newsletter_subscribers'] },
  { key: 'finance', label: 'Finance', tables: ['donations', 'donors', 'finance_transactions', 'donation_methods', 'grant_opportunities'] },
  { key: 'programs', label: 'Programs / Child Support', tables: ['programs', 'families', 'children', 'student_support_updates', 'assistance_records'] },
  { key: 'fundraising', label: 'Fundraising / Grants', tables: ['donation_campaigns', 'donors', 'donation_methods', 'grant_opportunities'] },
  { key: 'advocacy', label: 'Advocacy', tables: ['events', 'announcements', 'advocacy_campaigns'] },
];

type PortalProgressMetric = { portal_key: string; table_name: string; record_count: number };

function isPortalProgressMetric(value: unknown): value is PortalProgressMetric {
  if (typeof value !== 'object' || value === null) return false;
  const metric = value as Record<string, unknown>;
  return typeof metric.portal_key === 'string'
    && typeof metric.table_name === 'string'
    && typeof metric.record_count === 'number'
    && Number.isSafeInteger(metric.record_count)
    && metric.record_count >= 0;
}

function AdminProgressWorkspace() {
  const client = getSupabaseClient();
  const [selectedGroup, setSelectedGroup] = useState(progressGroups[0].key);
  const [metrics, setMetrics] = useState<PortalProgressMetric[]>([]);
  const [history, setHistory] = useState<DataRow[]>([]);
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const activeGroup = progressGroups.find((group) => group.key === selectedGroup) ?? progressGroups[0];
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [metricsResult, events] = await Promise.all([
        client.rpc('get_admin_portal_metrics'),
        listAdminRows('audit_events'),
      ]);
      if (metricsResult.error) throw new Error(`Portal metrics could not be loaded: ${metricsResult.error.message}`);
      if (!Array.isArray(metricsResult.data) || !metricsResult.data.every(isPortalProgressMetric)) {
        throw new Error('Portal metrics returned an invalid response. Apply the latest database migration and refresh.');
      }
      const loadedMetrics = metricsResult.data;
      const missingMetrics = progressGroups.flatMap((group) => group.tables
        .filter((table) => !loadedMetrics.some((metric) => metric.portal_key === group.key && metric.table_name === table))
        .map((table) => `${group.label}: ${configs[table].title}`));
      if (missingMetrics.length) {
        throw new Error(`Portal metrics are incomplete for ${missingMetrics.join(', ')}. Apply the latest database migration and refresh.`);
      }
      setMetrics(loadedMetrics);
      setHistory(events);
      return true;
    } catch (loadError) {
      setMetrics([]);
      setHistory([]);
      setError(loadError instanceof Error ? loadError.message : 'Portal progress could not be loaded.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void Promise.resolve().then(() => refresh());
    let active = true;
    const channel = client.channel('admin-portal-progress')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_events' }, () => { void refresh(true); });
    channel.subscribe((status) => {
      if (!active) return;
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setError(`Live progress updates are unavailable (${status}). Use Refresh to check current data.`);
      }
    });
    const fallback = window.setInterval(() => { void refresh(true); }, 30_000);
    return () => {
      active = false;
      window.clearInterval(fallback);
      void client.removeChannel(channel);
    };
  }, [client, refresh]);

  const tableNames = new Set<string>(activeGroup.tables);
  const visibleHistory = history.filter((row) => typeof row.table_name === 'string' && tableNames.has(row.table_name));
  const selectVisible = (checked: boolean) => setSelectedEvents((current) => {
    const visibleIds = visibleHistory.map((row) => String(row.id)).filter(Boolean);
    return checked ? [...new Set([...current, ...visibleIds])] : current.filter((id) => !visibleIds.includes(id));
  });
  const deleteSelected = async () => {
    if (!selectedEvents.length) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const eventIds = selectedEvents.map(Number);
      if (eventIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
        throw new Error('Some selected audit IDs are invalid. Refresh the history and try again.');
      }
      const { data, error: deleteError } = await client.rpc('delete_audit_events_by_ids', { p_event_ids: eventIds });
      if (deleteError) throw new Error(deleteError.message);
      const refreshed = await refresh();
      setSelectedEvents([]);
      setConfirmDeleteOpen(false);
      if (!refreshed) throw new Error('History was deleted, but progress could not be refreshed. Use Refresh to check the latest data.');
      if (typeof data !== 'number' || data !== selectedEvents.length) {
        throw new Error(`Only ${typeof data === 'number' ? data : 0} of ${selectedEvents.length} selected audit entries were deleted. The list has been refreshed.`);
      }
      setMessage(`${data} selected ${data === 1 ? 'entry was' : 'entries were'} deleted.`);
    } catch (deleteError) {
      setConfirmDeleteOpen(false);
      setError(deleteError instanceof Error ? deleteError.message : 'Selected audit history could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="admin-progress-workspace">
    <div className="filter-row" role="tablist" aria-label="Select team progress">
      {progressGroups.map((group) => <button key={group.key} type="button" role="tab" aria-selected={selectedGroup === group.key} className={`button button-small ${selectedGroup === group.key ? 'button-primary' : 'button-outline'}`} onClick={() => { setSelectedGroup(group.key); setSelectedEvents([]); setMessage(null); }}>{group.label}</button>)}
    </div>
    {error && <div role="alert" className="form-message error">{error}</div>}
    {message && <div role="status" className="form-message success">{message}</div>}
    <section className="panel">
      <div className="panel-heading"><div><h2>{activeGroup.label} progress</h2><p>Live totals for the current records in this workspace.</p></div><button type="button" className="button button-outline button-small" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button></div>
      {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading progress…</div> : <div className="portal-overview">{activeGroup.tables.map((table) => {
        const metric = metrics.find((item) => item.portal_key === activeGroup.key && item.table_name === table);
        return <article className="metric-card" key={table}><div className="metric-number">{metric?.record_count.toLocaleString() ?? '—'}</div><div className="metric-label">{configs[table].title}</div></article>;
      })}</div>}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>{activeGroup.label} history</h2><p>Select one or more entries to permanently delete.</p></div><button type="button" className="button button-danger button-small" disabled={busy || selectedEvents.length === 0} onClick={() => setConfirmDeleteOpen(true)}>{`Delete selected (${selectedEvents.length})`} <Trash2 size={14} /></button></div>
      {visibleHistory.length > 0 ? <div className="table-wrap"><table className="data-table"><thead><tr><th><input type="checkbox" aria-label="Select all visible history" checked={visibleHistory.length > 0 && visibleHistory.every((row) => selectedEvents.includes(String(row.id)))} onChange={(event) => selectVisible(event.target.checked)} /></th><th>Date</th><th>Area</th><th>Action</th><th>Record ID</th></tr></thead><tbody>{visibleHistory.map((row) => {
        const id = String(row.id);
        return <tr key={id}><td data-label="Select"><input type="checkbox" aria-label={`Select ${readable(row.table_name)} audit entry`} checked={selectedEvents.includes(id)} onChange={(event) => setSelectedEvents((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((value) => value !== id))} /></td><td data-label="Date">{typeof row.occurred_at === 'string' ? new Date(row.occurred_at).toLocaleString() : '—'}</td><td data-label="Area">{readable(row.table_name)}</td><td data-label="Action">{readable(row.action)}</td><td data-label="Record ID">{readable(row.record_id)}</td></tr>;
      })}</tbody></table></div> : <div className="empty-state">No recent history is recorded for this team.</div>}
    </section>
    {confirmDeleteOpen && <ConfirmActionDialog
      title="Delete selected audit history?"
      message={`This permanently deletes ${selectedEvents.length} selected ${selectedEvents.length === 1 ? 'entry' : 'entries'}. This action cannot be undone.`}
      confirmLabel={busy ? 'Deleting…' : 'Delete history'}
      busy={busy}
      onCancel={() => setConfirmDeleteOpen(false)}
      onConfirm={() => void deleteSelected()}
    />}
  </section>;
}

function ConfirmActionDialog({ title, message, confirmLabel, busy, onCancel, onConfirm }: {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return <div className="modal-backdrop confirm-action-backdrop" role="presentation" onMouseDown={(event) => {
    if (event.target === event.currentTarget && !busy) onCancel();
  }}>
    <section className="modal confirm-action-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" aria-describedby="confirm-action-message">
      <div className="modal-header"><h2 id="confirm-action-title">{title}</h2><button className="icon-button" type="button" disabled={busy} onClick={onCancel} aria-label="Close confirmation"><X size={16} /></button></div>
      <div className="modal-body"><p id="confirm-action-message">{message}</p><div className="record-form-actions"><button type="button" className="button button-outline" disabled={busy} onClick={onCancel}>Cancel</button><button type="button" className="button button-danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</button></div></div>
    </section>
  </div>;
}

function StaffAccountsWorkspace() {
  const [accounts, setAccounts] = useState<StaffAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<StaffAccount | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedAccounts = await listStaffAccounts();
      setAccounts([...new Map(loadedAccounts.map((account) => [account.user_id, account])).values()]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load staff accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  const editAccount = (account: StaffAccount) => {
    setSelectedAccount(account);
    setEmail(account.email);
    setPassword('');
    setShowPassword(false);
    setError(null);
    setMessage(null);
  };

  const saveAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedAccount || (!email.trim() && !password)) {
      setError('Enter an updated work email or a new password.');
      return;
    }
    if (password && password.length < 12) {
      setError('Use a password with at least 12 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await updateStaffAccount(selectedAccount.user_id, email === selectedAccount.email ? '' : email, password);
      setPassword('');
      setSelectedAccount(null);
      setMessage(updated.auditWarning ?? 'Staff account updated. The new password is not displayed or stored by this page.');
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update this staff account.');
    } finally {
      setSaving(false);
    }
  };

  const rolePortals: Record<string, string> = {
    admin: 'Administration',
    communications: 'Communications',
    secretariat: 'Secretariat',
    volunteer_manager: 'Volunteer Management',
    finance: 'Finance',
    program_manager: 'Programs / Child Support',
    fundraiser: 'Fundraising / Grants',
    advocacy_lead: 'Advocacy',
  };
  const visibleAccounts = accounts.filter((account) => !account.email.trim().toLocaleLowerCase().endsWith('@hos.example.com'));

  return (
    <>
      <section className="panel record-panel">
        <div className="panel-heading"><div><h2>Staff sign-in accounts</h2><p>One row per portal; accounts with the same portal role are grouped to avoid repeating the same section.</p></div><button type="button" className="button button-outline button-small" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'spin' : ''} /> Refresh</button></div>
        {error && !selectedAccount && <div role="alert" className="form-message error">{error}</div>}
        {message && <div role="status" className="form-message success">{message}</div>}
        {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading staff accounts…</div> : accounts.length === 0 ? <div className="empty-state">No staff accounts were returned. Confirm the Edge Function is deployed and staff roles are assigned.</div> : (
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Portal</th><th>Account email</th><th>Role</th><th>Team members</th><th>Access</th></tr></thead><tbody>
            {staffAccountDirectory.map((portalAccount) => {
              const roleAccounts = visibleAccounts.filter((account) =>
                portalAccount.role === 'program_manager'
                  ? account.roles.includes('program_manager') || account.roles.includes('case_worker')
                  : account.roles.includes(portalAccount.role)
              );
              const portalAccountUser = roleAccounts.find((account) => account.email.trim().toLocaleLowerCase() === portalAccount.account_email.toLocaleLowerCase())
                ?? roleAccounts[0];
              return <tr key={portalAccount.role}>
                <td data-label="Portal">{rolePortals[portalAccount.role] ?? portalAccount.portal}</td>
                <td data-label="Account email">{portalAccountUser?.email ?? 'No matching authorized account'}</td>
                <td data-label="Role">{portalAccount.role.replaceAll('_', ' ')}</td>
                <td data-label="Team members">{portalAccount.team_members}</td>
                <td data-label="Access"><div className="row-actions">{portalAccountUser ? <button className="button button-outline button-small" type="button" onClick={() => editAccount(portalAccountUser)}><Pencil size={13} /> Manage</button> : <span className="field-hint">Check the authorized email in Supabase</span>}</div></td>
              </tr>;
            })}
          </tbody></table></div>
        )}
      </section>
      {selectedAccount && <div className="modal-backdrop staff-account-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setSelectedAccount(null); }}>
        <section className="modal staff-account-editor" role="dialog" aria-modal="true" aria-labelledby="staff-account-heading" aria-describedby="staff-account-description">
        <div className="panel-heading staff-account-editor-heading"><div><h2 id="staff-account-heading">Manage staff account</h2><p id="staff-account-description"><strong>{selectedAccount.email}</strong><br />Leave the password empty to keep it unchanged. Passwords are never revealed.</p></div><button type="button" className="icon-button" onClick={() => setSelectedAccount(null)} disabled={saving} aria-label="Close account editor"><X size={16} /></button></div>
        <form className="form-grid" onSubmit={(event) => void saveAccount(event)}>
          <label className="field"><span className="field-label">Work email</span><input className="input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span className="field-label">New password</span><span className="password-input-wrap"><input className="input" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" /><button className="password-visibility" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          <div className="record-form-actions field-span"><button className="button button-outline" type="button" disabled={saving} onClick={() => setSelectedAccount(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save account changes'} <Check size={14} /></button></div>
        </form>
        {error && <div role="alert" className="form-message error">{error}</div>}
        </section>
      </div>}
    </>
  );
}

function ContactInboxWorkspace() {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [search, setSearch] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<DataRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listAdminRows('contact_messages'));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load contact messages.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(refresh); }, [refresh]);

  useEffect(() => {
    if (!selectedMessage) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedMessage(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [selectedMessage]);

  const unreadCount = rows.filter((row) => row.is_read !== true).length;
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleRows = rows.filter((row) => {
    const isRead = row.is_read === true;
    if (filter === 'unread' && isRead) return false;
    if (filter === 'read' && !isRead) return false;
    if (!normalizedSearch) return true;
    return ['full_name', 'email', 'subject', 'message'].some((key) =>
      String(row[key] ?? '').toLocaleLowerCase().includes(normalizedSearch),
    );
  });

  const toggleRead = async (row: DataRow) => {
    const id = typeof row.id === 'string' ? row.id : '';
    if (!id) {
      setError('This message cannot be updated because it has no database ID.');
      return;
    }
    const isRead = row.is_read === true;
    setSavingId(id);
    setError(null);
    try {
      await saveAdminRow('contact_messages', { is_read: !isRead }, id);
      setRows((current) => current.map((item) => item.id === id ? { ...item, is_read: !isRead } : item));
      setSelectedMessage((current) => current?.id === id ? { ...current, is_read: !isRead } : current);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update message read status.');
    } finally {
      setSavingId(null);
    }
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;
    const id = typeof selectedMessage.id === 'string' ? selectedMessage.id : '';
    if (!id) {
      setError('This message cannot be deleted because it has no database ID.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      await deleteAdminRow('contact_messages', selectedMessage);
      setRows((current) => current.filter((row) => row.id !== id));
      setSelectedMessage(null);
      setConfirmingDelete(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to permanently delete this message.');
    } finally {
      setDeleting(false);
    }
  };

  const formatMessageDate = (value: unknown) => {
    if (typeof value !== 'string' || !value) return 'Date unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  return (
    <section className="contact-inbox">
      <div className="contact-inbox-toolbar">
        <div className="contact-inbox-filters" role="group" aria-label="Filter contact messages">
          {(['all', 'unread', 'read'] as const).map((value) => (
            <button type="button" key={value} className={`button button-small ${filter === value ? 'button-primary' : 'button-outline'}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {value === 'all' ? `All (${rows.length})` : value === 'unread' ? `Unread (${unreadCount})` : `Read (${rows.length - unreadCount})`}
            </button>
          ))}
        </div>
        <div className="contact-inbox-tools">
          <label className="search-field contact-inbox-search"><Search size={15} /><input className="input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" aria-label="Search contact messages" /></label>
          <button type="button" className="button button-outline button-small" onClick={() => void refresh()} disabled={loading}><RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh</button>
        </div>
      </div>
      {error && <div role="alert" className="form-message error">{error}</div>}
      {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading contact messages…</div>
        : visibleRows.length === 0 ? <div className="empty-state">{rows.length ? 'No messages match this inbox filter.' : 'No contact messages have been received yet.'}</div>
          : <div className="contact-inbox-list">{visibleRows.map((row) => {
            const id = String(row.id ?? '');
            const isRead = row.is_read === true;
            return <article className={`contact-inbox-item${isRead ? '' : ' is-unread'}`} key={id}>
              <button type="button" className="contact-inbox-open" onClick={() => { setError(null); setSelectedMessage(row); }} aria-label={`Read message from ${String(row.full_name ?? 'website visitor')}: ${String(row.subject ?? 'No subject')}`}>
                <span className="contact-inbox-icon">{isRead ? <MailOpen size={18} /> : <Mail size={18} />}</span>
                <span className="contact-inbox-summary">
                  <span className="contact-inbox-sender">{String(row.full_name ?? 'Unknown sender')} <small>{String(row.email ?? '')}</small></span>
                  <strong>{String(row.subject ?? 'No subject')}</strong>
                  <span className="contact-inbox-excerpt">{String(row.message ?? '')}</span>
                </span>
                <time>{formatMessageDate(row.created_at)}</time>
              </button>
              <button type="button" className="contact-inbox-toggle" onClick={() => void toggleRead(row)} disabled={savingId === id} aria-label={`Mark as ${isRead ? 'unread' : 'read'}`}>
                {isRead ? <Mail size={14} /> : <MailOpen size={14} />}{savingId === id ? 'Saving…' : isRead ? 'Mark unread' : 'Mark read'}
              </button>
            </article>;
          })}</div>}
      {selectedMessage && <div className="modal-backdrop contact-message-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMessage(null); }}>
        <section className="modal contact-message-modal" role="dialog" aria-modal="true" aria-labelledby="contact-message-subject">
          <header className="modal-header contact-message-header">
            <div className="contact-message-heading"><span className={`pill ${selectedMessage.is_read === true ? '' : 'pill-gold'}`}>{selectedMessage.is_read === true ? 'Read' : 'Unread'}</span><h2 id="contact-message-subject">{String(selectedMessage.subject ?? 'No subject')}</h2><p>Received {formatMessageDate(selectedMessage.created_at)}</p></div>
            <div className="contact-message-header-actions">
              <button type="button" className="button button-danger button-small" onClick={() => { setError(null); setConfirmingDelete(true); }}><Trash2 size={14} /> Delete permanently</button>
              <button type="button" className="icon-button" aria-label="Close message" onClick={() => { setSelectedMessage(null); setConfirmingDelete(false); }}><X size={17} /></button>
            </div>
          </header>
          <div className="contact-message-body">
            <div className="contact-message-sender"><strong>{String(selectedMessage.full_name ?? 'Unknown sender')}</strong><a href={`mailto:${encodeURIComponent(String(selectedMessage.email ?? ''))}`}>{String(selectedMessage.email ?? '')}</a></div>
            <p className="contact-message-copy">{String(selectedMessage.message ?? '')}</p>
            {confirmingDelete && <div className="contact-message-delete-confirm" role="alertdialog" aria-label="Confirm permanent message deletion"><p><strong>Permanently delete this message?</strong> This cannot be undone.</p><div><button type="button" className="button button-outline button-small" disabled={deleting} onClick={() => setConfirmingDelete(false)}>Cancel</button><button type="button" className="button button-danger button-small" disabled={deleting} onClick={() => void deleteMessage()}>{deleting ? 'Deleting…' : 'Confirm delete permanently'}</button></div></div>}
            <div className="contact-message-actions">
              <a className="button button-outline button-small" href={`mailto:${encodeURIComponent(String(selectedMessage.email ?? ''))}?subject=${encodeURIComponent(`Re: ${String(selectedMessage.subject ?? '')}`)}`}>Reply by email</a>
              <button type="button" className="button button-primary button-small" disabled={savingId === String(selectedMessage.id ?? '')} onClick={() => void toggleRead(selectedMessage)}>
                {selectedMessage.is_read === true ? <Mail size={14} /> : <MailOpen size={14} />}{savingId === String(selectedMessage.id ?? '') ? 'Saving…' : selectedMessage.is_read === true ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          </div>
        </section>
      </div>}
    </section>
  );
}

function RecordWorkspace({ config }: { config: TableConfig }) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<DataRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [page, setPage] = useState(0);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [copyingEmails, setCopyingEmails] = useState(false);
  const searchRef = useRef(search);
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
  useEffect(() => {
    searchRef.current = search;
  }, [search]);
  useEffect(() => {
    if (config.table !== 'newsletter_subscribers') return;
    const abortController = new AbortController();
    const client = getSupabaseClient();
    const channel = client.channel('newsletter-subscriber-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'newsletter_subscribers' }, () => {
        if (!abortController.signal.aborted) void refresh(searchRef.current);
      })
      .subscribe((status) => {
        if (!abortController.signal.aborted && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          setError(`Live subscriber updates are unavailable (${status}). Refresh the list to check current subscriptions.`);
        }
      });
    return () => {
      abortController.abort();
      void client.removeChannel(channel);
    };
  }, [config.table, refresh]);
  const visibleRows = useMemo(() => rows.slice(page * pageSize, (page + 1) * pageSize), [page, rows]);

  const startNew = () => {
    const initial: DataRow = {};
    for (const item of config.fields) {
      if (item.kind === 'boolean') initial[item.key] = false;
      else if (item.kind === 'json') initial[item.key] = ['content', 'body', 'progress'].includes(item.key) ? {} : [];
      else if (item.kind === 'date') initial[item.key] = item.key === 'date_of_birth' ? '' : localDateValue();
      else if (item.kind === 'datetime') initial[item.key] = localDateTimeValue();
      else if (item.key === 'currency_code') initial[item.key] = 'RWF';
      else if (item.kind === 'select' && item.options?.length) initial[item.key] = item.options[0];
      else initial[item.key] = '';
    }
    if (config.table === 'secretariat_documents') initial.status = 'final';
    if (config.table === 'families') initial.household_code = generatedRecordCode('FAM');
    if (config.table === 'children') initial.child_code = generatedRecordCode('CH');
    if (config.table === 'donation_campaigns') initial.raised_amount = 0;
    setEditing(initial);
    setIsNew(true);
    setFieldErrors({});
    setError(null);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      if (event.currentTarget.querySelector('[data-uploading="true"]')) {
        setError('Wait for the file upload to finish before saving this record.');
        return;
      }
      const formData = new FormData(event.currentTarget);
    const missingFields: Record<string, string> = {};
    for (const item of config.fields) {
      if (!item.required) continue;
      const raw = String(formData.get(item.key) ?? '').trim();
      const missingImage = item.kind === 'image-list' && (() => {
        try {
          const parsed: unknown = JSON.parse(raw);
          return !Array.isArray(parsed) || parsed.length === 0;
        } catch {
          return true;
        }
      })();
      if (!raw || missingImage) {
        missingFields[item.key] = item.kind === 'image-list' ? `Add at least one image for ${item.label.toLowerCase()}.` : `${item.label} must be filled in.`;
      }
    }
      if (config.fields.some((item) => item.key === 'email') && String(formData.get('email') ?? '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(formData.get('email')))) {
        missingFields.email = 'Enter a valid email address.';
      }
      if (config.table === 'finance_transactions' && Number(formData.get('amount')) <= 0) {
        missingFields.amount = 'Enter an amount greater than zero.';
      }
      if (['events', 'advocacy_campaigns'].includes(config.table)) {
        const startDate = String(formData.get('starts_at') ?? '');
        const endDate = String(formData.get('ends_at') ?? '');
        if (startDate && endDate && endDate < startDate) missingFields.ends_at = 'The end date and time must be on or after the start date and time.';
      }
      if (config.table === 'donation_campaigns') {
        const wanted = Number(formData.get('target_amount'));
        const available = Number(formData.get('raised_amount'));
        if (!Number.isFinite(wanted) || wanted <= 0) missingFields.target_amount = 'Enter an amount wanted greater than zero.';
        if (!Number.isFinite(available) || available < 0) missingFields.raised_amount = 'Enter an amount available of zero or more.';
      }
      if (Object.keys(missingFields).length) {
        setFieldErrors(missingFields);
        return;
      }
      const values: DataRow = {};
      for (const item of config.fields) {
        const raw = formData.get(item.key);
        if (item.kind === 'boolean') values[item.key] = raw === 'on';
        else if (item.kind === 'number') values[item.key] = String(raw ?? '').trim() === '' ? item.key === 'sort_order' ? 0 : null : Number(raw);
        else if (item.kind === 'document') {
          let documentBody: unknown;
          try {
            documentBody = JSON.parse(String(raw ?? '{}')) as unknown;
          } catch {
            throw new Error('Review the document notes and attachments, then try saving again.');
          }
          if (typeof documentBody !== 'object' || documentBody === null || Array.isArray(documentBody)) {
            throw new Error('The document notes or attachments are not in a valid format.');
          }
          values[item.key] = documentBody;
        }
        else if (item.kind === 'private-file') {
          values[item.key] = String(raw ?? '').trim() || null;
        }
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
          if (config.table === 'finance_transactions') {
            const documentName = String(formData.get('document_name') ?? '').trim();
            values.document_name = documentName || null;
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
      const publishOnSave: Partial<Record<AdminTable, DataRow>> = {
        website_sections: { is_published: true },
        team_years: { active: true, is_published: true },
        team_members: { status: 'active', is_published: true },
        programs: { is_published: true },
        partner_organizations: { is_published: true },
        galleries: { is_published: true },
        events: { status: 'published', is_published: true },
        announcements: { status: 'published', is_published: true, audience: 'public' },
        advocacy_campaigns: { status: 'published' },
        contact_details: { is_public: true },
        social_links: { is_active: true },
        donation_methods: { is_active: true, is_public: true },
        donation_campaigns: { status: 'active', is_published: true },
      };
      Object.assign(values, publishOnSave[config.table]);
      if (config.table === 'events') {
        const startsAt = String(values.starts_at ?? '');
        values.event_date = startsAt ? startsAt.slice(0, 10) : null;
        values.published_at = typeof editing.published_at === 'string' ? editing.published_at : new Date().toISOString();
      }
      if (config.table === 'team_members') {
        const avatarPosition = String(formData.get('avatar_object_position') ?? '').trim();
        if (avatarPosition) values.avatar_object_position = avatarPosition;
      }
      if (config.table === 'donation_campaigns') {
        const title = String(values.category ?? '').trim();
        values.title = title;
        const existingSlug = typeof editing.slug === 'string' ? editing.slug : '';
        const generatedSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'giving-area';
        values.slug = existingSlug || `${generatedSlug}-${crypto.randomUUID().slice(0, 8)}`;
      }
      if (isNew && config.table === 'department_updates' && user?.id) values.submitted_by = user.id;
      if (config.table === 'secretariat_documents' && user?.id) {
        values[isNew ? 'created_by' : 'updated_by'] = user.id;
      }
      if (isNew && config.table === 'families' && user?.id) values.created_by = user.id;
      if (isNew && config.table === 'case_notes' && user?.id) values.created_by = user.id;
      if (isNew && config.table === 'assistance_records' && user?.id) values.provided_by = user.id;
      if (isNew && config.table === 'donations' && user?.id) values.recorded_by = user.id;
      if (isNew && config.table === 'finance_transactions' && user?.id) values.recorded_by = user.id;
      const recordId = typeof editing.id === 'string' ? editing.id : undefined;
      await saveAdminRow(config.table, values, recordId);
      setEditing(null);
      await refresh(search);
    } catch (saveError) {
      setError(friendlyDatabaseError(saveError, config.fields));
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (row: DataRow) => {
    const recordId = typeof row.id === 'string' ? row.id : '';
    if (!recordId) {
      setError('This record cannot be removed because it has no database ID.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteAdminRow(config.table, row);
      setConfirmingId(null);
      setRows((current) => current.filter((item) => String(item.id ?? '') !== recordId));
      await refresh(search);
    } catch (deleteError) {
      setConfirmingId(null);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not permanently delete this record.');
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
      const body = row.body && typeof row.body === 'object' ? row.body as Record<string, unknown> : {};
      const text = config.table === 'secretariat_documents'
        ? [typeof body.text === 'string' ? body.text : '', ...documentAttachments(row).map((attachment) => `Attached file: ${attachment.name}`)].filter(Boolean).join('\n\n')
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
    const content = [typeof docBody.text === 'string' ? docBody.text : '', ...documentAttachments(row).map((attachment) => `Attached file: ${attachment.name}`)].filter(Boolean).join('\n\n');
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
  const confirmingRow = rows.find((row) => row.id === confirmingId) ?? null;
  return (
    <section className="panel record-panel">
      <div className="toolbar">
        <form className="toolbar-left" onSubmit={(event) => void filterRows(event)}><div className="search-field"><Search size={15} /><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search these records" aria-label="Search records" /></div><button type="submit" className="button button-outline button-small">Search</button></form>
        <div className="toolbar-right">{config.table === 'newsletter_subscribers' && <button type="button" className="button button-outline button-small" onClick={() => void copySubscriberEmails()} disabled={loading || copyingEmails}><ClipboardCopy size={14} /> {copyingEmails ? 'Copying…' : 'Copy subscriber emails'}</button>}<button type="button" className="button button-outline button-small" onClick={() => void exportExcel()} disabled={loading || rows.length === 0}><ArrowDownToLine size={14} /> CSV / Excel</button>{canEdit && !config.readOnly && config.canCreate !== false && <button type="button" className="button button-primary button-small" onClick={startNew}><Plus size={14} /> {config.createLabel ?? 'Add record'}</button>}</div>
      </div>
      {copyMessage && <div role={copyMessage.startsWith('Could not') || copyMessage.startsWith('Clipboard') ? 'alert' : 'status'} className={`form-message subscriber-copy-message${copyMessage.startsWith('Could not') || copyMessage.startsWith('Clipboard') ? ' error' : ''}`}>{copyMessage}</div>}
      {rows.length === 250 && <p className="field-hint">The table loads at most 250 records at a time. Use search to find other records or narrow an export.</p>}
      {error && <div role="alert" className="form-message error">{error}</div>}
      {loading ? <div className="loading-inline"><LoaderCircle className="spin" size={16} /> Loading records…</div> : rows.length === 0 ? <div className="empty-state">{config.table === 'newsletter_subscribers' ? 'No subscribed email addresses are currently on the list.' : 'No records are available in this area. Add the first record or adjust your search.'}</div> : ['galleries', 'partner_organizations', 'programs', 'events', 'announcements', 'donation_campaigns', 'team_members'].includes(config.table) ? (
        <div className="record-preview-grid">
          {visibleRows.map((row, index) => {
            const rowId = String(row.id ?? index);
            const title = String(row.full_name ?? row.title ?? row.name ?? 'Untitled record');
            const previewImages = recordPreviewImages(row);
            const subtitle = config.table === 'team_members'
              ? [row.role_title, row.email].filter((value): value is string => typeof value === 'string' && value.trim().length > 0).join(' · ')
              : String(row.collection_name ?? row.focus_area ?? row.status ?? 'HOS record');
            return <article className="record-preview-card" key={rowId}>
              {previewImages.length ? <div className={`record-preview-images${config.table === 'team_members' ? ' record-preview-member-image' : ''}`}>{previewImages.slice(0, 4).map((src, imageIndex) => <img src={src} key={`${src}-${imageIndex}`} alt={config.table === 'team_members' ? `${title} profile` : ''} loading="lazy" />)}</div> : <div className={`record-preview-placeholder${config.table === 'team_members' ? ' record-preview-member-image' : ''}`}>{config.table === 'team_members' ? <Users size={24} /> : <ImageUp size={24} />}</div>}
              <div className="record-preview-content"><div className="card-kicker">{subtitle}</div><h3>{title}</h3><p>{String(row.biography ?? row.caption ?? row.description ?? row.summary ?? '') || 'No biography has been added.'}</p>
                <div className="record-preview-actions">
                  {canEdit && <button className="button button-outline button-small" type="button" onClick={() => { setEditing(row); setIsNew(false); setFieldErrors({}); setError(null); }}><Pencil size={13} /> Edit</button>}
                  {canEdit && config.canDelete !== false && <button className="button button-danger button-small" type="button" onClick={() => setConfirmingId(confirmingId === rowId ? null : rowId)} disabled={busy}><Trash2 size={13} /> Delete</button>}
                </div>
              </div>
            </article>;
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table"><thead><tr>{config.columns.map((column) => <th key={column}>{column.replaceAll('_', ' ')}</th>)}{!config.readOnly && <th>Actions</th>}</tr></thead><tbody>
            {visibleRows.map((row, index) => {
              const rowId = String(row.id ?? index);
              const removeLabel = config.deleteLabel ?? 'Delete record permanently';
              const financeDocumentPath = typeof row.document_path === 'string' ? row.document_path : null;
              const financeDocumentName = typeof row.document_name === 'string' ? row.document_name : null;
              return (
                <tr key={rowId}>
                  {config.columns.map((column) => <td className="truncate" key={column} data-label={column.replaceAll('_', ' ')}>{readable(row[column])}</td>)}
                  {!config.readOnly && <td data-label="Actions">
                    <div className="row-actions">
                      {config.table === 'secretariat_documents' && <>
                        <button className="icon-button" type="button" onClick={() => void exportDocument(row)} aria-label="Download Word document" title="Download Word document"><ArrowDownToLine size={14} /></button>
                        <button className="icon-button" type="button" onClick={() => printDocument(row)} aria-label="Print or save as PDF" title="Print or save as PDF"><FileDown size={14} /></button>
                        {documentAttachments(row).map((attachment) => <button key={attachment.path} className="icon-button" type="button" onClick={() => void downloadPrivateDocument(attachment, setError)} aria-label={`Download ${attachment.name}`} title={`Download ${attachment.name}`}><FileDown size={14} /></button>)}
                      </>}
                      {config.table === 'finance_transactions' && financeDocumentPath && financeDocumentName && <button className="icon-button" type="button" onClick={() => void downloadStorageFile('finance-documents', financeDocumentPath, financeDocumentName, setError)} aria-label={`Download ${financeDocumentName}`} title={`Download ${financeDocumentName}`}><FileDown size={14} /></button>}
                      {canEdit && config.table !== 'newsletter_subscribers' && <button className="icon-button" type="button" onClick={() => { setEditing(row); setIsNew(false); setFieldErrors({}); setError(null); }} aria-label="Edit record" title="Edit record"><Pencil size={14} /></button>}
                      {canEdit && config.canDelete !== false && <button className="icon-button" type="button" onClick={() => setConfirmingId(confirmingId === rowId ? null : rowId)} disabled={busy} aria-label={removeLabel} title={removeLabel}><Trash2 size={14} /></button>}
                    </div>
                  </td>}
                </tr>
              );
            })}
          </tbody></table>
        </div>
      )}
      {!loading && rows.length > pageSize && <div className="pagination"><span className="field-hint">Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} of {rows.length}</span><div className="row-actions"><button className="button button-outline button-small" type="button" disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button><button className="button button-outline button-small" type="button" disabled={(page + 1) * pageSize >= rows.length} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>}
      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setEditing(null); }}><div className="modal record-modal" role="dialog" aria-modal="true" aria-labelledby="record-editor-title"><div className="modal-header"><div><div className="eyebrow">{isNew ? 'Create record' : 'Update record'}</div><h2 id="record-editor-title">{config.title}</h2></div><button className="icon-button" type="button" onClick={() => setEditing(null)} aria-label="Close form"><X size={17} /></button></div><form className="modal-body" noValidate onSubmit={(event) => void save(event)}>{['events', 'announcements'].includes(config.table) && <div className="notice"><Shield size={16} /><span>Subscriber email notifications are not configured. Publishing a record will not send email.</span></div>}<div className="form-grid">{config.table === 'contact_details' && <ContactDetailFields key={String(editing.id ?? 'new')} editing={editing} error={fieldErrors} />}{config.fields.filter((item) => item.key !== 'consent_received' && (config.table !== 'contact_details' || !['label', 'value', 'category'].includes(item.key))).map((item) => <FieldEditor key={item.key} field={item} value={getEditorFieldValue(editing, item)} folder={safeName(config.table)} isNew={isNew} error={fieldErrors[item.key]} />)}</div>{error && <div role="alert" className="form-message error">{error}</div>}<div className="record-form-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Create record' : 'Save changes'} <Check size={14} /></button></div></form></div></div>}
      {confirmingRow && <ConfirmActionDialog
        title={`${config.deleteLabel ?? 'Delete record'} permanently?`}
        message={config.table === 'newsletter_subscribers'
          ? `This permanently deletes ${String(confirmingRow.email ?? 'this email address')} from the subscriber list. This cannot be undone.`
          : `This permanently deletes “${String(confirmingRow.title ?? confirmingRow.name ?? confirmingRow.full_name ?? 'this record')}”. Linked records may also be deleted or may prevent deletion. This cannot be undone.`}
        confirmLabel={busy ? 'Working…' : 'Confirm'}
        busy={busy}
        onCancel={() => setConfirmingId(null)}
        onConfirm={() => void removeRecord(confirmingRow)}
      />}
    </section>
  );
}

function getEditorFieldValue(record: DataRow, item: Field) {
  const value = record[item.key];
  if (item.key === 'avatar_url' && typeof value === 'string') {
    return { url: value, position: typeof record.avatar_object_position === 'string' ? record.avatar_object_position : '50% 50%' };
  }
  if (item.kind === 'private-file') return { path: record.document_path, name: record.document_name };
  if (item.kind === 'image-list' && typeof record.image_url === 'string' && record.image_url.trim() && (!Array.isArray(value) || value.length === 0)) {
    return [{ url: record.image_url, caption: '' }];
  }
  return value;
}

function recordPreviewImages(row: DataRow) {
  const imageList = row.additional_images;
  const images = Array.isArray(imageList)
    ? imageList.flatMap((asset) => typeof asset === 'object' && asset !== null && 'url' in asset && typeof asset.url === 'string' ? [asset.url] : [])
    : [];
  return images.length ? images : [row.image_url, row.cover_image_url, row.logo_url]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
}

function ContactDetailFields({ editing, error }: { editing: DataRow; error: Record<string, string> }) {
  const savedCategory = String(editing.category ?? '');
  const categoryAliases: Record<string, string> = { map: 'location', address: 'location' };
  const normalizedCategory = categoryAliases[savedCategory] ?? savedCategory;
  const supportedCategories = ['email', 'phone', 'whatsapp', 'location', 'website', 'other'];
  const [category, setCategory] = useState(supportedCategories.includes(normalizedCategory) ? normalizedCategory : 'other');
  const defaultLabels: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    location: 'Location',
    website: 'Website',
  };
  const savedLabel = String(editing.label ?? '');
  const [customLabel, setCustomLabel] = useState(savedLabel);
  const labels: Record<string, string> = {
    email: 'Email',
    phone: 'Phone',
    whatsapp: 'WhatsApp',
    location: 'Location',
    website: 'Website',
  };
  const valueSettings: Record<string, { label: string; type: string; placeholder: string; hint: string }> = {
    email: { label: 'Email address', type: 'email', placeholder: 'name@example.com', hint: 'Visitors can click this to compose an email.' },
    phone: { label: 'Phone number', type: 'tel', placeholder: '+250 7XX XXX XXX', hint: 'Visitors can tap this number to call.' },
    whatsapp: { label: 'WhatsApp number', type: 'tel', placeholder: '+250 7XX XXX XXX', hint: 'Include the country code so the WhatsApp link works.' },
    location: { label: 'Location or address', type: 'text', placeholder: 'City, district, street address, or place name', hint: 'Visitors can open this location in a map.' },
    website: { label: 'Website address', type: 'url', placeholder: 'https://example.org', hint: 'Visitors can open this website in a new tab.' },
    other: { label: 'Contact information', type: 'text', placeholder: 'Enter the contact information', hint: 'This will be shown as plain text.' },
  };
  const setting = valueSettings[category];
  const [value, setValue] = useState(String(editing.value ?? ''));

  return <>
    <label className="field">
      <span className="field-label">What kind of contact is this? *</span>
      <select className="select" name="category" value={category} onChange={(event) => {
        const nextCategory = event.target.value;
        setCategory(nextCategory);
        setCustomLabel('');
        setValue('');
      }} required>
        <option value="email">Email address</option>
        <option value="phone">Phone number</option>
        <option value="whatsapp">WhatsApp</option>
        <option value="location">Map location</option>
        <option value="website">Website</option>
        <option value="other">Other contact information</option>
      </select>
      <span className="field-hint">Choose a type to see the right input below.</span>
    </label>
    {category === 'other' && <label className="field">
      <span className="field-label">What should this be called? *</span>
      <input className="input" name="label" required value={customLabel} onChange={(event) => setCustomLabel(event.target.value)} placeholder="For example: Office hours" aria-invalid={Boolean(error.label)} aria-describedby={error.label ? 'field-error-contact-label' : undefined} />
      {error.label && <span id="field-error-contact-label" role="alert" className="field-error">{error.label}</span>}
    </label>}
    {category !== 'other' && <input type="hidden" name="label" value={category === normalizedCategory && savedLabel && savedLabel !== defaultLabels[category] ? savedLabel : labels[category]} />}
    <label className="field field-span">
      <span className="field-label">{setting.label} *</span>
      <input className="input" name="value" type={setting.type} required value={value} onChange={(event) => setValue(event.target.value)} placeholder={setting.placeholder} aria-invalid={Boolean(error.value)} aria-describedby={error.value ? 'field-error-contact-value' : undefined} />
      <span className="field-hint">{setting.hint}</span>
      {error.value && <span id="field-error-contact-value" role="alert" className="field-error">{error.value}</span>}
    </label>
  </>;
}

function FieldEditor({ field: item, value, folder, isNew, error }: { field: Field; value: unknown; folder: string; isNew: boolean; error?: string }) {
  const documentBody = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const privateFileValue = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as { path?: unknown; name?: unknown } : {};
  const imageFieldValue = typeof value === 'object' && value !== null && !Array.isArray(value) ? value as { url?: unknown; position?: unknown } : {};
  const [imageUrl, setImageUrl] = useState(typeof value === 'string' ? value : typeof imageFieldValue.url === 'string' ? imageFieldValue.url : '');
  const [avatarPosition, setAvatarPosition] = useState(() => {
    const position = typeof imageFieldValue.position === 'string' ? imageFieldValue.position : '50% 50%';
    const [x = '50%', y = '50%'] = position.split(/\s+/);
    return {
      x: Math.max(0, Math.min(100, Number.parseFloat(x) || 50)),
      y: Math.max(0, Math.min(100, Number.parseFloat(y) || 50)),
    };
  });
  const avatarDrag = useRef<{ pointerId: number; x: number; y: number } | null>(null);
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
  const [documentText, setDocumentText] = useState(typeof documentBody.text === 'string' ? documentBody.text : '');
  const [documentFiles, setDocumentFiles] = useState<DocumentAttachment[]>(documentAttachments({ body: documentBody }));
  const [privateFilePath, setPrivateFilePath] = useState(typeof privateFileValue.path === 'string' ? privateFileValue.path : '');
  const [privateFileName, setPrivateFileName] = useState(typeof privateFileValue.name === 'string' ? privateFileValue.name : '');
  const valueForField = item.kind === 'json'
    ? formatStructuredField(item.key, value ?? (item.key === 'content' || item.key === 'body' || item.key === 'progress' ? {} : []))
    : item.kind === 'tags' && Array.isArray(value) ? value.join(', ')
      : item.kind === 'date' ? typeof value === 'string' && value ? value.slice(0, 10) : isNew && item.key !== 'date_of_birth' ? localDateValue() : ''
        : item.kind === 'datetime' ? typeof value === 'string' && value ? value.slice(0, 16) : isNew ? localDateTimeValue() : ''
          : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  if (item.kind === 'private-file') {
    const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (!file) return;
      setUploading(true);
      setUploadError(null);
      try {
        if (file.size > 20 * 1024 * 1024) throw new Error('Supporting files must be 20 MB or smaller.');
        const client = getSupabaseClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) throw new Error('Your session expired. Sign in again before uploading files.');
        const path = `${userData.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
        const { error: storageError } = await client.storage.from('finance-documents').upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
        });
        if (storageError) throw new Error(`Could not upload ${file.name}: ${storageError.message}`);
        setPrivateFilePath(path);
        setPrivateFileName(file.name);
      } catch (uploadFailure) {
        setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'The supporting file could not be uploaded.');
      } finally {
        setUploading(false);
      }
    };
    return <div className="field field-span">
      <span className="field-label">{item.label}</span>
      <input type="hidden" name={item.key} value={privateFilePath} data-uploading={uploading ? 'true' : 'false'} />
      <input type="hidden" name="document_name" value={privateFileName} />
      <label className="image-upload-button"><FileUp size={16} /> {uploading ? 'Uploading file…' : 'Upload a private supporting file'}<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,image/jpeg,image/png" onChange={(event) => void handleFile(event)} disabled={uploading} /></label>
      <span className="field-hint">Only Finance and Administrators can access this file. Maximum 20 MB.</span>
      {privateFileName && <span className="field-hint">Attached: {privateFileName} <button type="button" className="text-button" onClick={() => { setPrivateFilePath(''); setPrivateFileName(''); }}>Remove</button></span>}
      {uploadError && <span role="alert" className="field-error">{uploadError}</span>}
    </div>;
  }
  if (item.kind === 'document') {
    const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      if (!files.length) return;
      setUploading(true);
      setUploadError(null);
      try {
        const client = getSupabaseClient();
        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) throw new Error('Your session expired. Sign in again before uploading files.');
        const uploaded = await Promise.all(files.map(async (file): Promise<DocumentAttachment> => {
          const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
          const contentTypes: Record<string, string[]> = {
            pdf: ['application/pdf'],
            doc: ['application/msword'],
            docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
            txt: ['text/plain'],
            rtf: ['application/rtf', 'application/x-rtf', 'text/rtf'],
          };
          if (!contentTypes[extension] || (file.type && !contentTypes[extension].includes(file.type))) {
            throw new Error(`${file.name} is not supported. Choose PDF, DOC/DOCX, TXT, or RTF.`);
          }
          if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than the 20 MB limit.`);
          const path = `${userData.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;
          const { error: storageError } = await client.storage.from('secretariat-documents').upload(path, file, {
            contentType: file.type || contentTypes[extension][0],
            upsert: false,
          });
          if (storageError) throw new Error(`Could not upload ${file.name}: ${storageError.message}`);
          return { path, name: file.name, size: file.size, type: file.type };
        }));
        setDocumentFiles((current) => [...current, ...uploaded]);
      } catch (uploadFailure) {
        setUploadError(uploadFailure instanceof Error ? uploadFailure.message : 'The document could not be uploaded.');
      } finally {
        setUploading(false);
      }
    };
    return <div className="field field-span">
      <span className="field-label">{item.label}</span>
      <input type="hidden" name={item.key} value={JSON.stringify({ text: documentText, attachments: documentFiles })} data-uploading={uploading ? 'true' : 'false'} />
      <label className="field"><span className="field-label">Record notes</span><textarea className="textarea" rows={5} value={documentText} onChange={(event) => setDocumentText(event.target.value)} placeholder="Notes about this completed record (optional)" /></label>
      <label className="image-upload-button"><FileUp size={16} /> {uploading ? 'Uploading files…' : 'Attach completed document(s)'}<input type="file" accept=".pdf,.doc,.docx,.txt,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,application/x-rtf,text/rtf" multiple onChange={(event) => void handleFiles(event)} disabled={uploading} /></label>
      <span className="field-hint">Private storage · PDF, DOC/DOCX, TXT, or RTF · maximum 20 MB each.</span>
      {documentFiles.length > 0 && <ul className="document-attachment-list">{documentFiles.map((attachment) => <li key={attachment.path}><FileText size={14} /><span>{attachment.name}</span><button type="button" className="button button-outline button-small" onClick={() => setDocumentFiles((current) => current.filter((file) => file.path !== attachment.path))}>Remove</button></li>)}</ul>}
      {error && <span id={`field-error-${item.key}`} role="alert" className="field-error">{error}</span>}
      {uploadError && <span role="alert" className="field-error">{uploadError}</span>}
    </div>;
  }
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
        <span className="field-label">{item.label}{item.required && ' *'}</span>
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
        {error && <span id={`field-error-${item.key}`} role="alert" className="field-error">{error}</span>}
      </div>
    );
  }
  if (item.kind === 'image') {
    const isTeamAvatar = folder === 'team-members' && item.key === 'avatar_url';
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
        <input type="hidden" name={item.key} value={imageUrl} required={item.required} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined} />
        {isTeamAvatar && <input type="hidden" name="avatar_object_position" value={`${avatarPosition.x}% ${avatarPosition.y}%`} />}
        <label className="image-upload-button">
          <ImageUp size={16} /> {uploading ? 'Uploading image…' : 'Choose image (JPEG, PNG, WebP or AVIF, up to 5 MB)'}
          <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => void handleFile(event)} disabled={uploading} />
        </label>
        <label className="field"><span className="field-label">Or enter an existing image URL</span><input className="input" type="url" name={`${item.key}_manual`} value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://…" /></label>
        {isTeamAvatar && imageUrl && <div className="avatar-crop-editor">
          <div
            className="avatar-crop-preview"
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              avatarDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
            }}
            onPointerMove={(event) => {
              const drag = avatarDrag.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              const deltaX = event.clientX - drag.x;
              const deltaY = event.clientY - drag.y;
              setAvatarPosition((current) => ({
                x: Math.max(0, Math.min(100, current.x - deltaX / bounds.width * 100)),
                y: Math.max(0, Math.min(100, current.y - deltaY / bounds.height * 100)),
              }));
              avatarDrag.current = { ...drag, x: event.clientX, y: event.clientY };
            }}
            onPointerUp={() => { avatarDrag.current = null; }}
            onPointerCancel={() => { avatarDrag.current = null; }}
            aria-label="Drag the photo to adjust the circular crop"
          >
            <img src={imageUrl} alt="Profile crop preview" style={{ objectPosition: `${avatarPosition.x}% ${avatarPosition.y}%` }} draggable={false} />
          </div>
          <div className="avatar-crop-controls">
            <span className="field-hint">Drag the photo to frame it inside the circle.</span>
            <button type="button" className="button button-outline button-small" onClick={() => setAvatarPosition({ x: 50, y: 50 })}>Center photo</button>
          </div>
        </div>}
        {imageUrl && !isTeamAvatar && <img className="upload-preview" src={imageUrl} alt="Selected image preview" />}
        {uploadError && <span role="alert" className="form-message error">{uploadError}</span>}
        {error && <span id={`field-error-${item.key}`} role="alert" className="field-error">{error}</span>}
      </div>
    );
  }
  if (item.kind === 'reference' && item.referenceTable) {
    return <ReferenceFieldEditor field={item} value={value} error={error} />;
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
      {item.kind === 'boolean' ? <span className="checkbox-field"><input type="checkbox" name={item.key} required={item.required} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined} defaultChecked={Boolean(value)} /> Yes / enabled</span>
        : item.kind === 'select' ? <select className="select" name={item.key} defaultValue={String(value ?? item.options?.[0] ?? '')} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined}>{item.options?.map((option) => <option value={option} key={option}>{option.replaceAll('_', ' ')}</option>)}</select>
          : item.kind === 'textarea' || item.kind === 'json' ? <textarea className="textarea" name={item.key} required={item.required} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined} rows={5} defaultValue={valueForField} placeholder={item.placeholder ?? (item.kind === 'json' ? 'Enter each item on a new line' : undefined)} />
            : <input className="input" name={item.key} type={item.kind === 'date' ? 'date' : item.kind === 'datetime' ? 'datetime-local' : item.kind === 'number' ? 'number' : item.key === 'email' ? 'email' : 'text'} step={item.kind === 'number' ? 'any' : undefined} required={item.required} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined} defaultValue={valueForField} placeholder={item.placeholder} /> }
      {item.kind === 'json' && helperText[item.key] && <span className="field-hint">{helperText[item.key]}</span>}
      {error && <span id={`field-error-${item.key}`} role="alert" className="field-error">{error}</span>}
    </label>
  );
}

function ReferenceFieldEditor({ field: item, value, error }: { field: Field; value: unknown; error?: string }) {
  const [rows, setRows] = useState<DataRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(typeof value === 'string' ? value : '');
  useEffect(() => {
    let active = true;
    if (!item.referenceTable) return () => { active = false; };
    void listAdminRows(item.referenceTable)
      .then((result) => { if (active) setRows(result); })
      .catch((loadError: unknown) => {
        if (active) setLoadError(loadError instanceof Error ? loadError.message : `Unable to load ${item.label.toLowerCase()} choices.`);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [item.label, item.referenceTable]);
  const selectedExists = rows.some((row) => row.id === selectedId);
  return (
    <label className="field">
      <span className="field-label">{item.label}{item.required && ' *'}</span>
      <select className="select" name={item.key} required={item.required} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `field-error-${item.key}` : undefined}>
        <option value="">{loading ? 'Loading choices…' : `Choose ${item.label.toLowerCase()}`}</option>
        {selectedId && !selectedExists && <option value={selectedId}>Keep existing linked record</option>}
        {rows.map((row) => {
          const id = typeof row.id === 'string' ? row.id : '';
          const label = (item.referenceLabel ?? []).map((key) => row[key]).filter((part) => typeof part === 'string' && part.trim()).join(' · ');
          return <option value={id} key={id}>{label || 'Unnamed record'}</option>;
        })}
      </select>
      {error && <span id={`field-error-${item.key}`} role="alert" className="field-error">{error}</span>}
      {loadError && <span role="alert" className="field-hint form-error-text">{loadError}</span>}
      {!loading && !loadError && rows.length === 0 && <span className="field-hint">No available records to link yet. Create the related record first.</span>}
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
