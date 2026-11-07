# Heart of Sympathy

The public website and staff portal use React, TypeScript, Vite, and Supabase. Published organization content is read from Supabase; staff sign-in uses Supabase Auth and database roles.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_KEY`) in `.env.local`.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` only in `.env.local` for the optional local seeder. Never prefix it with `VITE_`, commit it, or put it in a browser/hosting variable.
4. Install and start:

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. The requested command `npm run start all` starts the same local server. For production, run `npm run build`; `npm run preview` is a local preview server, not a production hosting server.

## Supabase database

The initial `supabase/schema.sql` creates the base tables. For a database where that script has already been run, apply these additive migrations in order in the Supabase SQL Editor:

`supabase/migrations/20261104200000_connected_organization_platform.sql`

This migration adds organization publishing fields, public content, contact submissions, volunteer applications, family/child case management, assistance records, volunteer assignments, campaign/donation records, impact data, auditing, storage buckets, indexes, and row-level security policies. It also seeds the organization basics, initial program descriptions, campaign categories, and empty team-year records. It deliberately does not invent team-member identities, impact statistics, stories, campaign targets, donation transactions, or payment details.

Then run:

`supabase/migrations/20261104223000_frontend_platform_features.sql`

This migration adds the expanded event, gallery, campaign, document, analytics and notification fields/tables; role-scoped policies; and newsletter subscribe/unsubscribe functions used by the current frontend. Newsletter preferences can be stored, but email confirmation and campaign/event email delivery are not configured and no emails are sent.

Finally run:

`supabase/migrations/20261104230000_role_workspace_boundaries.sql`

This migration separates management read access from staff editing, scopes finance and fundraising records to their respective roles, and tightens access to confidential cases, donors, documents, and volunteer records.

Then run:

`supabase/migrations/20261105001000_role_portal_alignment.sql`

This migration adds role-scoped grant tracking, the admin-only staff directory function, and tighter policies for program, communications, volunteer, fundraising, and case records.

Then run:

`supabase/migrations/20261105002000_gallery_carousel_images.sql`

This migration adds the image array used by multi-photo gallery posts. Gallery images continue to use the public `hos-public` Supabase Storage bucket; staff can add images individually or in a batch, and public displays retain the full image rather than cropping it.

Then run:

`supabase/migrations/20261105003000_admin_analytics_access.sql`

This grants the admin role read access to anonymous page-view data for the dashboard. RLS continues to restrict those records to admins; no visitor identity is collected.

After running the migration:

1. Confirm the SQL Editor reports success.
2. Run `supabase/verify_database.sql` in the SQL Editor and confirm all required tables exist with RLS enabled, both storage buckets exist, and the function checks pass.
3. Add only approved real roster, impact, contact, event, and campaign information through the database/admin workflow.
4. Do not store card numbers, bank credentials, or other payment credentials in this database. An online payment provider and server-side payment verification still need to be selected before accepting online donations.

Continue applying any remaining files in `supabase/migrations/` in filename order. The latest `20261107220000_advocacy_portal.sql` migration adds the Advocacy role and campaign table, transfers event and announcement editing to that role, enables public campaign display and image uploads, and updates Admin Track progress. Run `supabase/verify_database.sql` again afterward.

### Roles

Authorization comes from `public.user_roles`, not user-editable Auth metadata. Supported roles are:

`admin`, `director`, `management`, `it_data`, `communications`, `secretariat`, `program_manager`, `case_worker`, `child_protection`, `education_support`, `health_nutrition`, `finance`, `fundraiser`, `volunteer_manager`, `advocacy_lead`, `hr`, `staff`.

There are six workspace types: Administration, Secretariat, Finance, Programs / Child Support, Fundraising / Grants, and Advocacy. The `/portal` page lets staff choose a workspace before signing in; the selected workspace must match a role assigned in `public.user_roles`. The admin account sees a staff directory and audit history. Communications manages public website content, while Advocacy manages events, announcements, and separate advocacy campaigns shown on the public Events page. Secretariat and volunteer-management roles see separate sections in the Secretariat area; program managers and caseworkers see different sections in Programs / Child Support. Finance handles donations, while fundraising handles donation campaigns, donors, and grant opportunities. There is no Management workspace and no public sign-up flow.

