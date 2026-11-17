"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { authService, clearAuthMemory, startAuthEvents, type User } from './service';
type State = { status: 'initializing' | 'authenticated' | 'unauthenticated'; user: User | null; error?: string };
const AuthContext = createContext<(State & { reload: () => void; accept: (user: User) => void; logout: () => Promise<void> }) | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: 'initializing', user: null });
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const clear = useCallback(() => { clearAuthMemory(); generation.current++; setState({ status: 'unauthenticated', user: null }); }, []);
  useEffect(() => startAuthEvents(), []);
  useEffect(() => {
    const controller = new AbortController();
    const current = ++generation.current;
    authService.initialize().then(user => {
      if (current === generation.current) setState({ status: 'authenticated', user });
    }).catch(error => {
      if (!controller.signal.aborted && current === generation.current) setState({ status: error instanceof ApiError && error.status === 401 ? 'unauthenticated' : 'initializing', user: null, error: error.status === 401 ? undefined : error.message });
    });
    window.addEventListener('auth:expired', clear);
    return () => { controller.abort(); window.removeEventListener('auth:expired', clear); };
  }, [version, clear]);
  return <AuthContext.Provider value={{ ...state, reload: () => { setState({ status: 'initializing', user: null }); setVersion(v => v + 1); }, accept: user => { generation.current++; setState({ status: 'authenticated', user }); }, logout: async () => { await authService.logout(); clear(); } }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw Error('AuthProvider missing.'); return value; }
