import type { Metadata } from 'next';
import { AuthProvider } from '../features/auth/provider';
import { Header } from '../components/header';
import './globals.css';
export const metadata: Metadata = { title: 'Home & Lifestyle', description: 'A thoughtful home starts here.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body><AuthProvider><a className="skip" href="#main">Skip to content</a><Header /><main id="main">{children}</main><footer>Home & Lifestyle · A little more you.</footer></AuthProvider></body></html>;
}
