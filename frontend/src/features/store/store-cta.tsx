'use client';
import Link from 'next/link';

export function StoreCTA({ href, variant = 'primary', disabled = false, onClick, type = 'button', className = '', children }: { href?: string; variant?: 'primary' | 'secondary'; disabled?: boolean; onClick?: () => void; type?: 'button' | 'submit'; className?: string; children: React.ReactNode }) {
  const classes = `store-flow-cta store-flow-cta-${variant} ${className}`;
  if (href && !disabled) return <Link href={href} className={classes} onClick={onClick}>{children}</Link>;
  return <button type={type} className={classes} disabled={disabled} onClick={onClick}>{children}</button>;
}
