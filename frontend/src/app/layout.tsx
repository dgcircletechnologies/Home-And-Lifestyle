import type { Metadata } from 'next';
import { AuthProvider } from '../features/auth/provider';
import { AppFrame } from '../components/app-frame';
import './globals.css';
export const metadata: Metadata = { title: 'Home & Lifestyle', description: 'A thoughtful home starts here.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body><AuthProvider><a className="skip" href="#main">Skip to content</a><AppFrame>{children}</AppFrame></AuthProvider></body></html>;
}
