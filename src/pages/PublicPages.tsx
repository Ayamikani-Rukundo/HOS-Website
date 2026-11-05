import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Heart,
  HeartHandshake,
  Leaf,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { siteConfig } from '../data/site';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { useSiteContent } from '../lib/site-content-context';

const introVision = [
  'Extending quality education to as many vulnerable children as possible.',
  'Providing balanced diets to the ill in public hospitals.',
  'Supporting income-generating opportunities for vulnerable families.',
];
const pageLoadTime = Date.now();

const formatDate = (date: string | null, options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) =>
  date ? new Intl.DateTimeFormat('en', { ...options, timeZone: 'Africa/Kigali' }).format(new Date(date)) : 'Date to be announced';

const formatMoney = (amount: number | null, currency: string) =>
  amount === null ? 'Not set' : `${new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(amount)} ${currency}`;

function PageIntro({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string | null; children?: ReactNode }) {
  return (
    <div className="wrap page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

type PublicListEntry = {
  id: string;
  title: string;
  summary: string;
  details: string;
  meta?: string;
  image?: string | null;
  label?: string;
};

function ConnectedList({ items, onSelect }: { items: PublicListEntry[]; onSelect: (item: PublicListEntry) => void }) {
  return (
    <div className="public-record-list">
      {items.map((item, index) => (
        <button className="public-record-item" type="button" key={item.id} onClick={() => onSelect(item)} data-description={item.details} aria-label={`View details for ${item.title}`}>
          <span className="public-record-marker">{String(index + 1).padStart(2, '0')}</span>
          <span className="public-record-copy">
            {item.label && <span className="card-kicker">{item.label}</span>}
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            {item.meta && <small>{item.meta}</small>}
          </span>
          <ArrowRight className="public-record-arrow" size={17} aria-hidden="true" />
          <span className="public-record-tooltip" role="presentation">{item.details}</span>
        </button>
      ))}
    </div>
  );
}

function PublicDetailDialog({ item, onClose }: { item: PublicListEntry | null; onClose: () => void }) {
  if (!item) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal public-detail-modal" role="dialog" aria-modal="true" aria-labelledby="public-detail-title">
        <div className="modal-header"><div>{item.label && <div className="eyebrow">{item.label}</div>}<h2 id="public-detail-title">{item.title}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close details"><X size={17} /></button></div>
        <div className="modal-body">
          {item.image && <img className="public-detail-image" src={item.image} alt="" />}
          {item.meta && <div className="field-hint">{item.meta}</div>}
          <p className="public-detail-copy">{item.details}</p>
        </div>
      </div>
    </div>
  );
}

function MissionVision({ compact = false }: { compact?: boolean }) {
  const { organization, sections } = useSiteContent();
  const visionContent = sections.about?.content.vision;
  const vision = Array.isArray(visionContent)
    ? visionContent.filter((item): item is string => typeof item === 'string')
    : introVision;

  return (
    <div className={`split-story${compact ? ' compact' : ''}`}>
      <div className="story-illustration" aria-label="Abstract illustration representing growth and community">
        <div className="hero-sprig hero-sprig-one" />
        <HeartHandshake aria-hidden="true" />
      </div>
      <div className="story-copy">
        <div className="eyebrow">The reason behind the work</div>
        <h2>Support should meet the whole family, not just one need.</h2>
        <p>{organization?.mission ?? siteConfig.mission}</p>
        <div className="vision-list">
          {vision.map((item) => <div key={item} className="vision-item"><Check size={16} /> <span>{item}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function ProgramCards({ compact = false }: { compact?: boolean }) {
  const { programs, isLoading } = useSiteContent();
  const shown = compact ? programs.slice(0, 3) : programs;
  const [selectedProgram, setSelectedProgram] = useState<PublicListEntry | null>(null);

  if (isLoading) {
    return <div className="grid grid-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 190 }} />)}</div>;
  }
  if (!shown.length) return <EmptyState>Program details will be shared here once they are added and published by Heart of Sympathy.</EmptyState>;

  const items = shown.map((program, index) => ({
    id: program.id,
    title: program.name,
    summary: program.summary,
    details: [program.description, program.impact && `Focus and impact: ${program.impact}`].filter(Boolean).join('\n\n') || program.summary,
    image: program.cover_image_url,
    label: program.feature_label ?? `Program ${String(index + 1).padStart(2, '0')}`,
  }));
  return (
    <>
      <ConnectedList items={items} onSelect={setSelectedProgram} />
      <PublicDetailDialog item={selectedProgram} onClose={() => setSelectedProgram(null)} />
    </>
  );
}

function CampaignCards({ limit = 3 }: { limit?: number }) {
  const { campaigns, isLoading } = useSiteContent();
  if (isLoading) return <div className="grid grid-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 270 }} />)}</div>;
  const shown = campaigns.slice(0, limit);
  if (!shown.length) return <EmptyState>There are no active public fundraising campaigns at this time. Contact the team to learn about other ways to support the mission.</EmptyState>;

  return (
    <div className="grid grid-3">
      {shown.map((campaign) => {
        const target = Number(campaign.target_amount ?? 0);
        const raised = Number(campaign.raised_amount ?? 0);
        const percent = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : null;
        return (
          <article className="campaign-card" key={campaign.id}>
            {campaign.cover_image_url
              ? <img className="campaign-image" src={campaign.cover_image_url} alt="" loading="lazy" />
              : <div className="campaign-image campaign-art"><HeartHandshake size={33} /></div>}
            <div className="card-body">
              <span className="pill pill-gold">Current campaign</span>
              <h3>{campaign.title}</h3>
              <p>{campaign.description}</p>
              {target > 0 && (
                <>
                  <div className="campaign-progress">
                    <span>Raised <strong>{formatMoney(raised, campaign.currency_code)}</strong></span>
                    <span>Goal <strong>{formatMoney(target, campaign.currency_code)}</strong></span>
                  </div>
                  <div className="progress-track" aria-label={`${percent}% funded`}><div className="progress-value" style={{ width: `${percent}%` }} /></div>
                  <p className="field-hint" style={{ marginTop: 7 }}>{percent}% of goal recorded</p>
                </>
              )}
              <Link to={`/donate${campaign.slug ? `#${campaign.slug}` : ''}`} className="text-link">View giving details <ArrowRight size={14} /></Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function HomePage() {
  const { organization, metrics, projects, stories, events, announcements, gallery, sections, isLoading } = useSiteContent();
  const homeContent = sections.home_hero?.content ?? {};
  const title = sections.home_hero?.title ?? 'A caring community can change a future.';
  const description = typeof homeContent.description === 'string' ? homeContent.description : organization?.mission ?? siteConfig.mission;
  const upcoming = events.filter((event) => event.event_date && new Date(event.event_date).getTime() >= pageLoadTime).slice(0, 2);

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">{typeof homeContent.eyebrow === 'string' ? homeContent.eyebrow : `${organization?.location ?? siteConfig.location} · Since ${organization?.founded_year ?? siteConfig.founded}`}</div>
            <h1>{title.split(' ').map((word, index) => {
              const highlight = ['future.', 'together.', 'family.'].includes(word.toLowerCase());
              return <span key={`${word}-${index}`}>{index > 0 ? ' ' : ''}{highlight ? <em>{word}</em> : word}</span>;
            })}</h1>
            <p>{description}</p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/programs">Explore our work <ArrowRight size={15} /></Link>
              <Link className="button button-outline" to="/donate">Ways to give <ArrowUpRight size={14} /></Link>
            </div>
            <div className="hero-note"><MapPin size={15} /> Community-led action rooted in {organization?.location ?? siteConfig.location}</div>
          </div>
          <div className="hero-art" aria-label="Heart of Sympathy logo and abstract nature-inspired design">
            <div className="hero-art-orbit" />
            <div className="hero-sprig hero-sprig-one" />
            <div className="hero-sprig hero-sprig-two" />
            <div className="hero-logo-card"><img src="/hos-logo.png" alt="Heart of Sympathy — Bridge Them To The Future" /></div>
            <div className="hero-caption"><Heart size={16} /><span><strong>Our promise</strong>Compassion with dignity</span></div>
          </div>
        </div>
      </section>

      <section className="wrap intro-band">
        <div className="intro-mark"><Leaf size={29} strokeWidth={1.2} /><span>Beyond school fees</span></div>
        <p>Education, nutrition, health, mentorship and family stability are connected. Our support is designed to see the child in the context of the family.</p>
      </section>

      <section className="wrap section">
        <div className="section-heading">
          <div className="eyebrow">What guides us</div>
          <h2>Care that responds to real life.</h2>
          <p>{organization?.mission ?? siteConfig.mission}</p>
        </div>
        <MissionVision compact />
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading">
            <div className="eyebrow">Programs</div>
            <h2>Practical pathways to a stronger future.</h2>
            <p>From education and nutritious meals to healthcare, safe homes and mentorship, our program information is published as the organization confirms it.</p>
          </div>
          <ProgramCards compact />
          <Link className="text-link" to="/programs">See all programs <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="wrap section">
        <div className="section-heading">
          <div className="eyebrow">Verified impact</div>
          <h2>Progress worth measuring, shared with care.</h2>
          <p>We publish impact figures only after they have been reviewed by the organization.</p>
        </div>
        {metrics.length > 0
          ? <div className="grid grid-4">{metrics.slice(0, 4).map((metric) => <div className="stat-card" key={metric.id}><div className="stat-value">{metric.value}</div><div className="stat-label">{metric.label}</div>{metric.description && <p className="field-hint">{metric.description}</p>}</div>)}</div>
          : <div className="stat-card stat-placeholder">Verified impact measures will appear here when the team publishes them.</div>}
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">Join the effort</div><h2>Support a priority the organization is working on now.</h2><p>Campaign targets and progress come from organization records. No payment is taken on this website yet.</p></div>
          <CampaignCards />
        </div>
      </section>

      <section className="wrap section">
        <div className="split-story">
          <div className="story-copy">
            <div className="eyebrow">Projects in practice</div>
            <h2>Community-led action, one project at a time.</h2>
            <p>See the projects the organization has chosen to publish, including their locations, timelines and reported outcomes.</p>
            <Link to="/projects" className="button button-outline">View projects <ArrowRight size={14} /></Link>
          </div>
          <div className="grid">
            {projects.slice(0, 2).map((project) => (
              <article className="content-card" key={project.id} style={{ padding: 19 }}>
                <span className="pill pill-green">{project.status}</span>
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <div className="list-meta">{project.location ?? 'Rwanda'} · {formatDate(project.start_date, { year: 'numeric', month: 'short' })}</div>
              </article>
            ))}
            {!isLoading && projects.length === 0 && <EmptyState>Projects will be featured as they are approved for publication.</EmptyState>}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">Community voices</div><h2>Stories shared with dignity.</h2><p>Personal stories appear only with appropriate consent and approval.</p></div>
          {stories.length > 0
            ? <div className="grid grid-3">{stories.slice(0, 3).map((story) => <article className="story-card content-card" key={story.id} style={{ padding: 22 }}><Sparkles size={18} color="var(--gold)" /><h3>{story.title}</h3><p>{story.summary}</p></article>)}</div>
            : <EmptyState>Approved community stories will appear here. No personal story has been published yet.</EmptyState>}
        </div>
      </section>

      <section className="wrap section">
        <div className="section-heading"><div className="eyebrow">Gathering together</div><h2>Events and updates from our community.</h2></div>
        <div className="grid grid-2">
          <div className="panel">
            <div className="panel-heading"><h3>Upcoming events</h3><Link to="/events" className="text-link">All events <ArrowRight size={13} /></Link></div>
            {upcoming.length > 0 ? upcoming.map((event) => <div className="event-row" key={event.id} style={{ marginTop: 13 }}><div className="event-date-block"><div className="event-date-day">{new Date(event.event_date!).toLocaleDateString('en', { day: '2-digit', timeZone: 'Africa/Kigali' })}</div><div className="event-date-month">{new Date(event.event_date!).toLocaleDateString('en', { month: 'short', timeZone: 'Africa/Kigali' })}</div></div><div><h3 style={{ margin: '3px 0 7px', fontSize: '1.1rem' }}>{event.title}</h3><p className="field-hint">{event.location ?? 'Location to be announced'}</p></div></div>) : <p className="field-hint">No upcoming events have been published.</p>}
          </div>
          <div className="panel">
            <div className="panel-heading"><h3>Latest announcements</h3><Link to="/events" className="text-link">Updates <ArrowRight size={13} /></Link></div>
            {announcements.slice(0, 2).map((notice) => <div className="list-row" key={notice.id}><div><div className="list-title">{notice.title}</div><div className="list-meta">{formatDate(notice.published_at)}</div></div><ArrowUpRight size={15} color="var(--gold)" /></div>)}
            {!isLoading && announcements.length === 0 && <p className="field-hint">No announcements have been published yet.</p>}
          </div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
          <div className="wrap">
            <div className="section-heading"><div className="eyebrow">Moments & places</div><h2>Community work, seen through the lens of consent.</h2></div>
            <div className="gallery-grid">{gallery.slice(0, 4).map((image) => <Link className="gallery-item" key={image.id} to="/gallery"><img src={image.image_url} alt={image.alt_text ?? 'Heart of Sympathy community photograph'} loading="lazy" /><div className="gallery-overlay">{image.caption ?? image.collection_name}</div></Link>)}</div>
            <Link to="/gallery" className="text-link">Visit the gallery <ArrowRight size={14} /></Link>
          </div>
        </section>
      )}

      <section className="wrap section-tight">
        <div className="donate-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 650 }}><div className="eyebrow">Be part of the bridge</div><h2>Offer support that strengthens a family’s next step.</h2><p>Learn about current campaigns, volunteer, or start a conversation with our team.</p></div>
          <div className="hero-actions" style={{ margin: 0 }}><Link to="/donate" className="button button-primary">Ways to give <ArrowRight size={14} /></Link><Link to="/contact" className="button button-outline">Talk with us <MessageCircle size={14} /></Link></div>
        </div>
      </section>

    </>
  );
}

export function AboutPage() {
  const { organization, sections } = useSiteContent();
  const biography = typeof sections.about?.content.intro === 'string'
    ? sections.about.content.intro
    : `${organization?.name ?? siteConfig.name} is a youth-led nonprofit based in ${organization?.location ?? siteConfig.location}.`;

  return (
    <>
      <PageIntro eyebrow="About Heart of Sympathy" title={sections.about?.title ?? 'A wider circle of care'} description={biography} />
      <section className="wrap section-tight"><MissionVision /></section>
      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">What shapes our work</div><h2>Support rooted in dignity and practical care.</h2></div>
          <div className="grid grid-3">
            {[
              { title: 'Education that can continue', text: 'Support for educational needs recognizes that school participation is affected by health, nutrition and household stability.', icon: <BadgeCheck /> },
              { title: 'Health and nourishment', text: 'Health insurance support, healthy meals and care referrals address needs that families should not have to face alone.', icon: <Heart /> },
              { title: 'Resilient families', text: 'Mentorship, sanitation materials, clothing and emergency help can strengthen the conditions around a child.', icon: <UsersRound /> },
            ].map((item) => <article className="program-card" key={item.title}><div className="card-kicker">{item.icon}</div><h3>{item.title}</h3><p>{item.text}</p></article>)}
          </div>
        </div>
      </section>
    </>
  );
}

export function TeamPage() {
  const { teamYears, isLoading } = useSiteContent();
  const [selectedYear, setSelectedYear] = useState('');
  const activeYear = teamYears.find((year) => year.id === selectedYear) ?? teamYears[0];

  return (
    <>
      <PageIntro eyebrow="People behind the mission" title="Meet the team." description="Explore current and historical teams. Only approved names and biographies are displayed." />
      <section className="wrap section-tight">
        {teamYears.length > 0 && (
          <div className="filter-row" aria-label="Select team year">
            {teamYears.map((year) => (
              <button key={year.id} type="button" className={`button ${activeYear?.id === year.id ? 'button-primary' : 'button-outline'} button-small`} onClick={() => setSelectedYear(year.id)} aria-pressed={activeYear?.id === year.id}>
                {year.year_label}
              </button>
            ))}
          </div>
        )}
        {activeYear && activeYear.members.length > 0
          ? <div className="grid grid-3">{activeYear.members.map((member) => <article className="member-card" key={member.id} style={{ overflow: 'hidden' }}>{member.avatar_url ? <img className="media-image" src={member.avatar_url} alt={member.full_name} loading="lazy" /> : <div className="member-initials">{member.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</div>}<div style={{ padding: 18 }}><div className="card-kicker">{member.role_title ?? 'Team member'}</div><h3 style={{ margin: '8px 0' }}>{member.full_name}</h3>{member.focus_area && <p className="field-hint">{member.focus_area}</p>}{member.biography && <p style={{ marginTop: 10, color: 'var(--muted)', lineHeight: 1.6 }}>{member.biography}</p>}</div></article>)}</div>
          : <EmptyState>{isLoading ? 'Loading the published team…' : 'No team members have been published for this year yet.'}</EmptyState>}
      </section>
    </>
  );
}

export function ProgramsPage() {
  const { programs, isLoading } = useSiteContent();
  const [selectedProgram, setSelectedProgram] = useState<PublicListEntry | null>(null);
  return (
    <>
      <PageIntro eyebrow="Programs" title="Care that follows the whole journey." description="Our programs respond to connected family needs. Details are kept current by the organization’s team." />
      <section className="wrap section-tight">
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading programs…</div> : programs.length > 0
          ? <ConnectedList items={programs.map((program) => ({ id: program.id, title: program.name, summary: program.summary, details: [program.description, program.impact && `Focus and impact: ${program.impact}`].filter(Boolean).join('\n\n') || program.summary, image: program.cover_image_url, label: program.feature_label ?? 'Program' }))} onSelect={setSelectedProgram} />
          : <EmptyState>No program details have been published yet.</EmptyState>}
      </section>
      <section className="wrap section-tight"><div className="callout"><div className="eyebrow">A connected approach</div><h2>Children do better when their families can thrive.</h2><p>Education, nutrition, healthcare, safe homes and mentorship reinforce one another. We work with families and communities to understand what support is useful.</p><Link className="button button-outline" to="/contact">Talk to the team <ArrowRight size={14} /></Link></div></section>
      <PublicDetailDialog item={selectedProgram} onClose={() => setSelectedProgram(null)} />
    </>
  );
}

export function ProjectsPage() {
  const { projects, programs, isLoading } = useSiteContent();
  const [selectedProject, setSelectedProject] = useState<PublicListEntry | null>(null);
  const projectItems = projects.map((project) => {
    const program = programs.find((item) => item.id === project.program_id);
    return {
      id: project.id,
      title: project.title,
      summary: project.description ?? project.outcome_summary ?? 'Project details have not been added yet.',
      details: [project.description, project.outcome_summary && `Recorded outcome: ${project.outcome_summary}`, `Status: ${project.status}`, program && `Program: ${program.name}`].filter(Boolean).join('\n\n'),
      image: project.cover_image_url,
      label: program?.name ?? project.status,
      meta: [project.location, project.start_date && formatDate(project.start_date, { year: 'numeric', month: 'short' })].filter(Boolean).join(' · '),
    };
  });
  return (
    <>
      <PageIntro eyebrow="Projects & impact" title="Work in motion, outcomes reported honestly." description="Explore published projects, their program connections and the progress the team has recorded. Unverified results are not displayed." />
      <section className="wrap section-tight">
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading projects…</div> : projectItems.length > 0 ? <ConnectedList items={projectItems} onSelect={setSelectedProject} /> : <EmptyState>No projects have been approved for publication. Project outcomes will be added when recorded.</EmptyState>}
      </section>
      <section className="wrap section-tight">
        <div className="section-heading"><div className="eyebrow">Measured, not invented</div><h2>Impact in the organization’s own numbers.</h2></div>
        {projectItems.filter((project) => project.details.includes('Recorded outcome:')).length === 0 ? <EmptyState>Project activity and outcomes are not yet available to report publicly.</EmptyState> : <ConnectedList items={projectItems.filter((project) => project.details.includes('Recorded outcome:'))} onSelect={setSelectedProject} />}
      </section>
      <PublicDetailDialog item={selectedProject} onClose={() => setSelectedProject(null)} />
    </>
  );
}

export function ImpactPage() {
  const { metrics, projects, stories } = useSiteContent();
  const [selectedImpact, setSelectedImpact] = useState<PublicListEntry | null>(null);
  const impactItems = metrics.map((metric) => ({ id: metric.id, title: `${metric.value} ${metric.label}`, summary: metric.description ?? 'A verified organization-reported measure.', details: metric.description ?? `${metric.value} ${metric.label}`, label: 'Verified measure' }));
  const outcomeItems = projects.filter((project) => project.outcome_summary).map((project) => ({
    id: project.id,
    title: project.title,
    summary: project.outcome_summary ?? '',
    details: [project.description, project.outcome_summary].filter(Boolean).join('\n\n'),
    label: project.status,
  }));
  const storyItems = stories.map((story) => ({ id: story.id, title: story.title, summary: story.summary, details: story.story ?? story.summary, image: story.image_url, label: 'Community story' }));
  return (
    <>
      <PageIntro eyebrow="Our impact" title="Evidence and stories with people at the centre." description="Impact belongs to the families and communities. We share only reviewed figures and stories approved for public use." />
      <section className="wrap section-tight">
        {metrics.length > 0 ? <ConnectedList items={impactItems} onSelect={setSelectedImpact} /> : <EmptyState>Verified impact numbers have not been published yet. We will not substitute estimates.</EmptyState>}
      </section>
      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}><div className="wrap"><div className="section-heading"><div className="eyebrow">Projects</div><h2>Activity and outcomes.</h2><p>Projects with a recorded outcome are shown below.</p></div>{outcomeItems.length > 0 ? <ConnectedList items={outcomeItems} onSelect={setSelectedImpact} /> : <EmptyState>No project outcomes have been recorded for public reporting.</EmptyState>}</div></section>
      <section className="wrap section"><div className="section-heading"><div className="eyebrow">Stories of resilience</div><h2>Shared with consent, told with respect.</h2></div>{storyItems.length > 0 ? <ConnectedList items={storyItems} onSelect={setSelectedImpact} /> : <EmptyState>No approved community stories have been published.</EmptyState>}</section>
      <PublicDetailDialog item={selectedImpact} onClose={() => setSelectedImpact(null)} />
    </>
  );
}

export function GalleryPage() {
  const { gallery, isLoading } = useSiteContent();
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedSlide, setSelectedSlide] = useState(0);
  const [collection, setCollection] = useState('All');
  const collections = useMemo(() => ['All', ...new Set(gallery.map((image) => image.collection_name).filter((value): value is string => Boolean(value)))], [gallery]);
  const images = collection === 'All' ? gallery : gallery.filter((image) => image.collection_name === collection);
  const post = selected === null ? null : images[selected] ?? null;
  const slides = post?.additional_images.length ? post.additional_images : post ? [{ url: post.image_url, caption: '' }] : [];
  const currentSlide = slides[selectedSlide] ?? slides[0];

  useEffect(() => {
    if (selected === null) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'ArrowLeft') setSelectedSlide((current) => (current - 1 + slides.length) % slides.length);
      if (event.key === 'ArrowRight') setSelectedSlide((current) => (current + 1) % slides.length);
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [selected, slides.length]);

  return (
    <>
      <PageIntro eyebrow="Gallery" title="Moments from our community." description="Photographs and captions are published by the team and shown with the context they provide." />
      <section className="wrap section-tight">
        {collections.length > 1 && <div className="filter-row">{collections.map((name) => <button type="button" className={`button button-small ${collection === name ? 'button-primary' : 'button-outline'}`} key={name} onClick={() => setCollection(name)}>{name}</button>)}</div>}
        {isLoading ? <div className="grid grid-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 210 }} />)}</div> : images.length > 0 ? <div className="gallery-grid">{images.map((image, index) => {
          const cover = image.additional_images[0]?.url ?? image.image_url;
          const photoCount = image.additional_images.length || 1;
          return <button type="button" className="gallery-item" key={image.id} onClick={() => { setSelected(index); setSelectedSlide(0); }} aria-label={`Open ${image.title ?? image.caption ?? 'gallery post'} with ${photoCount} photo${photoCount === 1 ? '' : 's'}`}><img src={cover} alt={image.alt_text ?? image.caption ?? 'Heart of Sympathy community'} loading="lazy" /><span className="gallery-overlay"><strong>{image.title ?? image.caption ?? 'Community moments'}</strong><span>{image.description ?? ''}</span>{photoCount > 1 && <small>{photoCount} photos · open to view</small>}</span></button>;
        })}</div> : <EmptyState>No photographs are published in this collection yet.</EmptyState>}
      </section>
      {post && currentSlide && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={post.title ?? post.caption ?? 'Gallery post'} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="lightbox-inner">
            <button type="button" className="icon-button lightbox-close" onClick={() => setSelected(null)} aria-label="Close image"><X size={19} /></button>
            <img className="lightbox-image" src={currentSlide.url} alt={currentSlide.caption || post.alt_text || post.title || ''} />
            <div className="lightbox-caption"><strong>{post.title ?? post.caption ?? 'Community moments'}</strong><div>{currentSlide.caption || post.description || post.caption}</div>{post.activity_date && <div className="field-hint">{formatDate(post.activity_date)}</div>}{slides.length > 1 && <div className="field-hint">{selectedSlide + 1} of {slides.length}</div>}</div>
            {slides.length > 1 && <div className="lightbox-controls"><button type="button" className="icon-button" onClick={() => setSelectedSlide((selectedSlide - 1 + slides.length) % slides.length)} aria-label="Previous image"><ChevronLeft /></button><button type="button" className="icon-button" onClick={() => setSelectedSlide((selectedSlide + 1) % slides.length)} aria-label="Next image"><ChevronRight /></button></div>}
          </div>
        </div>
      )}
    </>
  );
}

export function EventsPage() {
  const { events, announcements, isLoading } = useSiteContent();
  const [eventId, setEventId] = useState<string | null>(null);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<PublicListEntry | null>(null);
  const selectedEvent = events.find((event) => event.id === eventId);
  const timeline = [...events].sort((a, b) => new Date(b.event_date ?? 0).getTime() - new Date(a.event_date ?? 0).getTime());
  const announcementItems = announcements.map((announcement) => ({ id: announcement.id, title: announcement.title, summary: announcement.body, details: announcement.body, image: announcement.cover_image_url, label: formatDate(announcement.published_at) }));
  return (
    <>
      <PageIntro eyebrow="Events & announcements" title="Stay close to what’s happening." description="Upcoming gatherings, past activities and official updates, ordered by their actual dates." />
      <section className="wrap section-tight">
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading published updates…</div> : timeline.length > 0 ? <div className="timeline">{timeline.map((event) => <button type="button" className="timeline-item event-timeline-button" key={event.id} onClick={() => setEventId(event.id)} data-description={event.summary ?? ''}><time>{formatDate(event.event_date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</time><h3>{event.title}</h3><p>{event.summary}</p><div className="event-meta"><span><MapPin size={13} /> {event.location ?? 'Location to be announced'}</span>{event.starts_at && <span><Clock3 size={13} /> {new Date(event.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })} CAT</span>}</div><span className="text-link">View details <ArrowRight size={13} /></span></button>)}</div> : <EmptyState>No public events have been published yet.</EmptyState>}
      </section>
      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap"><div className="section-heading"><div className="eyebrow">Announcements</div><h2>Notes from the organization.</h2></div>{announcementItems.length > 0 ? <ConnectedList items={announcementItems} onSelect={setSelectedAnnouncement} /> : <EmptyState>No announcements have been published.</EmptyState>}</div>
      </section>
      {selectedEvent && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEventId(null); }}><div className="modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><div className="modal-header"><h2 id="event-modal-title">{selectedEvent.title}</h2><button className="icon-button" type="button" onClick={() => setEventId(null)} aria-label="Close event details"><X size={17} /></button></div><div className="modal-body">{(selectedEvent.cover_image_url ?? selectedEvent.image_url) && <img className="event-modal-image" src={selectedEvent.cover_image_url ?? selectedEvent.image_url ?? ''} alt="" />}<div className="event-meta"><span><CalendarDays size={15} /> {formatDate(selectedEvent.event_date, { dateStyle: 'full' })}</span><span><MapPin size={15} /> {selectedEvent.location ?? 'Location to be announced'}</span></div><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedEvent.summary}</p>{selectedEvent.starts_at && <p><Clock3 size={14} /> {new Date(selectedEvent.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })}{selectedEvent.ends_at ? ` – ${new Date(selectedEvent.ends_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })}` : ''} CAT</p>}{selectedEvent.registration_url && <a className="button button-primary" href={selectedEvent.registration_url} target="_blank" rel="noreferrer">Registration details <ArrowUpRight size={14} /></a>}</div></div></div>}
      <PublicDetailDialog item={selectedAnnouncement} onClose={() => setSelectedAnnouncement(null)} />
    </>
  );
}

