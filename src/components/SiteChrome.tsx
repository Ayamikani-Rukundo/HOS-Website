import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, HeartHandshake, Mail, MapPin, Menu, Moon, Sun } from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { navItems, siteConfig } from '../data/site';
import { useAuth } from '../lib/auth-context';
import { useSiteContent } from '../lib/site-content-context';
import { useTheme } from '../lib/theme-context';

const publicLinks = navItems.filter((item) => item.href !== '/portal');
const workLinks = publicLinks.filter((item) => ['/programs', '/projects', '/impact'].includes(item.href));
const generalLinks = publicLinks.filter((item) => !workLinks.includes(item) && item.href !== '/about');
const currentYear = new Date().getFullYear();

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const workMenuRef = useRef<HTMLDetailsElement>(null);
  const aboutMenuRef = useRef<HTMLDetailsElement>(null);
  const isWorkActive = workLinks.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const isAboutActive = ['/about', '/team'].includes(pathname);
  const closeMenu = () => {
    if (workMenuRef.current) workMenuRef.current.open = false;
    if (aboutMenuRef.current) aboutMenuRef.current.open = false;
    onNavigate?.();
  };

  useEffect(() => {
    if (workMenuRef.current) workMenuRef.current.open = false;
    if (aboutMenuRef.current) aboutMenuRef.current.open = false;
  }, [pathname]);

  return (
    <>
      {generalLinks.map((item) => (
        <span className="nav-item" key={item.href}>
          <NavLink to={item.href} end={item.href === '/'} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
            {item.label}
          </NavLink>
          {item.href === '/' && (
            <details className="about-menu work-menu" ref={aboutMenuRef}>
              <summary className={`nav-link work-menu-trigger${isAboutActive ? ' active' : ''}`} aria-label="About Heart of Sympathy">
                About <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="work-menu-panel">
                <NavLink to="/about" end className={({ isActive }) => `work-menu-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
                  <span>Our story</span><ArrowUpRight size={14} aria-hidden="true" />
                </NavLink>
                <NavLink to="/team" className={({ isActive }) => `work-menu-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
                  <span>Meet the team</span><ArrowUpRight size={14} aria-hidden="true" />
                </NavLink>
              </div>
            </details>
          )}
          {item.href === '/' && (
            <details className="work-menu" ref={workMenuRef}>
              <summary className={`nav-link work-menu-trigger${isWorkActive ? ' active' : ''}`} aria-label="Choose a work section">
                Our work <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="work-menu-panel">
                {workLinks.map((work) => (
                  <NavLink key={work.href} to={work.href} className={({ isActive }) => `work-menu-link${isActive ? ' active' : ''}`} onClick={closeMenu}>
                    <span>{work.label}</span><ArrowUpRight size={14} aria-hidden="true" />
                  </NavLink>
                ))}
              </div>
            </details>
          )}
        </span>
      ))}
    </>
  );
}

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { organization, socialLinks } = useSiteContent();
  const { user, roles } = useAuth();

  return (
    <header className="site-header">
      <div className="wrap header-row">
        <Link to="/" className="brand" aria-label="Heart of Sympathy home" onClick={() => setMenuOpen(false)}>
          <img className="brand-logo" src="/hos-logo.png" alt="Heart of Sympathy — Bridge Them To The Future" />
          <span className="brand-copy">
            <span className="brand-name">{organization?.name ?? siteConfig.name}</span>
            <span className="brand-tagline">{organization?.tagline ?? siteConfig.tagline}</span>
          </span>
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          <NavigationLinks />
        </nav>

        <div className="header-actions">
          <button type="button" className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <Link to={user && roles.length ? '/workspace' : '/portal'} className="button button-outline">
            {user && roles.length ? 'My workspace' : 'Staff login'}
          </Link>
          <Link to="/donate" className="button button-primary">Support us <ArrowUpRight size={14} /></Link>
          <button type="button" className="icon-button mobile-menu-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
            <Menu size={18} />
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <NavigationLinks onNavigate={() => setMenuOpen(false)} />
          <Link className="nav-link" to="/portal" onClick={() => setMenuOpen(false)}>Staff login</Link>
          {socialLinks.slice(0, 3).map((social) => (
            <a key={social.id} className="nav-link" href={social.url} target="_blank" rel="noreferrer">{social.platform}</a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  const { organization, socialLinks, contactDetails } = useSiteContent();
  const publicContacts = contactDetails.filter((item) => item.is_public).slice(0, 3);

  return (
    <footer className="site-footer">
      <div className="wrap footer-cta">
        <div className="footer-cta-copy">
          <div className="eyebrow">Together, we can make a difference</div>
          <h2>Help build a future where every family can thrive.</h2>
          <p>{organization?.mission ?? siteConfig.mission}</p>
        </div>
        <div className="footer-cta-actions">
          <Link className="button button-primary" to="/donate">Support our work <ArrowUpRight size={15} /></Link>
          <Link className="button button-outline" to="/contact">Start a conversation <ArrowUpRight size={15} /></Link>
        </div>
      </div>
      <div className="wrap footer-main">
        <div className="footer-brand-block">
          <Link to="/" className="brand">
            <img className="brand-logo" src="/hos-logo.png" alt="" />
            <span className="brand-copy">
              <span className="brand-name">{organization?.name ?? siteConfig.name}</span>
              <span className="brand-tagline">{organization?.tagline ?? siteConfig.tagline}</span>
            </span>
          </Link>
          <p className="footer-about">Rooted in compassion. Focused on brighter futures.</p>
          {socialLinks.length > 0 && (
            <div className="footer-socials" aria-label="Social media">
              {socialLinks.map((social) => <a key={social.id} href={social.url} target="_blank" rel="noreferrer">{social.platform}<ArrowUpRight size={12} /></a>)}
            </div>
          )}
        </div>
        <div className="footer-column">
          <h2 className="footer-title">Discover</h2>
          <div className="footer-links">
            <Link to="/about">About<ArrowUpRight size={12} /></Link>
            <Link to="/team">Meet the team<ArrowUpRight size={12} /></Link>
            {generalLinks.filter((item) => !['/', '/donate', '/contact'].includes(item.href)).map((item) => <Link key={item.href} to={item.href}>{item.label}<ArrowUpRight size={12} /></Link>)}
          </div>
        </div>
        <div className="footer-column footer-work-column">
          <h2 className="footer-title">Our work</h2>
          <div className="footer-work-links">
            {workLinks.map((item) => <Link key={item.href} to={item.href}>{item.label}<ArrowUpRight size={13} /></Link>)}
          </div>
        </div>
        <address className="footer-column footer-contact">
          <h2 className="footer-title">Find us</h2>
          <div className="footer-contact-list">
            <span><MapPin size={15} /><span>{organization?.location ?? siteConfig.location}</span></span>
            {organization?.email && <a href={`mailto:${organization.email}`}><Mail size={15} /><span>{organization.email}</span></a>}
            {publicContacts.map((item) => <span key={item.id}><HeartHandshake size={15} /><span>{item.label}: {item.value}</span></span>)}
          </div>
          <Link className="footer-contact-link" to="/contact">Get in touch <ArrowUpRight size={14} /></Link>
        </address>
      </div>
      <div className="footer-bottom">
        <div className="wrap footer-bottom-row">
          <span>© {currentYear} {organization?.name ?? siteConfig.name}</span>
          <span>Education · Nutrition · Family wellbeing · Kigali, Rwanda</span>
        </div>
      </div>
    </footer>
  );
}
