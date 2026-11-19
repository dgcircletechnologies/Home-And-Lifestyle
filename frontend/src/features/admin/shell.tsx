"use client";

import Link from 'next/link';
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/provider';
import { adminNavigation } from './navigation';
import { Avatar } from '../../components/avatar';
import { useStoreConfig } from '../store/use-store-config';

const titleFor = (path: string) => {
  if (path === '/admin') return 'Dashboard';
  if (path === '/admin/profile') return 'My Profile';
  return adminNavigation.find(item => item.exact ? path === item.href : path.startsWith(item.href))?.label ?? 'Administration';
};

export function AdminShell({ children }: { children: React.ReactNode }) {
  const auth = useAuth(); const router = useRouter(); const path = usePathname();
  const store = useStoreConfig();
  const [drawerOpen, setDrawerOpen] = useState(false); const [desktop, setDesktop] = useState(false); const [profileOpen, setProfileOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null); const drawer = useRef<HTMLElement>(null); const profile = useRef<HTMLDivElement>(null);
  const closeDrawer = () => setDrawerOpen(false); const closeProfile = () => setProfileOpen(false);
  const initial = auth.user?.name.trim().slice(0, 1).toUpperCase() ?? 'A'; const pageTitle = titleFor(path);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => { setDesktop(media.matches); if (media.matches) setDrawerOpen(false); };
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!drawerOpen || desktop) return;
    const previous = document.body.style.overflow; const menuTrigger = trigger.current; document.body.style.overflow = 'hidden';
    const focusFirst = window.setTimeout(() => drawer.current?.querySelector<HTMLElement>('[data-drawer-close]')?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeDrawer(); return; }
      if (event.key !== 'Tab' || !drawer.current) return;
      const focusable = [...drawer.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(element => !element.hasAttribute('aria-hidden'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusFirst); document.body.style.overflow = previous; document.removeEventListener('keydown', onKeyDown); menuTrigger?.focus(); };
  }, [drawerOpen, desktop]);
  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event: MouseEvent) => { if (!profile.current?.contains(event.target as Node)) closeProfile(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeProfile(); };
    document.addEventListener('mousedown', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', outside); document.removeEventListener('keydown', escape); };
  }, [profileOpen]);
  async function logout() { closeProfile(); await auth.logout(); router.replace('/login'); }
  const drawerVisible = desktop || drawerOpen;

  return <div className="admin-workspace min-h-screen bg-[var(--hl-page)] text-[var(--hl-ink)] lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
    {!desktop && drawerOpen && <button type="button" aria-label="Close navigation overlay" onClick={closeDrawer} className="fixed inset-0 z-40 bg-[#19151f]/35" />}
    <aside ref={drawer} aria-label="Admin navigation" aria-hidden={!drawerVisible} className={`fixed inset-y-0 left-0 z-50 flex h-svh w-60 flex-col border-r border-[var(--hl-border)] bg-[var(--hl-surface)] px-3 py-5 shadow-[var(--hl-shadow-lg)] transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:shadow-none ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="mb-9 flex h-11 items-center justify-between px-2"><Link href="/admin" className="truncate font-[family-name:var(--font-display)] text-[1.05rem] font-extrabold tracking-[-.045em] text-[var(--hl-ink)] no-underline">{store?.storeName??'Home & Lifestyle'}</Link><button data-drawer-close type="button" aria-label="Close navigation" onClick={closeDrawer} className="grid size-10 place-items-center rounded-[var(--hl-radius-sm)] text-[var(--hl-muted)] hover:bg-[var(--hl-page)] focus-visible:outline-none lg:hidden"><X className="size-5" aria-hidden="true" /></button></div>
      <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--hl-muted)]">Administration</p>
      <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Admin sections"><ul className="m-0 grid list-none gap-1 p-0">{adminNavigation.map(item => {
        const active = item.exact ? path === item.href : path.startsWith(item.href); const Icon = item.icon;
        return <li key={item.href}><Link href={item.href} onClick={closeDrawer} aria-current={active ? 'page' : undefined} className={`admin-nav-link flex min-h-11 w-full items-center gap-3 rounded-[var(--hl-radius-sm)] px-3 text-sm font-semibold no-underline transition-colors ${active ? 'bg-[var(--hl-primary)] text-white' : 'text-[var(--hl-ink)] hover:bg-[var(--hl-page)]'}`}><Icon className={active ? 'text-white' : 'text-[var(--hl-muted)]'} size={18} aria-hidden="true" /><span>{item.label}</span></Link></li>;
      })}</ul></nav>
      <div className="mt-5 border-t border-[var(--hl-border)] px-3 pt-4 text-xs leading-5 text-[var(--hl-muted)]">Store operations</div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 flex h-[72px] min-w-0 items-center justify-between border-b border-[var(--hl-border)] bg-[var(--hl-page)]/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8" aria-label="Admin toolbar">
        <div className="flex min-w-0 items-center gap-3"><button ref={trigger} type="button" aria-label="Open navigation" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)} className="grid size-10 shrink-0 place-items-center rounded-[var(--hl-radius-sm)] text-[var(--hl-ink)] hover:bg-[var(--hl-page)] focus-visible:outline-none lg:hidden"><Menu className="size-5" aria-hidden="true" /></button><p className="truncate text-sm font-semibold text-[var(--hl-ink)] sm:text-base">{pageTitle}</p></div>
        <div ref={profile} className="relative shrink-0"><button type="button" aria-haspopup="menu" aria-expanded={profileOpen} onClick={() => setProfileOpen(value => !value)} className="flex min-h-10 items-center gap-2 rounded-[var(--hl-radius-sm)] px-1.5 text-left hover:bg-[var(--hl-page)] focus-visible:outline-none"><Avatar name={auth.user?.name ?? initial} url={auth.user?.avatarUrl} /><span className="hidden max-w-36 sm:grid"><span className="truncate text-sm font-semibold text-[var(--hl-ink)]">{auth.user?.name}</span><span className="text-xs text-[var(--hl-muted)]">Administrator</span></span><ChevronDown className="hidden size-4 text-[var(--hl-muted)] sm:block" aria-hidden="true" /></button>
          {profileOpen && <div role="menu" aria-label="Account menu" className="absolute right-0 top-[calc(100%+0.65rem)] z-50 w-72 overflow-hidden rounded-[var(--hl-radius)] border border-[var(--hl-border)] bg-[var(--hl-elevated)] p-1.5 shadow-[var(--hl-shadow-lg)]"><div className="border-b border-[var(--hl-border)] px-3 py-3"><p className="truncate text-sm font-semibold text-[var(--hl-ink)]">{auth.user?.name}</p><p className="truncate text-xs text-[var(--hl-muted)]">{auth.user?.email}</p></div><Link role="menuitem" href="/admin/profile" onClick={closeProfile} className="mt-1 flex min-h-10 items-center gap-3 rounded-[var(--hl-radius-sm)] px-3 text-sm font-medium text-[var(--hl-ink)] no-underline hover:bg-[var(--hl-page)]"><UserRound className="size-4 text-[var(--hl-muted)]" aria-hidden="true" />My Profile</Link><div className="my-1 border-t border-[var(--hl-border)]"/><button role="menuitem" type="button" onClick={logout} className="flex min-h-10 w-full items-center gap-3 rounded-[var(--hl-radius-sm)] px-3 text-sm font-semibold text-[var(--hl-error)] hover:bg-red-50 focus-visible:outline-none"><LogOut className="size-4" aria-hidden="true" />Log out</button></div>}
        </div>
      </header>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10"><div className="mx-auto w-full max-w-[108rem] min-w-0">{children}</div></main>
    </div>
  </div>;
}
