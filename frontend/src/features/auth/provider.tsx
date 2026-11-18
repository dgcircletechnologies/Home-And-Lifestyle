"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { authService, clearAuthMemory, onSessionUser, startAuthEvents, type User } from './service';

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated' | 'error';
type AuthState = { status: AuthStatus; user: User | null; error: string | null };
type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<User>;
  retryInitialization: () => void;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'initializing', user: null, error: null });
  const generation = useRef(0); const initialization = useRef<Promise<void> | null>(null);
  const clear = useCallback(() => { generation.current++; clearAuthMemory(); setState({ status: 'unauthenticated', user: null, error: null }); }, []);
  const initialize = useCallback(() => {
    if (initialization.current) return initialization.current;
    const current = ++generation.current;
    setState({ status: 'initializing', user: null, error: null });
    const task = authService.initialize().then(user => {
      if (current === generation.current) setState({ status: 'authenticated', user, error: null });
    }).catch(error => {
      if (current !== generation.current) return;
      if (error instanceof ApiError && error.status === 401) setState({ status: 'unauthenticated', user: null, error: null });
      else setState({ status: 'error', user: null, error: error instanceof Error ? error.message : 'Unable to restore your session. Please try again.' });
    }).finally(() => { if (initialization.current === task) initialization.current = null; });
    initialization.current = task;
    return task;
  }, []);
  useEffect(() => {
    const stopEvents = startAuthEvents();
    const stopUserListener = onSessionUser(user => { if (generation.current > 0) setState({ status: 'authenticated', user, error: null }); });
    const expired = () => clear(); window.addEventListener('auth:expired', expired);
    void initialize();
    return () => { stopEvents(); stopUserListener(); window.removeEventListener('auth:expired', expired); };
  }, [clear, initialize]);
  const login = useCallback(async ({ email, password }: { email: string; password: string }) => {
    const current = ++generation.current; setState({ status: 'initializing', user: null, error: null });
    try { const user = await authService.login(email, password); if (current !== generation.current) throw new ApiError(401, 'Session changed.'); setState({ status: 'authenticated', user, error: null }); return user; }
    catch (error) { if (current === generation.current) setState({ status: 'unauthenticated', user: null, error: null }); throw error; }
  }, []);
  const logout = useCallback(async () => { clear(); try { await authService.logout(); } finally { clear(); } }, [clear]);
  const refreshUser = useCallback(async () => {
    const current = generation.current;
    try { const user = await authService.refreshUser(); if (current !== generation.current) throw new ApiError(401, 'Session changed.'); setState({ status: 'authenticated', user, error: null }); return user; }
    catch (error) { if (error instanceof ApiError && error.status === 401) clear(); throw error; }
  }, [clear]);
  const value = useMemo<AuthContextValue>(() => ({ ...state, isAuthenticated: state.status === 'authenticated', login, logout, refreshUser, retryInitialization: () => { void initialize(); } }), [state, login, logout, refreshUser, initialize]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw Error('useAuth must be used inside AuthProvider.'); return value; }
