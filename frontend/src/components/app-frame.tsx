"use client";

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import { Header } from './header';
import { StoreFooter } from './store-footer';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>;
  const supportPages = ['/shipping-policy', '/cancellation-and-returns', '/privacy-policy', '/terms-and-conditions', '/faq', '/contact'];
  const storePage = supportPages.includes(pathname) || pathname === '/' || pathname === '/shop' || pathname === '/about' || pathname === '/bag' || pathname === '/cart' || pathname.startsWith('/checkout') || pathname === '/account' || pathname.startsWith('/account/') || pathname === '/login' || pathname === '/register' || pathname.startsWith('/products/') || pathname.startsWith('/categories/') || pathname.startsWith('/collections/');
  return (
    <div className="public-shell flex min-h-screen flex-col">
      <Suspense fallback={<div className="store-header" aria-hidden="true" />}>
        <Header />
      </Suspense>
      <main id="main" className="flex-1">
        {children}
      </main>
      {storePage ? <StoreFooter /> : <footer className="h-auto">Home &amp; Lifestyle · A little more you.</footer>}
    </div>
  );
}
