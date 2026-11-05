import { createContext, useContext } from 'react';
import type { SiteContent } from './site-content';

export const SiteContentContext = createContext<SiteContent | null>(null);

export function useSiteContent() {
  const context = useContext(SiteContentContext);
  if (!context) {
    throw new Error('useSiteContent must be used inside SiteContentProvider.');
  }
  return context;
}
