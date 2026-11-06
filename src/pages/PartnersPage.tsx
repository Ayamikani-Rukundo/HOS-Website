import { ArrowUpRight, Handshake, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSiteContent } from '../lib/site-content-context';

function safeWebsiteUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function PartnersPage() {
  const { partners, isLoading } = useSiteContent();

  return (
    <>
      <header className="student-directory-hero partner-directory-hero">
        <div className="wrap">
          <div className="eyebrow"><Handshake size={15} /> Partner organizations</div>
          <h1>HOS partners</h1>
          <p>Organizations working with Heart of Sympathy to support students and families.</p>
        </div>
      </header>
      <section className="wrap section student-directory-section" aria-label="Partner organizations">
        <div className="student-directory-toolbar">
          <div><span className="eyebrow">Partnerships</span><h2>Organizations working with HOS</h2></div>
        </div>
        {isLoading
          ? <div className="loading-inline"><span className="loading-dot" /> Loading partners…</div>
          : partners.length
            ? <div className="partner-grid">{partners.map((partner) => {
              const websiteUrl = safeWebsiteUrl(partner.website_url);
              return (
                <article className="partner-card" key={partner.id}>
                  <div className="partner-logo">{partner.logo_url ? <img src={partner.logo_url} alt={`${partner.name} logo`} loading="lazy" /> : <HeartHandshake size={29} aria-hidden="true" />}</div>
                  {partner.focus_area && <span className="card-kicker">{partner.focus_area}</span>}
                  <h3>{partner.name}</h3>
                  {partner.description && <p>{partner.description}</p>}
                  {websiteUrl && <a className="partner-website" href={websiteUrl} target="_blank" rel="noreferrer">Visit organization <ArrowUpRight size={14} /></a>}
                </article>
              );
            })}</div>
            : <div className="student-empty-state"><Handshake size={25} /><h3>No partner organizations are listed yet</h3><p>Contact Heart of Sympathy to discuss a partnership.</p><Link className="button button-outline" to="/contact">Contact HOS <ArrowUpRight size={14} /></Link></div>}
      </section>
    </>
  );
}
