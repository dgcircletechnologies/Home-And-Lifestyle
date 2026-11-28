import Link from 'next/link';

export function StoreBreadcrumb({ current, parent }: { current: string; parent?: { label: string; href: string } }) {
  return <nav className="store-breadcrumb" aria-label="Breadcrumb">
    <Link href="/">Home</Link><span aria-hidden="true">/</span>
    {parent && <><Link href={parent.href}>{parent.label}</Link><span aria-hidden="true">/</span></>}
    <span aria-current="page">{current}</span>
  </nav>;
}
