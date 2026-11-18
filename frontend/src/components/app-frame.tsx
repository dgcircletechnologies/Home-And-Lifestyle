"use client";

import { usePathname } from 'next/navigation';
import { Header } from './header';

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/admin' || pathname.startsWith('/admin/')) return <>{children}</>;
  return <div className="public-shell"><Header /><main id="main">{children}</main><footer>Home &amp; Lifestyle · A little more you.</footer></div>;
}
