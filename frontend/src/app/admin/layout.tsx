import { Protected } from '../../features/auth/protected';
import { AdminShell } from '../../features/admin/shell';
export default function AdminLayout({ children }: { children: React.ReactNode }) { return <Protected role="ADMIN"><AdminShell>{children}</AdminShell></Protected>; }
