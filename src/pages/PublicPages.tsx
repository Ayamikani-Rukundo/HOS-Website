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
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UsersRound,
  X,
} from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { siteConfig } from '../data/site';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { useSiteContent } from '../lib/site-content-context';

const introVision = [
  'Help students continue their education.',
  'Address nutrition and health needs alongside school support.',
  'Include families through mentorship and practical assistance.',
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
        <button className="public-record-item" type="button" key={item.id} onClick={() => onSelect(item)} aria-label={`View details for ${item.title}`}>
          <span className="public-record-marker">{String(index + 1).padStart(2, '0')}</span>
          <span className="public-record-copy">
            {item.label && <span className="card-kicker">{item.label}</span>}
            <strong>{item.title}</strong>
            <span>{item.summary}</span>
            {item.meta && <small>{item.meta}</small>}
          </span>
          <ArrowRight className="public-record-arrow" size={17} aria-hidden="true" />
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
        <h2>Student support includes the needs around the student.</h2>
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
  if (!shown.length) return <EmptyState>There are no published giving areas yet. Please check back soon for current ways to support students.</EmptyState>;

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
              <span className="pill pill-gold">{campaign.category || 'Giving area'}</span>
              <h3>{campaign.title}</h3>
              <p>{campaign.description}</p>
              {target > 0 && (
                <>
                  <div className="campaign-progress">
                    <span>Available <strong>{formatMoney(raised, campaign.currency_code)}</strong></span>
                    <span>Wanted <strong>{formatMoney(target, campaign.currency_code)}</strong></span>
                  </div>
                  <div className="progress-track" aria-label={`${percent}% funded`}><div className="progress-value" style={{ width: `${percent}%` }} /></div>
                  <p className="field-hint" style={{ marginTop: 7 }}>{percent}% of goal recorded</p>
                </>
              )}
              <Link to={`/donate${campaign.slug ? `#${campaign.slug}` : ''}`} className="text-link">View giving area <ArrowRight size={14} /></Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function HomePage() {
  const { organization, partners, events, announcements, gallery, sections, isLoading } = useSiteContent();
  const homeContent = sections.home_hero?.content ?? {};
  const title = sections.home_hero?.title ?? 'Supporting students in school and beyond.';
  const description = typeof homeContent.description === 'string' ? homeContent.description : organization?.mission ?? siteConfig.mission;
  const upcoming = events.filter((event) => event.event_date && new Date(event.event_date).getTime() >= pageLoadTime).slice(0, 2);

  return (
    <>
      <section className="hero">
        <img className="hero-background-image" src="/hos-community-hero.png" alt="" fetchPriority="high" aria-hidden="true" />
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <div className="hero-message">
              <div className="eyebrow">{typeof homeContent.eyebrow === 'string' ? homeContent.eyebrow : `${organization?.location ?? siteConfig.location} · Since ${organization?.founded_year ?? siteConfig.founded}`}</div>
              <h1>{title.split(' ').map((word, index) => {
                const highlight = ['future.', 'together.', 'family.'].includes(word.toLowerCase());
                return <span key={`${word}-${index}`}>{index > 0 ? ' ' : ''}{highlight ? <em>{word}</em> : word}</span>;
              })}</h1>
              <p>{description}</p>
            </div>
            <div className="hero-actions">
              <Link className="button button-primary" to="/students">Meet our children <ArrowRight size={15} /></Link>
              <Link className="button button-outline" to="/donate">Ways to give <ArrowUpRight size={14} /></Link>
            </div>
            <div className="hero-note"><MapPin size={15} /> Working with students and families in {organization?.location ?? siteConfig.location}</div>
          </div>
          <div className="hero-art" aria-label="Heart of Sympathy logo and abstract nature-inspired design">
            <div className="hero-art-orbit" />
            <div className="hero-sprig hero-sprig-one" />
            <div className="hero-sprig hero-sprig-two" />
            <div className="hero-logo-card"><img src="/hos-logo.png" alt="Heart of Sympathy — Bridge Them To The Future" /></div>
            <div className="hero-caption"><Heart size={16} /><span><strong>Our focus</strong>Students and their families</span></div>
          </div>
        </div>
      </section>

      <section className="wrap student-focus-banner">
        <div className="student-focus-icon"><HeartHandshake size={25} /></div>
        <div><span className="eyebrow">Student support</span><h2>See the students HOS works with.</h2><p>Read the public profiles and updates maintained by the HOS team.</p></div>
        <Link className="button button-primary" to="/students">Meet our children <ArrowRight size={15} /></Link>
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading">
            <div className="eyebrow">Programs</div>
            <h2>Education, health, nutrition, and family support.</h2>
            <p>These are the areas HOS works across to support students and their families.</p>
          </div>
          <ProgramCards compact />
          <Link className="text-link" to="/programs">See all programs <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">Partner organizations</div><h2>Organizations working with HOS.</h2><p>Meet the organizations that partner with Heart of Sympathy.</p></div>
          {partners.length
            ? <div className="partner-preview-grid">{partners.slice(0, 4).map((partner) => <Link className="partner-preview" to="/partners" key={partner.id}>{partner.logo_url ? <img src={partner.logo_url} alt="" loading="lazy" /> : <HeartHandshake size={23} />}<strong>{partner.name}</strong></Link>)}</div>
            : !isLoading && <p className="field-hint">Our partner organizations will be introduced here.</p>}
          <Link className="text-link" to="/partners">Meet our partners <ArrowRight size={14} /></Link>
        </div>
      </section>

      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">Current giving areas</div><h2>Support an HOS priority.</h2><p>Giving areas and amounts are maintained by Heart of Sympathy. Select a giving area to view the official ways to give.</p></div>
          <CampaignCards />
        </div>
      </section>

      <section className="wrap section">
        <div className="section-heading"><div className="eyebrow">HOS events</div><h2>Events and announcements.</h2></div>
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
            <div className="section-heading"><div className="eyebrow">HOS activities</div><h2>Photos from our activities.</h2></div>
            <div className="gallery-grid">{gallery.slice(0, 4).map((image) => <Link className="gallery-item" key={image.id} to="/gallery"><img src={image.image_url} alt={image.alt_text ?? 'Heart of Sympathy community photograph'} loading="lazy" /><div className="gallery-overlay">{image.caption ?? image.collection_name}</div></Link>)}</div>
            <Link to="/gallery" className="text-link">Visit the gallery <ArrowRight size={14} /></Link>
          </div>
        </section>
      )}

      <section className="wrap section-tight">
        <div className="donate-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 650 }}><div className="eyebrow">Get involved</div><h2>Support a student or family priority.</h2><p>View current giving areas or contact HOS about volunteering and partnerships.</p></div>
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
      <PageIntro eyebrow="About Heart of Sympathy" title={sections.about?.title ?? 'About Heart of Sympathy'} description={biography} />
      <section className="wrap section-tight"><MissionVision /></section>
      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap">
          <div className="section-heading"><div className="eyebrow">How HOS supports students</div><h2>Support can include education, health, and family needs.</h2></div>
          <div className="grid grid-3">
            {[
              { title: 'Education', text: 'Support with school-related needs helps students participate in education.', icon: <BadgeCheck /> },
              { title: 'Nutrition and health', text: 'Nutrition and healthcare assistance address needs that can affect a student’s wellbeing and learning.', icon: <Heart /> },
              { title: 'Family support', text: 'Mentorship and practical assistance respond to needs in the student’s household.', icon: <UsersRound /> },
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
  const [selectedMember, setSelectedMember] = useState<{
    full_name: string;
    role_title: string | null;
    focus_area: string | null;
    biography: string | null;
    avatar_url: string | null;
    avatar_object_position: string;
  } | null>(null);
  const activeYear = teamYears.find((year) => year.id === selectedYear) ?? teamYears[0];

  useEffect(() => {
    if (!selectedMember) return;
    const previousOverflow = document.body.style.overflow;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedMember(null);
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedMember]);

  return (
    <>
      <PageIntro eyebrow="Heart of Sympathy" title="Meet the team." description="View the current and past HOS team rosters and the biographies they have shared." />
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
          ? <div className="team-member-grid">{activeYear.members.map((member) => <button className="team-member-card" key={member.id} type="button" onClick={() => setSelectedMember(member)} aria-label={`Read about ${member.full_name}`}>
            <span className="team-member-avatar">{member.avatar_url ? <img src={member.avatar_url} alt="" loading="lazy" style={{ objectPosition: member.avatar_object_position || '50% 50%' }} /> : <span>{member.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>}</span>
            <span className="team-member-card-role">{member.role_title ?? 'Team member'}</span>
            <strong>{member.full_name}</strong>
            {member.focus_area && <span className="team-member-card-focus">{member.focus_area}</span>}
            <span className="team-member-card-action">View profile <ArrowRight size={13} /></span>
          </button>)}</div>
          : <EmptyState>{isLoading ? 'Loading the published team…' : 'No team members have been published for this year yet.'}</EmptyState>}
      </section>
      {selectedMember && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedMember(null); }}>
        <section className="modal team-member-modal" role="dialog" aria-modal="true" aria-labelledby="team-member-name">
          <div className="modal-header"><div><div className="eyebrow">{selectedMember.role_title ?? 'Team member'}</div><h2 id="team-member-name">{selectedMember.full_name}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedMember(null)} aria-label="Close team member profile"><X size={17} /></button></div>
          <div className="modal-body team-member-modal-body">
            <div className="team-member-modal-avatar">{selectedMember.avatar_url ? <img src={selectedMember.avatar_url} alt={selectedMember.full_name} style={{ objectPosition: selectedMember.avatar_object_position || '50% 50%' }} /> : <span>{selectedMember.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}</span>}</div>
            {selectedMember.focus_area && <div className="card-kicker">{selectedMember.focus_area}</div>}
            <p className="team-member-biography">{selectedMember.biography || 'More information about this team member will be added soon.'}</p>
          </div>
        </section>
      </div>}
    </>
  );
}

