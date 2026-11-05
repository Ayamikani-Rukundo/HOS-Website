import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowRight, BookOpen, CircleDollarSign, Eye, EyeOff, FileText, HeartHandshake, ShieldCheck, X } from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { SiteFooter, SiteHeader } from './components/SiteChrome';
import { AuthProvider } from './lib/auth';
import { useAuth } from './lib/auth-context';
import { getPortals, portalDetails, type PortalKind } from './lib/authorization';
import { SiteContentProvider } from './lib/site-content';
import { useSiteContent } from './lib/site-content-context';
import { isSupabaseConfigured } from './lib/supabase';
import { ThemeProvider } from './lib/theme';
import { submitPageView } from './lib/admin-api';

const HomePage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.HomePage })));
const AboutPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.AboutPage })));
const TeamPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.TeamPage })));
const ProgramsPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.ProgramsPage })));
const ProjectsPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.ProjectsPage })));
const ImpactPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.ImpactPage })));
const GalleryPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.GalleryPage })));
const EventsPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.EventsPage })));
const DonatePage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.DonatePage })));
const ContactPage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.ContactPage })));
const UnsubscribePage = lazy(() => import('./pages/PublicPages').then((pages) => ({ default: pages.UnsubscribePage })));
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then((pages) => ({ default: pages.WorkspacePage })));

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SiteContentProvider>
            <AppShell />
          </SiteContentProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();
  const isInternalRoute = /^\/(portal|workspace|dashboard)(\/|$)/.test(pathname);
  const wasInInternalRoute = useRef(isInternalRoute);
  const [sessionExitError, setSessionExitError] = useState<{ pathname: string; message: string } | null>(null);

  useEffect(() => {
    const hadInternalRoute = wasInInternalRoute.current
      || window.sessionStorage.getItem('hos.internal-route-active') === 'true';
    if (isInternalRoute) {
      wasInInternalRoute.current = true;
      window.sessionStorage.setItem('hos.internal-route-active', 'true');
      return;
    }

    if (!hadInternalRoute) return;
    wasInInternalRoute.current = false;
    window.sessionStorage.removeItem('hos.internal-route-active');
    if (!user) return;

    void signOut().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to end the portal session.';
      setSessionExitError({ pathname, message });
      console.error('Portal session could not be ended after leaving the workspace.', error);
    });
  }, [isInternalRoute, pathname, signOut, user]);

  return (
    <div className={`site${isInternalRoute ? ' internal-site' : pathname === '/' ? ' home-site' : ''}`}>
      <PageViewTracker />
      <RouteScrollReset />
      {!isInternalRoute && <SiteHeader />}
      {!isInternalRoute && <DatabaseStatus />}
      {sessionExitError?.pathname === pathname && <div role="alert" className="database-status has-error portal-session-error">Your portal session could not be ended: {sessionExitError.message}</div>}
      <main>
        <Suspense fallback={<div className="wrap section-tight"><div className="loading-inline"><span className="loading-dot" /> Loading Heart of Sympathy…</div></div>}>
          <PageTransition>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/programs" element={<ProgramsPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/impact" element={<ImpactPage />} />
              <Route path="/gallery" element={<GalleryPage />} />
              <Route path="/events" element={<EventsPage />} />
              <Route path="/donate" element={<DonatePage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/unsubscribe" element={<UnsubscribePage />} />
              <Route path="/portal" element={<PortalPage />} />
              <Route path="/workspace" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
              <Route path="/workspace/:portal" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
              <Route path="/dashboard" element={<Navigate to="/workspace" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PageTransition>
        </Suspense>
      </main>
      {!isInternalRoute && <SiteFooter />}
    </div>
  );
}

function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    if (hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, hash]);

  return null;
}

function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>(
      '.page-transition section, .page-transition .page-heading, .page-transition .content-card, .page-transition .program-card, .page-transition .campaign-card, .page-transition .panel, .page-transition .stat-card, .page-transition .empty-state',
    );
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        currentObserver.unobserve(entry.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });

    targets.forEach((target) => {
      target.classList.add('motion-ready');
      observer.observe(target);
    });

    return () => observer.disconnect();
  }, [pathname]);

  return <div key={pathname} className="page-transition">{children}</div>;
}

function PageViewTracker() {
  const { pathname } = useLocation();
  const previousPath = useRef<string | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured || previousPath.current === pathname || /^\/(portal|workspace|dashboard)(\/|$)/.test(pathname)) return;
    previousPath.current = pathname;
    let referrerHost: string | null = null;
    if (document.referrer) {
      try {
        referrerHost = new URL(document.referrer).host.slice(0, 253);
      } catch {
        referrerHost = null;
      }
    }
    void submitPageView(pathname, referrerHost).catch((error: unknown) => {
      console.warn('Anonymous page view was not recorded.', error);
    });
  }, [pathname]);
  return null;
}

function DatabaseStatus() {
  const { error, isLoading } = useSiteContent();
  if (!error && !isLoading) return null;
  return (
    <div role={error ? 'alert' : 'status'} className={`database-status${error ? ' has-error' : ''}`}>
      {error ?? 'Loading published organization information…'}
    </div>
  );
}

