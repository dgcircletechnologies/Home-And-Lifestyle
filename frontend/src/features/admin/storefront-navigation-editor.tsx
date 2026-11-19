'use client';

import { ArrowDown, ArrowUp, Plus, RotateCcw, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { categoryService, type StorefrontNavOption, type StorefrontNavOrder, type StorefrontNavOptions } from './categories';

type Item = StorefrontNavOrder['items'][number];
const message = (error: unknown) => error instanceof ApiError ? error.message : 'Could not reach the server. Try again.';

export function StorefrontNavigationEditor({ revision, onSaved }: { revision: number; onSaved: () => void }) {
  const [saved, setSaved] = useState<StorefrontNavOrder | null>(null);
  const [draft, setDraft] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [options, setOptions] = useState<StorefrontNavOptions | null>(null);
  const [optionsError, setOptionsError] = useState('');
  const [optionsRetry, setOptionsRetry] = useState(0);
  const dirty = saved !== null && draft.map(item => item.id).join('|') !== saved.items.map(item => item.id).join('|');

  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { const result = await categoryService.navigation(); setSaved(result); setDraft(result.items); setSaveError(''); setSavedNotice(false); }
    catch (error) { setLoadError(message(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load, revision]);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: '10' });
      if (search.trim()) params.set('search', search.trim());
      categoryService.navigationOptions(params, controller.signal).then(value => { setOptions(value); setOptionsError(''); }).catch(error => { if (!controller.signal.aborted) setOptionsError(message(error)); });
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [page, search, optionsRetry, revision]);

  const add = (option: StorefrontNavOption) => {
    if (draft.some(item => item.id === option.id)) return;
    setDraft(items => [...items, { id: option.id, name: option.name, slug: option.slug, status: option.status, position: items.length, visible: option.visible, reason: option.reason }]);
    setSaveError(''); setSavedNotice(false);
  };
  const move = (index: number, direction: number) => setDraft(items => {
    const next = [...items]; const destination = index + direction;
    if (destination < 0 || destination >= next.length) return items;
    [next[index], next[destination]] = [next[destination], next[index]];
    return next;
  });
  const save = async () => {
    if (!saved || !dirty || loading || saving || loadError) return;
    setSaving(true); setSaveError(''); setSavedNotice(false);
    try { const result = await categoryService.saveNavigation(draft.map(item => item.id), saved.version); setSaved(result); setDraft(result.items); setSavedNotice(true); onSaved(); }
    catch (error) { setSaveError(message(error)); }
    finally { setSaving(false); }
  };

  return <section aria-labelledby="storefront-navigation-title" className="mt-6 rounded-[var(--hl-radius)] border border-[var(--hl-border)] bg-[var(--hl-surface)] p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-[var(--hl-accent)]">Store header</p><h2 id="storefront-navigation-title" className="mt-1 text-xl">Storefront navigation</h2><p className="mt-1 max-w-2xl text-sm text-[var(--hl-muted)]">Choose top-level categories and their order. Categories without published products keep their place here until they become visible.</p></div><button type="button" onClick={() => void load()} disabled={loading || saving} className="hl-secondary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold"><RotateCcw size={15}/>Reload</button></div>
    {loading && !saved && !loadError && <p role="status" className="mt-5 text-sm text-[var(--hl-muted)]">Loading storefront navigation…</p>}
    {loadError && <div role="alert" className="mt-5 rounded-xl border border-[var(--hl-error)] p-4 text-sm text-[var(--hl-error)]">Could not load the saved navigation: {loadError} <button type="button" onClick={() => void load()} className="ml-2 font-bold underline">Retry</button></div>}
    {saved && !loadError && <>
      <p className="mt-5 break-words rounded-xl bg-[var(--hl-page)] p-3 text-sm font-semibold">Home · Shop All · New Arrivals{draft.map(item => ` · ${item.name}${item.visible ? '' : ' (hidden)'}`).join('')}</p>
      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)]">
        <div><h3 className="text-base font-bold">Selected categories</h3><ol className="mt-3 grid gap-2">{draft.map((item, index) => <li key={item.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[var(--hl-border)] p-2 sm:p-3"><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.name}</strong><span className="block text-xs text-[var(--hl-muted)]">{item.reason}</span></span><button type="button" aria-label={`Move ${item.name} up`} disabled={index === 0 || saving} onClick={() => move(index, -1)} className="grid size-10 shrink-0 place-items-center rounded-lg border disabled:opacity-40"><ArrowUp size={16}/></button><button type="button" aria-label={`Move ${item.name} down`} disabled={index === draft.length - 1 || saving} onClick={() => move(index, 1)} className="grid size-10 shrink-0 place-items-center rounded-lg border disabled:opacity-40"><ArrowDown size={16}/></button><button type="button" aria-label={`Remove ${item.name} from navigation`} disabled={saving} onClick={() => { setDraft(items => items.filter(value => value.id !== item.id)); setSaveError(''); setSavedNotice(false); }} className="grid size-10 shrink-0 place-items-center rounded-lg border text-[var(--hl-error)] disabled:opacity-40"><X size={16}/></button></li>)}</ol>{draft.length === 0 && <p className="mt-3 rounded-xl border border-dashed border-[var(--hl-border)] p-5 text-sm text-[var(--hl-muted)]">No optional category links selected. The three fixed links will remain.</p>}</div>
        <div><h3 className="text-base font-bold">Add a category</h3><label className="mt-3 grid gap-1 text-xs font-semibold">Search top-level categories<input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name or slug" className="min-h-11 rounded-xl border border-[var(--hl-border)] bg-white px-3 text-sm font-normal"/></label>{optionsError && <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">{optionsError} <button type="button" className="underline" onClick={() => setOptionsRetry(value => value + 1)}>Retry</button></p>}<ul className="mt-3 grid gap-1">{options?.items.map(option => <li key={option.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-[var(--hl-border)] px-3 py-2"><span className="min-w-0"><strong className="block truncate text-sm">{option.name}</strong><span className="block text-xs text-[var(--hl-muted)]">{option.reason}</span></span><button type="button" disabled={draft.some(item => item.id === option.id) || saving} onClick={() => add(option)} className="hl-secondary-button inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-bold disabled:opacity-50"><Plus size={14}/>{draft.some(item => item.id === option.id) ? 'Added' : 'Add'}</button></li>)}</ul>{options && options.items.length === 0 && <p className="mt-3 text-sm text-[var(--hl-muted)]">No categories match this search.</p>}{options && <div className="mt-3 flex items-center justify-between gap-2 text-xs"><span>{options.total} top-level categories · page {options.page}</span><div className="flex gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="min-h-9 rounded-lg border px-2 disabled:opacity-40">Previous</button><button type="button" disabled={page * options.pageSize >= options.total} onClick={() => setPage(value => value + 1)} className="min-h-9 rounded-lg border px-2 disabled:opacity-40">Next</button></div></div>}</div>
      </div>
      {saveError && <p role="alert" className="mt-4 text-sm text-[var(--hl-error)]">{saveError}{/reload/i.test(saveError) && <button type="button" onClick={() => void load()} className="ml-2 font-bold underline">Reload and review</button>}</p>}
      {savedNotice && <p role="status" className="mt-4 text-sm font-semibold text-[var(--hl-primary)]">Storefront navigation saved.</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-[var(--hl-border)] pt-4"><button type="button" disabled={!dirty || saving} onClick={() => { setDraft(saved.items); setSaveError(''); setSavedNotice(false); }} className="hl-secondary-button min-h-11 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">Discard changes</button><button type="button" disabled={!dirty || saving || loading} onClick={() => void save()} className="hl-primary-button min-h-11 rounded-xl px-5 text-sm font-bold disabled:opacity-50">{saving ? 'Saving…' : 'Save changes'}</button></div>
    </>}
  </section>;
}