export function ProgramsPage() {
  const { programs, isLoading } = useSiteContent();
  const [selectedProgram, setSelectedProgram] = useState<PublicListEntry | null>(null);
  return (
    <>
      <PageIntro eyebrow="Programs" title="Student and family support programs." description="HOS supports students through education, nutrition, health, mentorship, and practical assistance for families." />
      <section className="wrap section-tight">
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading programs…</div> : programs.length > 0
          ? <ConnectedList items={programs.map((program) => ({ id: program.id, title: program.name, summary: program.summary, details: [program.description, program.impact && `Focus and impact: ${program.impact}`].filter(Boolean).join('\n\n') || program.summary, image: program.cover_image_url, label: program.feature_label ?? 'Program' }))} onSelect={setSelectedProgram} />
          : <EmptyState>No program details have been published yet.</EmptyState>}
      </section>
      <section className="wrap section-tight"><div className="callout"><div className="eyebrow">Student support</div><h2>Ask HOS about a program.</h2><p>Contact the team with questions about the support HOS provides to students and families.</p><Link className="button button-outline" to="/contact">Contact HOS <ArrowRight size={14} /></Link></div></section>
      <PublicDetailDialog item={selectedProgram} onClose={() => setSelectedProgram(null)} />
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
      <PageIntro eyebrow="HOS activities" title="Photos from our activities." description="Browse photographs and captions shared by the Heart of Sympathy team." />
      <section className="wrap section-tight">
        {collections.length > 1 && <div className="filter-row">{collections.map((name) => <button type="button" className={`button button-small ${collection === name ? 'button-primary' : 'button-outline'}`} key={name} onClick={() => setCollection(name)}>{name}</button>)}</div>}
        {isLoading ? <div className="grid grid-3">{[1, 2, 3].map((item) => <div key={item} className="skeleton" style={{ height: 210 }} />)}</div> : images.length > 0 ? <div className="gallery-grid">{images.map((image, index) => {
          const cover = image.additional_images[0]?.url ?? image.image_url;
          const photoCount = image.additional_images.length || 1;
          return <button type="button" className="gallery-item" key={image.id} onClick={() => { setSelected(index); setSelectedSlide(0); }} aria-label={`Open ${image.title ?? image.caption ?? 'gallery post'} with ${photoCount} photo${photoCount === 1 ? '' : 's'}`}><img src={cover} alt={image.alt_text ?? image.caption ?? 'Heart of Sympathy activity'} loading="lazy" /><span className="gallery-overlay"><strong>{image.title ?? image.caption ?? 'HOS activity'}</strong><span>{image.description ?? ''}</span>{photoCount > 1 && <small>{photoCount} photos · open to view</small>}</span></button>;
        })}</div> : <EmptyState>No photographs are published in this collection yet.</EmptyState>}
      </section>
      {post && currentSlide && createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={post.title ?? post.caption ?? 'Gallery post'} onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <div className="lightbox-inner">
            <button type="button" className="icon-button lightbox-close" onClick={() => setSelected(null)} aria-label="Close image"><X size={19} /></button>
            <div className="lightbox-photo">
              <img className="lightbox-image" src={currentSlide.url} alt={currentSlide.caption || post.alt_text || post.title || ''} />
              {slides.length > 1 && <div className="lightbox-controls"><button type="button" className="icon-button" onClick={() => setSelectedSlide((selectedSlide - 1 + slides.length) % slides.length)} aria-label="Previous image"><ChevronLeft /></button><button type="button" className="icon-button" onClick={() => setSelectedSlide((selectedSlide + 1) % slides.length)} aria-label="Next image"><ChevronRight /></button></div>}
            </div>
            <div className="lightbox-details">
              <div className="eyebrow">{post.collection_name ?? 'HOS activities'}</div>
              <h2>{post.title ?? post.caption ?? 'HOS activity'}</h2>
              <p>{currentSlide.caption || post.description || post.caption || 'Photograph from a Heart of Sympathy activity.'}</p>
              {post.activity_date && <div className="field-hint">{formatDate(post.activity_date)}</div>}
              {slides.length > 1 && <div className="lightbox-count">{selectedSlide + 1} of {slides.length} photos</div>}
            </div>
          </div>
        </div>,
        document.body,
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
      <PageIntro eyebrow="Events & announcements" title="HOS events and updates." description="See upcoming events, past activities, and announcements from Heart of Sympathy." />
      <section className="wrap section-tight">
        {isLoading ? <div className="loading-inline"><span className="loading-dot" /> Loading published updates…</div> : timeline.length > 0 ? <div className="timeline">{timeline.map((event) => <button type="button" className="timeline-item event-timeline-button" key={event.id} onClick={() => setEventId(event.id)}><time>{formatDate(event.event_date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</time><h3>{event.title}</h3><p>{event.summary}</p><div className="event-meta"><span><MapPin size={13} /> {event.location ?? 'Location to be announced'}</span>{event.starts_at && <span><Clock3 size={13} /> {new Date(event.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })} CAT</span>}</div><span className="text-link">View details <ArrowRight size={13} /></span></button>)}</div> : <EmptyState>No public events have been published yet.</EmptyState>}
      </section>
      <section className="section" style={{ background: 'var(--page-soft)', borderBlock: '1px solid var(--line)' }}>
        <div className="wrap"><div className="section-heading"><div className="eyebrow">Announcements</div><h2>Updates from HOS.</h2></div>{announcementItems.length > 0 ? <ConnectedList items={announcementItems} onSelect={setSelectedAnnouncement} /> : <EmptyState>No announcements have been published.</EmptyState>}</div>
      </section>
      {selectedEvent && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEventId(null); }}><div className="modal event-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><div className="modal-header"><h2 id="event-modal-title">{selectedEvent.title}</h2><button className="icon-button" type="button" onClick={() => setEventId(null)} aria-label="Close event details"><X size={17} /></button></div><div className="modal-body">{(selectedEvent.cover_image_url ?? selectedEvent.image_url) && <img className="event-modal-image" src={selectedEvent.cover_image_url ?? selectedEvent.image_url ?? ''} alt="" />}<div className="event-meta"><span><CalendarDays size={15} /> {formatDate(selectedEvent.event_date, { dateStyle: 'full' })}</span><span><MapPin size={15} /> {selectedEvent.location ?? 'Location to be announced'}</span></div><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{selectedEvent.summary}</p>{selectedEvent.starts_at && <p><Clock3 size={14} /> {new Date(selectedEvent.starts_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })}{selectedEvent.ends_at ? ` – ${new Date(selectedEvent.ends_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Kigali' })}` : ''} CAT</p>}{selectedEvent.registration_url && <a className="button button-primary" href={selectedEvent.registration_url} target="_blank" rel="noreferrer">Registration details <ArrowUpRight size={14} /></a>}</div></div></div>}
      <PublicDetailDialog item={selectedAnnouncement} onClose={() => setSelectedAnnouncement(null)} />
    </>
  );
}

