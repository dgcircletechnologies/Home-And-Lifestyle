"use client";

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from './header';
import { StoreFooter } from './store-footer';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>;
  const storePage = pathname === '/' || pathname === '/shop' || pathname === '/bag' || pathname.startsWith('/products/') || pathname.startsWith('/categories/') || pathname.startsWith('/collections/');
  return <div className="public-shell"><Suspense fallback={<div className="store-header" aria-hidden="true"/>}><Header /></Suspense><main id="main">{children}</main>{storePage?<StoreFooter/>:<footer>Home &amp; Lifestyle · A little more you.</footer>}</div>;
}