export function DonatePage() {
  const { campaigns, campaignCategories, contactDetails, organization, sections, isLoading } = useSiteContent();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const displayedCampaigns = selectedCategory === 'All'
    ? campaigns
    : campaigns.filter((campaign) => campaign.category_id === selectedCategory);

  return (
    <>
      <PageIntro eyebrow="Giving & partnership" title={sections.donate?.title ?? 'A thoughtful way to give.'} description={typeof sections.donate?.content.intro === 'string' ? sections.donate.content.intro : 'Support published campaigns or speak with our team about giving methods that are currently available. This site does not process payments.'}>
        <div className="notice" style={{ maxWidth: 780, marginTop: 19 }}><ShieldCheck size={17} /><span>We do not collect payment details here. Campaign totals reflect organization-recorded donations only. A secure online payment provider has not been configured.</span></div>
      </PageIntro>
      <section className="wrap section-tight">
        <div className="section-heading"><div className="eyebrow">Current campaigns</div><h2>Choose an area of support.</h2><p>Campaign targets, currencies and giving instructions are maintained by authorized staff.</p></div>
        {campaignCategories.length > 0 && <div className="filter-row"><button type="button" className={`button button-small ${selectedCategory === 'All' ? 'button-primary' : 'button-outline'}`} onClick={() => setSelectedCategory('All')}>All areas</button>{campaignCategories.map((category) => <button type="button" className={`button button-small ${selectedCategory === category.id ? 'button-primary' : 'button-outline'}`} key={category.id} onClick={() => setSelectedCategory(category.id)}>{category.name}</button>)}</div>}
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading campaigns…</div> : displayedCampaigns.length > 0 ? <div className="grid grid-2">{displayedCampaigns.map((campaign) => {
          const category = campaignCategories.find((item) => item.id === campaign.category_id);
          const goal = Number(campaign.target_amount ?? 0);
          const raised = Number(campaign.raised_amount ?? 0);
          const progress = goal > 0 ? Math.min(100, Math.round(raised / goal * 100)) : 0;
          return <article id={campaign.slug ?? campaign.id} className="content-card donation-campaign" key={campaign.id}>{campaign.cover_image_url && <img className="media-image" src={campaign.cover_image_url} alt="" loading="lazy" />}<div style={{ padding: 22 }}><div className="card-kicker">{category?.name ?? 'Giving campaign'}</div><h2>{campaign.title}</h2><p>{campaign.description}</p><div className="campaign-amounts"><span>Raised<strong>{formatMoney(raised, campaign.currency_code)}</strong></span><span>Goal<strong>{goal > 0 ? formatMoney(goal, campaign.currency_code) : 'Not specified'}</strong></span></div>{goal > 0 && <><div className="progress-line"><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div><span className="pill pill-gold">{progress}%</span></div><p className="field-hint" style={{ marginTop: 8 }}>Progress is based on donations recorded by the organization.</p></>}{campaign.suggested_amounts.length > 0 && <div className="suggested-list"><span className="field-label">Suggested amounts (guide only)</span><div className="filter-row" style={{ margin: '8px 0 0' }}>{campaign.suggested_amounts.map((amount) => <span className="pill" key={amount}>{formatMoney(amount, campaign.currency_code)}</span>)}</div></div>}<div className="donation-instructions"><div className="field-label">How to give</div><p>{campaign.donation_instructions || 'Contact the organization to confirm available giving methods and instructions.'}</p>{campaign.payment_methods.length > 0 && <div className="filter-row">{campaign.payment_methods.map((method) => <span key={method} className="pill">{method}</span>)}</div>}<Link className="button button-outline" to="/contact">Ask about this campaign <ArrowRight size={14} /></Link></div></div></article>;
        })}</div> : <EmptyState>{campaigns.length === 0 ? 'There are no active campaigns right now. You can contact the organization to ask about other ways to help.' : 'No campaigns are published for this category.'}</EmptyState>}
      </section>
      {campaignCategories.length > 0 && <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}><div className="wrap"><div className="section-heading"><div className="eyebrow">Areas of giving</div><h2>Support can meet many kinds of need.</h2></div><div className="grid grid-4">{campaignCategories.map((category) => <article className="program-card giving-category" key={category.id}><div className="card-kicker"><Heart size={17} /></div><h3>{category.name}</h3><p>{category.description}</p></article>)}</div></div></section>}
      <section className="wrap section-tight"><div className="callout"><div className="eyebrow">Need verified giving details?</div><h2>Talk to the organization before sending funds.</h2><p>Reach out through an official contact listed by Heart of Sympathy. Do not send sensitive payment information through this website.</p><div className="hero-actions"><Link className="button button-primary" to="/contact">Contact us <ArrowRight size={14} /></Link>{organization?.email && <a className="button button-outline" href={`mailto:${organization.email}`}>Email the organization <Mail size={14} /></a>}{contactDetails.find((detail) => detail.category === 'donations') && <span className="field-hint">Donation contact details are available on our contact page.</span>}</div></div></section>
    </>
  );
}