export function DonatePage() {
  const { campaigns, donationMethods, isLoading } = useSiteContent();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const selectedCampaign = campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null;

  return (
    <>
      <section className="wrap donation-selection">
        <div className="donation-selection-heading">
          <div><div className="eyebrow">Heart of Sympathy · Giving areas</div><h1>Choose where to give.</h1></div>
          <p>Select an area to see the available ways to donate.</p>
        </div>
        {isLoading ? <div className="grid donation-area-grid">{[1, 2, 3].map((item) => <div className="skeleton donation-area-skeleton" key={item} />)}</div> : campaigns.length > 0 ? <div className="grid donation-area-grid">{campaigns.map((campaign) => {
          const goal = Number(campaign.target_amount ?? 0);
          const raised = Number(campaign.raised_amount ?? 0);
          const progress = goal > 0 ? Math.min(100, Math.round(raised / goal * 100)) : 0;
          return <article id={campaign.slug ?? campaign.id} className="donation-plan-card" key={campaign.id}>
            {campaign.cover_image_url
              ? <img className="donation-plan-image" src={campaign.cover_image_url} alt="" loading="lazy" />
              : <div className="donation-plan-image donation-plan-image-placeholder"><HeartHandshake size={30} aria-hidden="true" /></div>}
            <div className="donation-plan-content">
              <div className="donation-plan-category">Giving area</div>
              <h2>{campaign.title}</h2>
              <p className="donation-plan-description">{campaign.description}</p>
              <div className="donation-plan-amounts">
                <div><span>Available so far</span><strong>{formatMoney(raised, campaign.currency_code)}</strong></div>
                <div><span>Amount wanted</span><strong>{goal > 0 ? formatMoney(goal, campaign.currency_code) : 'Not specified'}</strong></div>
              </div>
              {goal > 0 && <div className="donation-plan-progress" aria-label={`${progress}% of amount wanted`}>
                <div className="donation-plan-progress-track"><span style={{ width: `${progress}%` }} /></div>
                <span>{progress}%</span>
              </div>}
              {(campaign.starts_at || campaign.ends_at) && <div className="donation-plan-dates">{campaign.starts_at ? formatDate(campaign.starts_at) : 'Open'} – {campaign.ends_at ? formatDate(campaign.ends_at) : 'Ongoing'}</div>}
              <button type="button" className="button button-primary donation-area-button" onClick={() => setSelectedCampaignId(campaign.id)}>Donate <ArrowRight size={15} /></button>
            </div>
          </article>;
        })}</div> : <EmptyState>There are no giving areas available right now. Please check back soon or contact Heart of Sympathy to ask how you can help.</EmptyState>}
      </section>
      {selectedCampaign && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedCampaignId(null); }}>
        <section className="modal donation-method-modal" role="dialog" aria-modal="true" aria-labelledby="donation-method-title">
          <div className="modal-header"><div><div className="eyebrow">Selected giving area</div><h2 id="donation-method-title">{selectedCampaign.title}</h2></div><button className="icon-button" type="button" onClick={() => setSelectedCampaignId(null)} aria-label="Close giving methods"><X size={17} /></button></div>
          <div className="modal-body">
            <p>Choose an official giving method below. Check the recipient details carefully before sending.</p>
            {donationMethods.length ? <div className="donation-method-list">{donationMethods.map((method) => <article className="donation-method-option" key={method.id}><div className="card-kicker">{method.method_type.replaceAll('_', ' ')}</div><h3>{method.label}</h3><p>{method.details}</p>{method.instructions && <p className="field-hint">{method.instructions}</p>}</article>)}</div> : <div className="notice"><ShieldCheck size={17} /><span>Official giving methods are being updated. Contact HOS to confirm a safe way to give.</span></div>}
            <div className="donation-secure-note"><ShieldCheck size={16} /><span>This website does not collect card numbers, security codes, or other payment credentials.</span></div>
            <div className="record-form-actions"><Link className="button button-outline" to="/contact">Contact HOS <ArrowUpRight size={14} /></Link><button type="button" className="button button-primary" onClick={() => setSelectedCampaignId(null)}>Done</button></div>
          </div>
        </section>
      </div>}
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
      <PageIntro eyebrow="Contact" title={sections.contact?.title ?? 'Contact Heart of Sympathy.'} description={typeof sections.contact?.content.intro === 'string' ? sections.contact.content.intro : 'Send a message about student support, partnerships, volunteering, or another HOS matter.'} />
      <section className="wrap section-tight">
        <div className="contact-grid">
          <div>
            <div className="section-heading"><div className="eyebrow">HOS contact details</div><h2 style={{ fontSize: '2rem' }}>Kigali, Rwanda</h2><p>Use the contact details below to reach Heart of Sympathy.</p></div>
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
            <div className="panel-heading"><div><h2>Send a message</h2><p>Messages are saved in the HOS staff inbox. An automatic email reply is not sent.</p></div><MessageCircle size={18} color="var(--gold)" /></div>
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
      <section id="quick-answers" className="wrap section-tight contact-faq-section" aria-labelledby="contact-faq-title">
        <div className="contact-faq-heading">
          <div><div className="eyebrow">Quick answers</div><h2 id="contact-faq-title">Finding your way around HOS</h2></div>
          <span>Short answers to common questions.</span>
        </div>
        <div className="contact-faq-list">
          <details>
            <summary>What do HOS programs do?</summary>
            <p>They support students and families through education, nutrition, health, mentorship, and practical assistance. See the <Link to="/programs">Programs page</Link> for current details.</p>
          </details>
          <details>
            <summary>Where can I see ways to give?</summary>
            <p>Visit <Link to="/donate">Donate</Link> to browse current giving areas and the official payment instructions available for each one.</p>
          </details>
          <details>
            <summary>Where can I find HOS events, photos, and team information?</summary>
            <p>Use <Link to="/events">Events</Link> for updates, <Link to="/gallery">Gallery</Link> for activity photos, and <Link to="/team">Team</Link> to meet HOS staff.</p>
          </details>
          <details>
            <summary>Why can’t I log in to the portal, and what is it for?</summary>
            <p>The portal is for authorized HOS staff, not public visitors. At <Link to="/portal">Portal login</Link>, choose your department and use its assigned work email and password. If access still fails, contact your portal administrator to check your account or reset your password. The work email is a login only; it cannot send or receive email.</p>
          </details>
          <details>
            <summary>Will I get an email reply after using the contact form?</summary>
            <p>Your message is saved for the HOS team, but the form does not send an automatic email reply. Include a working email address so the team can follow up.</p>
          </details>
          <details>
            <summary>How can I volunteer with HOS?</summary>
            <p>Fill out the volunteer form on this <Link to="/contact">Contact page</Link> with your interests and availability. The HOS team can follow up about next steps.</p>
          </details>
          <details>
            <summary>How can my organization partner with HOS?</summary>
            <p>Learn about current <Link to="/partners">partner organizations</Link>, then use the contact form to tell HOS about your organization and how you would like to collaborate.</p>
          </details>
          <details>
            <summary>Why are some student details not shown publicly?</summary>
            <p>Public profiles share only selected information. Private details—including health, family contact, and safeguarding information—are kept out of the public directory to protect students.</p>
          </details>
          <details>
            <summary>Can I pay by card through this website?</summary>
            <p>The website does not collect card numbers or payment security codes. Open a giving area on the <Link to="/donate">Donate page</Link> and follow its listed official payment instructions, or contact HOS to confirm a safe way to give.</p>
          </details>
          <details>
            <summary>How do I know if an event or program is current?</summary>
            <p>Check the latest information on the <Link to="/events">Events</Link> or <Link to="/programs">Programs</Link> page. For confirmation about a specific activity, contact HOS directly.</p>
          </details>
        </div>
      </section>
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
      <div><div className="eyebrow">Volunteering</div><h2>Apply to volunteer with HOS.</h2><p>Tell us your interests and availability. The team reviews applications; submitting this form does not confirm a placement.</p></div>
      <form className="record-form" onSubmit={(event) => void handleSubmit(event)}>
        <div className="form-grid">
          <label className="field"><span className="field-label">Full name</span><input className="input" name="full_name" required minLength={2} maxLength={120} /></label>
          <label className="field"><span className="field-label">Email</span><input className="input" name="email" type="email" required maxLength={254} /></label>
          <label className="field"><span className="field-label">Phone (optional)</span><input className="input" name="phone" maxLength={40} /></label>
          <label className="field"><span className="field-label">Availability</span><input className="input" name="availability" maxLength={150} /></label>
          <label className="field field-span"><span className="field-label">Interests (comma separated)</span><input className="input" name="interests" maxLength={500} placeholder="Student mentoring, school support, events…" /></label>
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
        text: 'You are subscribed to HOS email updates. Use the unsubscribe link below any time to remove your email from the list.',
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
      <div><div className="eyebrow">Email updates</div><h2>{compact ? 'Updates from Heart of Sympathy.' : 'Receive HOS updates by email.'}</h2><p>Sign up for public program, event, and organization updates. Subscriber email addresses are not displayed publicly.</p></div>
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
  return <div className="wrap unsubscribe-page"><div className="login-card"><div className="eyebrow">Newsletter preferences</div><h1>{done ? 'You are unsubscribed.' : error ? 'We could not update that address.' : 'Updating your preference…'}</h1><p>{done ? 'Your email has been removed from the subscriber list and will no longer receive Heart of Sympathy updates.' : error ?? 'Please wait while we process your request.'}</p>{error && <div role="alert" className="form-message error">{error}</div>}<Link className="button button-outline" to="/">Return to the website <ArrowLeft size={14} /></Link></div></div>;
}
