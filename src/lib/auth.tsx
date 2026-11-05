import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthContextValue } from './auth-context';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured);
  const [roleState, setRoleState] = useState<{
    userId: string;
    roles: string[];
    error: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(
    isSupabaseConfigured
      ? null
      : 'Supabase is not configured. Copy .env.example to .env.local, add the project URL and public anon/publishable key, then restart Vite.',
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const client = getSupabaseClient();
    let active = true;
    let authEventReceived = false;
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (active) {
        authEventReceived = true;
        setSession(nextSession);
        setRoleState((current) => current?.userId === nextSession?.user.id ? current : null);
        if (nextSession) setError(null);
        setSessionLoading(false);
      }
    });

    void client.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active || authEventReceived) return;
        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
        } else {
          setSession(data.session);
        }
      })
      .catch((sessionError: unknown) => {
        if (active) {
          setError(
            sessionError instanceof Error
              ? sessionError.message
              : 'Unable to restore the saved sign-in session.',
          );
        }
      })
      .finally(() => {
        if (active) setSessionLoading(false);
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user.id;
  const roles = useMemo(
    () => (roleState && roleState.userId === userId ? roleState.roles : []),
    [roleState, userId],
  );
  const roleError = roleState && roleState.userId === userId ? roleState.error : null;
  const rolesLoading = Boolean(userId && roleState?.userId !== userId);

  useEffect(() => {
    if (!userId) return;

    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    void (async () => {
      try {
        const { data, error: rolesError } = await getSupabaseClient()
          .from('user_roles')
          .select('role_name')
          .eq('user_id', userId)
          .abortSignal(controller.signal);
        if (!active) return;
        setRoleState({
          userId,
          roles: rolesError ? [] : data.map((role) => role.role_name),
          error: rolesError ? `Unable to load your access roles: ${rolesError.message}` : null,
        });
      } catch (rolesError) {
        if (active) {
          setRoleState({
            userId,
            roles: [],
            error:
              controller.signal.aborted
                ? 'Organization access verification timed out. Check your connection and try again.'
                : rolesError instanceof Error
                ? rolesError.message
                : 'Unable to load your access roles.',
          });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [userId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getSupabaseClient();
    setError(null);
    const { data, error: signInError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) throw signInError;
    if (!data.user) throw new Error('Supabase did not return a signed-in user.');

    const { data: roleRows, error: rolesError } = await client
      .from('user_roles')
      .select('role_name')
      .eq('user_id', data.user.id);

    if (rolesError) {
      await client.auth.signOut();
      throw new Error(`Could not verify account permissions: ${rolesError.message}`);
    }
    if (roleRows.length === 0) {
      await client.auth.signOut();
      throw new Error(
        'This account has no organization role yet. Ask an administrator to assign one.',
      );
    }
    return roleRows.map((role) => role.role_name);
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await getSupabaseClient().auth.signOut();
    if (signOutError) throw signOutError;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      roles,
      isLoading: sessionLoading || rolesLoading,
      error: roleError ?? error,
      signIn,
      signOut,
    }),
    [error, roleError, roles, rolesLoading, session?.user, sessionLoading, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