function PortalPage() {
  const navigate = useNavigate();
  const { signIn, signOut, error: authError, user, roles, isLoading } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<PortalKind | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (user && !isLoading && roles.length > 0 && !isSubmitting) return <Navigate to="/workspace" replace />;
  const portalChoices: {
    id: PortalKind;
    description: string;
    icon: typeof BookOpen;
  }[] = [
    {
      id: 'content',
      description: 'Organization administration, leadership oversight and public communications.',
      icon: BookOpen,
    },
    {
      id: 'secretariat',
      description: 'Official records, meeting minutes, department updates and assigned volunteer coordination.',
      icon: FileText,
    },
    {
      id: 'finance',
      description: 'Verified donation records and financial tracking.',
      icon: CircleDollarSign,
    },
    {
      id: 'programs',
      description: 'Program delivery, community outreach and confidential child and family support.',
      icon: HeartHandshake,
    },
    {
      id: 'fundraising',
      description: 'Fundraising campaigns, grant opportunities and partnership records.',
      icon: HeartHandshake,
    },
  ];
  const activeChoice = portalChoices.find((choice) => choice.id === selectedPortal);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPortal) {
      setFormError('Choose your department workspace first.');
      return;
    }
    setFormError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    try {
      const assignedRoles = await signIn(String(formData.get('email') ?? ''), String(formData.get('password') ?? ''));
      if (!getPortals(assignedRoles).includes(selectedPortal)) {
        await signOut();
        throw new Error(`This account is not assigned to ${portalDetails[selectedPortal].label}. Choose the workspace assigned to your account.`);
      }
      navigate(`/workspace/${selectedPortal}`, { replace: true });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Sign-in failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="portal-login-layout">
      <div className="portal-login-card">
        <Link className="portal-cancel-link" to="/" aria-label="Cancel and return to the public website" title="Cancel and return to the public website">
          <X size={17} /><span>Cancel</span>
        </Link>
        <aside className="portal-picker">
          <div className="portal-picker-brand">
            <img src="/hos-logo.png" alt="" />
            <div><div className="eyebrow">Heart of Sympathy</div><h1>Staff portal</h1></div>
          </div>
          <p className="portal-picker-intro">Choose your team to open its sign-in form.</p>
          <nav className="portal-choice-list" aria-label="Choose a department workspace">
            {portalChoices.map((choice) => {
              const Icon = choice.icon;
              return (
                <button
                  type="button"
                  className={`portal-choice${selectedPortal === choice.id ? ' active' : ''}`}
                  key={choice.id}
                  aria-pressed={selectedPortal === choice.id}
                  onClick={() => { setSelectedPortal(choice.id); setFormError(null); }}
                >
                  <Icon size={17} />
                  <span><strong>{portalDetails[choice.id].label}</strong><small>{choice.description}</small></span>
                  <ArrowRight size={14} />
                </button>
              );
            })}
          </nav>
        </aside>
        <section className="portal-login-panel" aria-live="polite">
          {activeChoice ? (
            <>
              <div className="eyebrow">Secure team access</div>
              <h2>{portalDetails[activeChoice.id].label}</h2>
              <p>{activeChoice.description}</p>
              <div className="notice portal-login-notice"><ShieldCheck size={16} /><span>Your account’s database role controls what you can view and change.</span></div>
              <form className="record-form portal-signin-form" onSubmit={(event) => void handleSubmit(event)}>
                <label className="field"><span className="field-label">Work email</span><input className="input" name="email" required type="email" autoComplete="username" /></label>
                <label className="field"><span className="field-label">Password</span><span className="password-input-wrap"><input className="input" name="password" required type={showPassword ? 'text' : 'password'} autoComplete="current-password" /><button className="password-visibility" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} title={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
                {(formError ?? authError) && <div role="alert" className="form-message error">{formError ?? authError}</div>}
                <button disabled={isSubmitting || !isSupabaseConfigured} type="submit" className="button button-primary portal-signin-button">
                  {isSubmitting ? 'Signing in…' : 'Sign in to this workspace'} <ArrowRight size={14} />
                </button>
                {!isSupabaseConfigured && <div role="alert" className="form-message error">Staff sign-in is unavailable until Supabase is configured.</div>}
              </form>
            </>
          ) : (
            <div className="portal-welcome-state">
              <div className="portal-welcome-emblem"><HeartHandshake size={34} /></div>
              <div className="eyebrow">Your work, together</div>
              <h2>One place for every team.</h2>
              <p>Select your department on the left. Its secure sign-in form will appear here.</p>
              <div className="portal-welcome-rule" />
              <span><ShieldCheck size={14} /> Private access · Role-based workspace</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, roles, isLoading, error } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="wrap section-tight"><div className="loading-inline"><span className="loading-dot" /> Verifying organization access…</div></div>;
  if (!user || roles.length === 0) return <Navigate to="/portal" replace state={{ from: location.pathname }} />;
  if (!getPortals(roles).length) return <div className="wrap section-tight"><div className="empty-state"><h1>No workspace assigned</h1><p>{error ?? 'Your account does not currently have access to an internal workspace. Ask an administrator to review your role.'}</p><Link className="button button-outline" to="/">Return to the website</Link></div></div>;
  return children;
}

export default App;