There are nine shared team logins grouped under six workspace choices: Administration and Communications share the Administration area; Secretariat and Volunteer Management share Secretariat; Programs and Case Worker share Programs / Child Support; Finance, Fundraising / Grants, and Advocacy each have their own workspace. Each login has one database role. Because people in a team share credentials, database audit events identify the shared account, not the individual staff member who made a change.

Record forms prefill editable dates with the current local date/time except dates of birth, which are left blank. Database record IDs are generated by Supabase; related records are chosen by their names rather than by entering UUIDs. Family and child codes are generated when creating a record. List fields use one item per line; page content uses `section: value` lines. Record actions show tooltips, and archive/delete actions require an in-form confirmation.

The admin staff directory shows account emails and assigned roles, never passwords. Supabase Auth cannot reveal an account's current password. Staff can use the configured password-reset email flow, or an authorized local operator can set a new password with the command below.

### Create the nine shared portal accounts

The ignored local `staff-accounts.csv` has one row per portal, with prefilled team names, role, and shared `@hos.org` sign-in email. Enter one password in each row's final `password` column. The names also appear in each authenticated portal's Team sidebar tab. Check the names and assignments before provisioning.

1. Make sure `.env.local` points to the same Supabase project you plan to deploy. It needs `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `ALLOW_STAFF_ACCOUNT_PROVISIONING=true`. The service-role key stays on your computer only.
2. Open `staff-accounts.csv` in Excel or a text editor, fill all nine password cells (at least eight characters), and save it. Do not change the portal, email, or role columns. Keep this local file private; passwords are not stored in application source.
3. Run `npm run provision:staff`. It creates or updates the nine Supabase Auth users, profiles, and role assignments. Passwords are not printed.
4. Turn provisioning off by setting `ALLOW_STAFF_ACCOUNT_PROVISIONING=false`. Keep the CSV private and never commit it.

The preset logins are `admin@hos.org`, `communications@hos.org`, `secretariat@hos.org`, `volunteers@hos.org`, `finance@hos.org`, `programs@hos.org`, `caseworker@hos.org`, `fundraising@hos.org`, and `events@hos.org`. The Advocacy team is Kelvin Izibyose (Dancer) and Uwase Shiffa (MC). These are shared team accounts: everyone on a team uses the same login and password. Therefore audit records cannot identify which person made a change, and anyone who leaves the team requires a password rotation. The `@hos.org` address must be an email domain the organization controls if email-based recovery is expected; Auth email confirmation is set by the provisioning tool, but password recovery emails require working Supabase SMTP configuration.

After applying the Advocacy migration, create or provision the `events@hos.org` Auth user with the password supplied by the organization and assign its Auth user ID the `advocacy_lead` role. Keep the password in Supabase Auth or the ignored local provisioning CSV only; never put it in source code. Deploy the updated `admin-manage-staff` Edge Function so the new account appears in the Admin staff list and can be managed there.

To rotate a portal password, temporarily turn provisioning on, enter the new password in that portal's CSV row, and run `npm run staff:password -- communications@hos.org` (replace with the portal's login). Clear the password from the CSV and turn provisioning off afterward.

These Auth accounts persist in Supabase after deployment. Vercel must use the same project's `VITE_SUPABASE_URL` and public anon/publishable key. Never add the service-role key or staff CSV to Vercel. Database RLS remains the authorization boundary.

The portal stores sign-in only for the current browser tab and signs out when navigating from an internal portal route to the public site. This is not an inactivity timer; a user who stays on an open portal tab remains signed in until they leave the portal or sign out.

### Create temporary local test accounts

This is an optional local-only script; development accounts are disabled by default.

To automatically create role-specific dashboard test accounts:

1. Set `ALLOW_DEV_ACCOUNTS=true` and `AUTO_GENERATE_DEV_ACCOUNTS=true` in `.env.local`.
2. Set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.
3. Run `npm run seed:dev-accounts`.
4. Open `.dev-accounts.generated.json` locally to retrieve the accounts grouped by workspace. Do not share or commit this file.
5. After testing, set both flags back to `false` and delete the test users in Supabase Auth if they are no longer needed.

The generated roles are admin, communications, secretariat, volunteer_manager, finance, program_manager, case_worker, fundraiser, and advocacy_lead. Generated login emails use short role aliases at `hos.example.com`; passwords are random 12-character values and are stored only in the ignored local credentials file. To rotate existing generated accounts (including their passwords) and add any newly required roles, run `npm run seed:dev-accounts -- --rotate`. This updates the existing generated Auth users and rewrites the credentials grouped by workspace. To seed manually instead, set `AUTO_GENERATE_DEV_ACCOUNTS=false` and define `DEV_ACCOUNTS_JSON` as a JSON array of accounts with `email`, `full_name`, `password` (at least 12 characters), and an allowed `role`.

Verify every generated account's sign-in and database role with `npm run verify:dev-accounts`. It logs role names only, verifies sign-in through Supabase Auth, and revokes each test session afterward.

The script uses the Supabase Auth Admin API from Node, creates/updates the profile and assigns the database role. It refuses to run when `NODE_ENV=production`. Never reuse these test passwords for real accounts. For production, create users in Supabase Auth and assign their roles using a trusted administrator process.

Disable public sign-ups in Supabase Auth settings. Do not place the service-role secret in Vite, client code, `.env.example`, or frontend hosting settings.

## Current database-connected behavior

- Website organization profile, programs, projects, team history, campaigns, published events and announcements, impact metrics, stories, gallery, social links, and public contact details are loaded from Supabase.
- Admin opens to a 30-day analytics dashboard with daily page-view and audited-change lines, communications activity bars, and an audited-work distribution chart. These summarize recorded database events only; page views are not unique visitors, and unaudited actions do not appear.
- Gallery posts can contain multiple images with per-image captions and an uncropped lightbox carousel. Public programs, projects, impact measures, events, and announcements use a connected vertical list with hover/focus descriptions and click-to-read details.
- Authorized staff can copy all confirmed, active newsletter subscriber addresses from the subscriber list. Paste addresses into BCC to preserve subscriber privacy; this copies addresses only and does not send email.
- Published content refreshes over Supabase Realtime after database edits.
- Staff sign-in uses Supabase password authentication and routes to distinct role-specific workspaces. Access remains enforced by database RLS; frontend role checks are not the security boundary.
- The contact and volunteer forms save submissions to Supabase; staff access is controlled by RLS. They do not send emails.
- Public gallery images can be opened in an accessible keyboard-operable lightbox. Authorized staff can create, edit, publish, archive, and upload approved public images.
- Secretariat records export to Word or browser print/Save as PDF. Table exports are CSV files that open in spreadsheet software such as Excel and contain the currently loaded records (up to 250 per search).
- Anonymous public page views are recorded without IP address or country. Admin audit history and workspace summaries are database-backed.
- The SQL schema tracks donations but does not implement payment checkout/provider verification. Campaign amounts must be based on organization-recorded donations.

The local website needs `.env.local` and the migration above before those features can connect. The database migration must be executed in your Supabase project; it cannot be applied from this repository alone.

## Production hardening still required

- Add a deployed server-side/Edge Function with rate limiting and bot protection for public contact and volunteer submissions before opening the forms to the internet. RLS validates rows but is not a request-rate limiter.
- Configure a trusted email provider and server-side confirmation/delivery flow before treating newsletter subscriptions or notification flags as email delivery.
- Choose and integrate a payment provider using server-side verified webhooks before accepting online payments.
- Review role assignments and safeguarding/privacy retention requirements with the organization before entering real child or family case data.
- Configure deployment secrets in the hosting provider; only the Supabase URL and public anon/publishable key belong in the browser build.
