import Link from 'next/link';
export default function Denied() { return <section><h1>Access denied</h1><p>Your account does not have access to this area.</p><Link href="/">Back home</Link></section>; }
