import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { digestNewsletterToken } from '../lib/newsletter';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';

export function NewsletterForm({ compact = false, footer = false }: { compact?: boolean; footer?: boolean }) {
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
      const tokenHash = await digestNewsletterToken(token);
      const { data, error } = await getSupabaseClient().rpc('subscribe_newsletter', {
        p_email: email.trim().toLowerCase(),
        p_token_hash: tokenHash,
        p_source: pathname,
        p_consented: consented,
      });
      if (error) throw error;
      if (data !== true) throw new Error('The address or subscription details were not accepted.');
      setNotice({
        type: 'success',
        text: 'You are subscribed to HOS email updates. Use the unsubscribe link below any time to remove your email from the list.',
        unsubscribeUrl: `${window.location.origin}/unsubscribe?token=${encodeURIComponent(token)}`,
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
    <div className={`newsletter-panel${compact ? ' newsletter-panel-compact' : ''}${footer ? ' newsletter-panel-footer' : ''}`}>
      <div>
        <div className="eyebrow">Email updates</div>
        <h2>{footer ? 'Stay connected.' : compact ? 'Updates from Heart of Sympathy.' : 'Receive HOS updates by email.'}</h2>
        {!footer && <p>Sign up for public program, event, and organization updates. Subscriber email addresses are not displayed publicly.</p>}
      </div>
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
