import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Home & Lifestyle Décor',
  description: 'A home décor store for India. Our storefront is taking shape.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
