import { Protected } from '../../features/auth/protected';
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <Protected role="ADMIN">{children}</Protected>; }
