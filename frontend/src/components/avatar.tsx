'use client';
import { useState } from 'react';
export function Avatar({ name, url, size = 'md' }: { name: string; url?: string | null; size?: 'md' | 'lg' }) {
  const dimensions = size === 'lg' ? 'size-20 text-2xl' : 'size-11 text-sm';
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--hl-page)] font-bold text-[var(--hl-primary)] ${dimensions}`} aria-label={name}><AvatarContents key={url ?? ''} name={name} url={url} /></span>;
}
function AvatarContents({ name, url }: { name: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  return url && !broken ? <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBroken(true)} /> : name.trim().slice(0, 1).toUpperCase() || '•';
}
