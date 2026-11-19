'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { StoreDetailsSection, GiftingSection } from './settings-sections';
import { ShippingSection } from './settings-shipping';
import { AdminPageHeader } from './ui';
type Section = 'store' | 'shipping' | 'gifting';
const names: Record<Section,string> = { store:'Store Details', shipping:'Shipping & Delivery', gifting:'Gifting & Enquiries' };
const valid = (value: string | null): Section => value === 'shipping' || value === 'gifting' ? value : 'store';
export function SettingsPage() {
  const router=useRouter(), params=useSearchParams(), requested=valid(params.get('section'));
  const [active,setActive]=useState<Section>(requested), [dirty,setDirty]=useState(false), [pending,setPending]=useState<Section|string|null>(null);
  const focusReturn=useRef<HTMLElement|null>(null), modal=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    if(requested===active)return;
    if(dirty){
      // Browser Back can change the URL while a section has an unsaved draft.
      setPending(requested); router.replace(`/admin/settings?section=${active}`);
    }else{
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(requested);
    }
  },[requested,active,dirty,router]);
  useEffect(()=>{if(!dirty)return;const onLeave=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};const onLink=(event:MouseEvent)=>{const link=(event.target as HTMLElement).closest<HTMLAnchorElement>('a[href]');if(!link||!link.href.startsWith(location.origin)||link.pathname===location.pathname)return;event.preventDefault();event.stopPropagation();focusReturn.current=link;setPending(link.href);};window.addEventListener('beforeunload',onLeave);document.addEventListener('click',onLink,true);return()=>{window.removeEventListener('beforeunload',onLeave);document.removeEventListener('click',onLink,true)}},[dirty]);
  useEffect(()=>{if(!pending)return;const before=document.activeElement as HTMLElement|null;modal.current?.querySelector<HTMLButtonElement>('button')?.focus();const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setPending(null);(focusReturn.current??before)?.focus()}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape)},[pending]);
  const select=(section:Section)=>{if(section===active)return;focusReturn.current=document.activeElement as HTMLElement;if(dirty){setPending(section);return}router.push(`/admin/settings?section=${section}`)};
  const discard=()=>{const destination=pending;setPending(null);setDirty(false);if(!destination)return;if(destination==='store'||destination==='shipping'||destination==='gifting')router.push(`/admin/settings?section=${destination}`);else router.push(destination)};
  return <section className="min-w-0 pb-12"><AdminPageHeader eyebrow="Store operations / Configuration" title="Settings" description="Manage the details and rules used for future store activity. Each section saves separately."/>
    <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-[14rem_minmax(0,1fr)]"><nav aria-label="Settings sections" className="grid h-fit grid-cols-1 gap-2 rounded-[var(--hl-radius)] border border-[var(--hl-border)] bg-white p-2 sm:grid-cols-3 lg:grid-cols-1">{(Object.keys(names) as Section[]).map(section=><button key={section} type="button" onClick={()=>select(section)} aria-current={active===section?'page':undefined} className={`min-h-11 rounded-xl px-4 py-3 text-left text-sm font-bold transition-colors ${active===section?'bg-[var(--hl-primary)] text-white':'text-[var(--hl-ink)] hover:bg-[var(--hl-page)]'}`}>{names[section]}</button>)}</nav><div className="min-w-0" key={active}>{active==='store'?<StoreDetailsSection onDirty={setDirty}/>:active==='shipping'?<ShippingSection onDirty={setDirty}/>:<GiftingSection onDirty={setDirty}/>}</div></div>
    {pending&&<div role="presentation" className="fixed inset-0 z-[100] grid place-items-center bg-[#19151f]/40 p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setPending(null)}}><div ref={modal} role="dialog" aria-modal="true" aria-labelledby="unsaved-title" className="w-full max-w-md rounded-[var(--hl-radius)] border border-[var(--hl-border)] bg-white p-6 shadow-[var(--hl-shadow-lg)]"><h2 id="unsaved-title" className="text-xl">Unsaved changes</h2><p className="mt-2 text-sm text-[var(--hl-muted)]">Changes in {names[active]} have not been saved.</p><div className="mt-6 flex flex-wrap justify-end gap-2"><button onClick={()=>{setPending(null);focusReturn.current?.focus()}} className="min-h-11 rounded-xl border px-4 text-sm font-bold">Keep editing</button><button onClick={discard} className="min-h-11 rounded-xl bg-[var(--hl-primary)] px-4 text-sm font-bold text-white">Discard changes</button></div></div></div>}
  </section>;
}