export function ContactPage() {
  const { organization, contactDetails, socialLinks, sections } = useSiteContent();
  const [formState, setFormState] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormState(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (String(formData.get('website') ?? '').trim()) return;

    setBusy(true);
    try {
      const { error } = await getSupabaseClient().from('contact_messages').insert({
        full_name: String(formData.get('full_name') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim().toLowerCase(),
        subject: String(formData.get('subject') ?? '').trim(),
        message: String(formData.get('message') ?? '').trim(),
        status: 'new',
        assigned_to: null,
      });
      if (error) throw error;
      form.reset();
      setFormState({ message: 'Your message has been recorded for the organization. No email was sent automatically.', type: 'success' });
    } catch (error) {
      setFormState({ message: error instanceof Error ? `We could not record the message: ${error.message}` : 'We could not record the message. Please try again later.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const details = contactDetails.filter((item) => item.is_public);
  const location = organization?.location ?? siteConfig.location;
  const mapUrl = `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;

  return (
    <>
      <PageIntro eyebrow="Contact" title={sections.contact?.title ?? 'Let’s start a conversation.'} description={typeof sections.contact?.content.intro === 'string' ? sections.contact.content.intro : 'Questions about our work, opportunities to partner, or ways to help? Reach out and our team will follow up.'} />
      <section className="wrap section-tight">
        <div className="contact-grid">
          <div>
            <div className="section-heading"><div className="eyebrow">Find our team</div><h2 style={{ fontSize: '2rem' }}>We’re based in Kigali.</h2><p>Contact details shown here are managed by the organization.</p></div>
            <div className="contact-list">
              {details.map((item) => <div className="contact-line" key={item.id}>{item.category === 'email' ? <Mail size={17} /> : item.category === 'phone' ? <MessageCircle size={17} /> : <MapPin size={17} />}<span>{item.label}<br /><strong>{item.value}</strong></span></div>)}
              {organization?.email && <div className="contact-line"><Mail size={17} /><span>Email<br /><a href={`mailto:${organization.email}`}><strong>{organization.email}</strong></a></span></div>}
              {organization?.phone && <div className="contact-line"><MessageCircle size={17} /><span>Phone<br /><a href={`tel:${organization.phone}`}><strong>{organization.phone}</strong></a></span></div>}
              <div className="contact-line"><MapPin size={17} /><span>Location<br /><strong>{location}</strong></span></div>
            </div>
            {socialLinks.length > 0 && <div className="social-list">{socialLinks.map((social) => <a className="button button-outline button-small" key={social.id} href={social.url} target="_blank" rel="noreferrer">{social.platform} <ArrowUpRight size={12} /></a>)}</div>}
            <div className="map-panel"><div className="map-content"><MapPin size={25} /><strong>{location}</strong><a className="text-link" href={mapUrl} target="_blank" rel="noreferrer">Open map <ArrowUpRight size={13} /></a></div></div>
          </div>
          <div className="panel contact-form-panel">
            <div className="panel-heading"><div><h2>Send a message</h2><p>Your message is stored for authorized staff to review.</p></div><MessageCircle size={18} color="var(--gold)" /></div>
            <form className="record-form" onSubmit={(event) => void handleSubmit(event)}>
              <div className="honeypot"><label htmlFor="contact-website">Website</label><input id="contact-website" name="website" tabIndex={-1} autoComplete="off" /></div>
              <div className="form-grid">
                <label className="field"><span className="field-label">Your name</span><input className="input" name="full_name" required minLength={2} maxLength={120} autoComplete="name" /></label>
                <label className="field"><span className="field-label">Email</span><input className="input" type="email" name="email" required maxLength={254} autoComplete="email" /></label>
                <label className="field field-span"><span className="field-label">Subject</span><input className="input" name="subject" required minLength={2} maxLength={180} /></label>
                <label className="field field-span"><span className="field-label">Message</span><textarea className="textarea" name="message" required minLength={10} maxLength={5000} rows={6} /></label>
              </div>
              {formState && <div role={formState.type === 'error' ? 'alert' : 'status'} className={`form-message ${formState.type}`}>{formState.message}</div>}
              <button className="button button-primary" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Recording…' : 'Send message'} <ArrowRight size={14} /></button>
              {!isSupabaseConfigured && <div className="form-message error">The contact form is unavailable until Supabase is configured.</div>}
            </form>
          </div>
        </div>
      </section>
      <section className="wrap section-tight"><VolunteerForm /></section>
      <section className="wrap section-tight"><NewsletterForm compact /></section>
    </>
  );
}

function VolunteerForm() {
  const [state, setState] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [busy, setBusy] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      const { error } = await getSupabaseClient().from('volunteer_applications').insert({
        full_name: String(data.get('full_name') ?? '').trim(),
        email: String(data.get('email') ?? '').trim().toLowerCase(),
        phone: String(data.get('phone') ?? '').trim() || null,
        interests: String(data.get('interests') ?? '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 8),
        availability: String(data.get('availability') ?? '').trim() || null,
        message: String(data.get('message') ?? '').trim() || null,
        status: 'new',
        assigned_to: null,
      });
      if (error) throw error;
      form.reset();
      setState({ message: 'Your volunteer application has been saved. A team member can review it in the volunteer workspace.', type: 'success' });
    } catch (error) {
      setState({ message: error instanceof Error ? `Application not saved: ${error.message}` : 'Application not saved. Please try again.', type: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="donate-panel volunteer-panel">
      <div><div className="eyebrow">Volunteer with us</div><h2>Share your time and skills.</h2><p>Tell us a little about how you would like to contribute. This form does not create an account or promise a placement.</p></div>
      <form className="record-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-grid">
          <label className="field"><span className="field-label">Full name</span><input className="input" name="full_name" required minLength={2} maxLength={120} /></label>
          <label className="field"><span className="field-label">Email</span><input className="input" name="email" type="email" required maxLength={254} /></label>
          <label className="field"><span className="field-label">Phone (optional)</span><input className="input" name="phone" maxLength={40} /></label>
          <label className="field"><span className="field-label">Availability</span><input className="input" name="availability" maxLength={150} /></label>
          <label className="field field-span"><span className="field-label">Interests (comma separated)</span><input className="input" name="interests" maxLength={500} placeholder="Mentorship, events, translation…" /></label>
          <label className="field field-span"><span className="field-label">A short introduction (optional)</span><textarea className="textarea" name="message" maxLength={3000} rows={3} /></label>
        </div>
        {state && <div role={state.type === 'error' ? 'alert' : 'status'} className={`form-message ${state.type}`}>{state.message}</div>}
        <button className="button button-primary" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Submitting…' : 'Submit interest'} <ArrowRight size={14} /></button>
      </form>
    </div>
  );
}

async function digestToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function NewsletterForm({ compact = false }: { compact?: boolean }) {
  const { pathname } = useLocation();
  const [email, setEmail] = useState('');
  const [consented, setConsented] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string; unsubscribeUrl?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    if (!isSupabaseConfigured) {
      setNotice({ type: 'error', text: 'Newsletter signup is unavailable until Supabase is configured.' });
      return;
    }
    setBusy(true);
    try {
      const token = crypto.randomUUID() + crypto.randomUUID();
      const tokenHash = await digestToken(token);
      const { data, error } = await getSupabaseClient().rpc('subscribe_newsletter', {
        p_email: email.trim().toLowerCase(),
        p_token_hash: tokenHash,
        p_source: pathname,
        p_consented: consented,
      });
      if (error) throw error;
      if (data !== true) throw new Error('The address or subscription details were not accepted.');
      const unsubscribeUrl = `${window.location.origin}/unsubscribe?token=${encodeURIComponent(token)}`;
      setNotice({
        type: 'success',
        text: 'Your email has been saved. Email confirmation is not configured, so no message was sent. Keep this local unsubscribe link if you want to remove the address later.',
        unsubscribeUrl,
      });
      setEmail('');
      setConsented(false);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? `Subscription not saved: ${error.message}` : 'Subscription not saved. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`newsletter-panel${compact ? ' newsletter-panel-compact' : ''}`}>
      <div><div className="eyebrow">Updates, thoughtfully sent</div><h2>{compact ? 'News and notes from our community.' : 'Occasional news from Heart of Sympathy.'}</h2><p>Subscribe for public program, event and organization updates. We never display subscriber addresses publicly.</p></div>
      <div>
        <form className="newsletter-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="inline-form">
            <input className="input" type="email" required maxLength={254} autoComplete="email" placeholder="Your email address" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="button button-primary" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Saving…' : 'Subscribe'}</button>
          </div>
          <label className="newsletter-consent"><input type="checkbox" required checked={consented} onChange={(event) => setConsented(event.target.checked)} /> I agree to receive occasional public updates from Heart of Sympathy. I can unsubscribe at any time.</label>
        </form>
        {notice && <div role={notice.type === 'error' ? 'alert' : 'status'} className={`form-message ${notice.type}`}>{notice.text}{notice.unsubscribeUrl && <p><Link className="text-link" to={`/unsubscribe?token=${encodeURIComponent(new URL(notice.unsubscribeUrl).searchParams.get('token') ?? '')}`}>Unsubscribe this address <ArrowRight size={12} /></Link></p>}</div>}
      </div>
    </div>
  );
}

export function UnsubscribePage() {
  const [params] = useSearchParams();
  const [result, setResult] = useState<{ error: string | null; done: boolean } | null>(null);
  const requestId = useRef(0);
  const token = params.get('token');

  useEffect(() => {
    if (!token || !isSupabaseConfigured) return;
    const currentRequest = ++requestId.current;
    void (async () => {
      try {
        const { data, error } = await getSupabaseClient().rpc('unsubscribe_newsletter', { p_token_hash: await digestToken(token) });
        if (error) throw error;
        if (requestId.current === currentRequest) setResult({
          error: data === true ? null : 'This unsubscribe link is invalid or has already been used.',
          done: data === true,
        });
      } catch (error) {
        if (requestId.current === currentRequest) setResult({ error: error instanceof Error ? error.message : 'Unable to process this unsubscribe request.', done: false });
      }
    })();
    return () => { requestId.current += 1; };
  }, [token]);

  const initialError = !token ? 'This unsubscribe link is incomplete.' : !isSupabaseConfigured ? 'Supabase is not configured on this site.' : null;
  const error = initialError ?? result?.error ?? null;
  const done = result?.done === true;
  return <div className="wrap unsubscribe-page"><div className="login-card"><div className="eyebrow">Newsletter preferences</div><h1>{done ? 'You are unsubscribed.' : error ? 'We could not update that address.' : 'Updating your preference…'}</h1><p>{done ? 'This address will no longer receive Heart of Sympathy updates.' : error ?? 'Please wait while we process your request.'}</p>{error && <div role="alert" className="form-message error">{error}</div>}<Link className="button button-outline" to="/">Return to the website <ArrowLeft size={14} /></Link></div></div>;
}
