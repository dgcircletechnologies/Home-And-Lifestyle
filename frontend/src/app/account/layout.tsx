import { Protected } from '../../features/auth/protected';
export default function AccountLayout({ children }: { children: React.ReactNode }) { return <Protected role="CUSTOMER">{children}</Protected>; }
