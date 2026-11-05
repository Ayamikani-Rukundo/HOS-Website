import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

export type AuthContextValue = {
  user: User | null;
  roles: string[];
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<string[]>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
