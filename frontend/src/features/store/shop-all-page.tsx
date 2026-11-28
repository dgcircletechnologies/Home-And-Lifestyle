'use client';

import { StoreBreadcrumb } from '../../components/store-breadcrumb';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, Check, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { catalog, type ShopPage } from './catalog';
import { ProductCard } from './storefront-ui';

const groups = ['category', 'material', 'colour', 'room', 'style', 'size', 'finish', 'collection', 'tag'] as const;
type Group = typeof groups[number];
const names: Record<Group, string> = {
  category: 'Category and subcategory', material: 'Material', colour: 'Colour', room: 'Room', style: 'Style',
  size: 'Size', finish: 'Finish', collection: 'Collection', tag: 'Tag',
};
const sorts = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price-asc', label: 'Price: Low to high' },
  { value: 'price-desc', label: 'Price: High to low' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
] as const;
const keys = [...groups, 'stock', 'sale', 'min', 'max'] as const;
type Draft = Record<(typeof keys)[number], string>;
const read = (query: URLSearchParams) => Object.fromEntries(keys.map(key => [key, query.get(key) ?? ''])) as Draft;
const count = (draft: Draft) => groups.reduce((sum, key) => sum + (draft[key] ? draft[key].split(',').filter(Boolean).length : 0), 0)
  + Number(Boolean(draft.stock)) + Number(Boolean(draft.sale)) + Number(Boolean(draft.min)) + Number(Boolean(draft.max));
const pageNumbers = (page: number, total: number) => Array.from(new Set([1, total, page - 1, page, page + 1].filter(n => n >= 1 && n <= total))).sort((a, b) => a - b);

export function ShopAllPage() {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams(), query = params.toString();
  const current = new URLSearchParams(query), applied = read(current), sort = current.get('sort') ?? 'newest';
  const [data, setData] = useState<ShopPage | null>(null);
  const [error, setError] = useState(false), [loading, setLoading] = useState(true), [retry, setRetry] = useState(0);
  const [drawer, setDrawer] = useState<'closed' | 'open' | 'closing'>('closed');
  const [draft, setDraft] = useState<Draft>(applied), [priceError, setPriceError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['category', 'price', 'availability']));
  const [sortOpen, setSortOpen] = useState(false);
  const filterTrigger = useRef<HTMLButtonElement>(null), filterPanel = useRef<HTMLDivElement>(null);
  const drawerReturnFocus = useRef<HTMLElement | null>(null), pendingGroup = useRef<string | null>(null);
  const sortTrigger = useRef<HTMLButtonElement>(null), sortBox = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null), firstLoad = useRef(true), request = useRef(0), closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigate = (update: (next: URLSearchParams) => void) => {
    setLoading(true);
    const next = new URLSearchParams(query);
    update(next);
    router.push(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
  const closeDrawer = () => {
    if (drawer === 'closed' || drawer === 'closing') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setDrawer('closed'); return; }
    setDrawer('closing');
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setDrawer('closed'), 280);
  };
  const openDrawer = (group?: Group | 'price' | 'availability') => {
    drawerReturnFocus.current = document.activeElement as HTMLElement | null;
    pendingGroup.current = group ?? null;
    setDraft(read(new URLSearchParams(query)));
    setPriceError('');
    setExpanded(new Set(['category', 'price', 'availability', ...(group ? [group] : [])]));
    setSortOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDrawer('open');
  };
  const toggleGroup = (group: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(group)) next.delete(group); else next.add(group);
    return next;
  });

  useEffect(() => {
    const controller = new AbortController(), id = ++request.current;
    const input = new URLSearchParams(query);
    if (!input.has('page')) input.set('page', '1');
    catalog.shop(input, controller.signal).then(value => {
      if (id !== request.current) return;
      setData(value); setError(false); setLoading(false);
      const requested = Number(input.get('page'));
      if (value.page !== requested) {
        const next = new URLSearchParams(query); next.set('page', String(value.page));
        router.replace(`${pathname}?${next}`, { scroll: false });
      }
      if (!firstLoad.current) heading.current?.scrollIntoView({ behavior: 'instant', block: 'start' });
      firstLoad.current = false;
    }).catch(() => { if (id === request.current && !controller.signal.aborted) { setError(true); setLoading(false); } });
    return () => controller.abort();
  }, [query, retry, router, pathname]);

  useEffect(() => {
    if (drawer === 'closed') return;
    const originalOverflow = document.body.style.overflow, restoreTo = drawerReturnFocus.current ?? filterTrigger.current;
    document.body.style.overflow = 'hidden';
    const groupButton = pendingGroup.current ? filterPanel.current?.querySelector<HTMLElement>(`[data-filter-group="${pendingGroup.current}"]`) : null;
    (groupButton ?? filterPanel.current?.querySelector<HTMLElement>('button'))?.focus();
    groupButton?.scrollIntoView({ block: 'nearest' });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { closeDrawer(); return; }
      if (event.key !== 'Tab') return;
      const elements = filterPanel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = originalOverflow; document.removeEventListener('keydown', onKey); restoreTo?.focus(); };
  // Focus and scroll lock persist through the closing transition.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer === 'closed']);
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);
  useEffect(() => {
    if (!sortOpen) return;
    sortBox.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    const outside = (event: PointerEvent) => { if (!sortBox.current?.contains(event.target as Node)) setSortOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSortOpen(false); sortTrigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', onKey); };
  }, [sortOpen]);
  const sortKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const options = [...(sortBox.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = options.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % options.length : (index - 1 + options.length) % options.length;
    options[next]?.focus();
  };
  const apply = () => {
    const min = draft.min === '' ? null : Number(draft.min), max = draft.max === '' ? null : Number(draft.max);
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && min > max)) {
      setPriceError('Enter non-negative prices with minimum no greater than maximum.'); return;
    }
    navigate(next => { for (const key of keys) { next.delete(key); if (draft[key]) next.set(key, draft[key]); } next.delete('page'); });
    closeDrawer();
  };
  const clear = () => navigate(next => { keys.forEach(key => next.delete(key)); next.delete('page'); });
  const filterSummaries: { key: Group | 'price' | 'availability'; label: string }[] = groups.flatMap(group => {
    const selected = applied[group].split(',').filter(Boolean);
    if (!selected.length) return [];
    const labels = selected.map(value => data?.filters[group]?.find(option => option.value === value)?.label ?? value);
    return [{ key: group, label: `${group === 'category' ? 'Category' : names[group]}: ${labels.join(', ')}` }];
  });
  if (applied.min || applied.max) filterSummaries.push({ key: 'price', label: `Price: ${applied.min ? `from ₹${applied.min}` : ''}${applied.min && applied.max ? ' ' : ''}${applied.max ? `up to ₹${applied.max}` : ''}` });
  if (applied.stock || applied.sale) filterSummaries.push({ key: 'availability', label: `Availability: ${[applied.stock && 'In stock', applied.sale && 'On sale'].filter(Boolean).join(', ')}` });
  const active = count(applied), total = data?.total ?? 0, displayPage = data?.page ?? 1, pageSize = data?.pageSize ?? 20;
  const optionGroup = (group: Group) => {
    const options = data?.filters[group] ?? [], chosen = (draft[group] ?? '').split(',').filter(Boolean), visible = [...options];
    for (const value of chosen) if (!visible.some(option => option.value === value)) visible.push({ value, label: value });
    if (!visible.length) return null;
    return <section className="shop-filter-group" key={group}>
      <h3><button type="button" data-filter-group={group} aria-expanded={expanded.has(group)} aria-controls={`shop-options-${group}`} onClick={() => toggleGroup(group)}>{names[group]}<ChevronDown size={17}/></button></h3>
      {expanded.has(group) && <div id={`shop-options-${group}`} className="shop-filter-options">{visible.map(option => <label key={option.value}>
        <input type="checkbox" checked={chosen.includes(option.value)} onChange={() => setDraft(previous => {
          const values = new Set((previous[group] ?? '').split(',').filter(Boolean));
          if (values.has(option.value)) values.delete(option.value); else values.add(option.value);
          return { ...previous, [group]: [...values].join(',') };
        })}/>{group === 'colour' && <i className="shop-colour-swatch" aria-hidden="true" style={{ backgroundColor: option.value }}/>}<span>{option.label}</span>
      </label>)}</div>}
    </section>;
  };
  return <div className="store-browse store-shop">
    <div className="store-browse-intro"><StoreBreadcrumb current="Shop All"/><h1 ref={heading} tabIndex={-1}>Shop All</h1></div>
    <div className="shop-toolbar">
      <button ref={filterTrigger} type="button" onClick={() => openDrawer()}><SlidersHorizontal size={18}/><span>Filters</span>{active > 0 && <span className="shop-filter-count">{active}</span>}</button>
      <div ref={sortBox} className="shop-sort" onKeyDown={sortKey}>
        <button ref={sortTrigger} type="button" aria-expanded={sortOpen} aria-haspopup="listbox" onClick={() => setSortOpen(value => !value)}><ArrowDownUp size={17}/><span>Sort by: <strong>{sorts.find(option => option.value === sort)?.label ?? 'Newest first'}</strong></span><ChevronDown className="shop-sort-chevron" size={15}/></button>
        {sortOpen && <div role="listbox" aria-label="Sort products" className="shop-sort-menu">{sorts.map(option => <button key={option.value} type="button" role="option" aria-selected={sort === option.value} onClick={() => { navigate(next => { next.set('sort', option.value); next.delete('page'); }); setSortOpen(false); }}><span>{option.label}</span>{sort === option.value && <Check size={17}/>}</button>)}</div>}
      </div>
    </div>
    <p className="store-result-count" role="status" aria-live="polite">{loading && data ? 'Updating results… ' : ''}{data ? total ? `Showing ${(displayPage - 1) * pageSize + 1}–${Math.min(displayPage * pageSize, total)} of ${total} products` : 'Showing 0 products' : 'Finding pieces…'}</p>
    {active > 0 && <div className="shop-chips" aria-label="Applied filters">{filterSummaries.map(filter => <button key={filter.key} type="button" onClick={() => openDrawer(filter.key)} aria-label={`Edit ${filter.label}`}>{filter.label}<ChevronDown size={13}/></button>)}<button className="shop-clear" onClick={clear}>Clear all filters</button></div>}
    {error ? <div className="store-empty" role="alert"><h2>Couldn’t load the catalogue</h2><button onClick={() => setRetry(n => n + 1)}>Try again</button><button onClick={() => router.push('/shop')}>Reset view</button></div>
      : loading && !data ? <div className="store-product-grid" aria-label="Loading products">{Array.from({ length: 8 }, (_, i) => <div className="shop-skeleton" key={i}><div/><span/><span/></div>)}</div>
      : data?.items.length ? <><div className="store-product-grid" aria-busy={loading}>{data.items.map(product => <ProductCard key={product.id} product={product} shop/>)}</div>{data.totalPages > 1 && <nav className="shop-pagination" aria-label="Product pages"><button disabled={displayPage === 1} onClick={() => navigate(next => next.set('page', String(displayPage - 1)))}>Previous</button>{pageNumbers(displayPage, data.totalPages).map((number, index, list) => <span key={number}>{index > 0 && number - list[index - 1] > 1 && <span aria-hidden="true">…</span>}<button aria-current={number === displayPage ? 'page' : undefined} aria-label={`Page ${number}`} onClick={() => navigate(next => next.set('page', String(number)))}>{number}</button></span>)}<button disabled={displayPage === data.totalPages} onClick={() => navigate(next => next.set('page', String(displayPage + 1)))}>Next</button></nav>}</>
        : <div className="store-empty"><h2>{active ? 'No products match these filters' : 'No products yet'}</h2><p>{active ? 'Try clearing a filter to see more pieces.' : 'The public catalogue is empty right now.'}</p>{active && <button onClick={clear}>Clear filters</button>}</div>}
    {drawer !== 'closed' && <div className={`shop-filter-layer ${drawer === 'open' ? 'is-open' : 'is-closing'}`} onTransitionEnd={event => { if (drawer === 'closing' && event.target === event.currentTarget) setDrawer('closed'); }}>
      <button className="shop-filter-backdrop" aria-label="Dismiss filter panel" onClick={closeDrawer}/>
      <div ref={filterPanel} role="dialog" aria-modal="true" aria-labelledby="shop-filter-title" className="shop-filter-drawer">
        <header><h2 id="shop-filter-title">Filters</h2><button type="button" aria-label="Close filters" onClick={closeDrawer}><X size={21}/></button></header>
        <div className="shop-filter-scroll">{optionGroup('category')}
          <section className="shop-filter-group"><h3><button type="button" data-filter-group="price" aria-expanded={expanded.has('price')} aria-controls="shop-options-price" onClick={() => toggleGroup('price')}>Price in INR<ChevronDown size={17}/></button></h3>{expanded.has('price') && <div id="shop-options-price" className="shop-filter-options"><div className="shop-price"><label>Minimum<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.min} onChange={event => setDraft({ ...draft, min: event.target.value })} placeholder="₹ Min"/></label><label>Maximum<input type="number" min="0" step="0.01" inputMode="decimal" value={draft.max} onChange={event => setDraft({ ...draft, max: event.target.value })} placeholder="₹ Max"/></label></div>{priceError && <p role="alert" className="shop-price-error">{priceError}</p>}</div>}</section>
          {groups.filter(group => group !== 'category').map(optionGroup)}
          <section className="shop-filter-group"><h3><button type="button" data-filter-group="availability" aria-expanded={expanded.has('availability')} aria-controls="shop-options-availability" onClick={() => toggleGroup('availability')}>Availability<ChevronDown size={17}/></button></h3>{expanded.has('availability') && <div id="shop-options-availability" className="shop-filter-options"><label><input type="checkbox" checked={draft.stock === 'true'} onChange={event => setDraft({ ...draft, stock: event.target.checked ? 'true' : '' })}/><span>In stock</span></label>{(data?.onSale || draft.sale) && <label><input type="checkbox" checked={draft.sale === 'true'} onChange={event => setDraft({ ...draft, sale: event.target.checked ? 'true' : '' })}/><span>On sale</span></label>}</div>}</section>
        </div>
        <footer><button type="button" onClick={() => { setDraft(read(new URLSearchParams())); setPriceError(''); }}>Clear all</button><button type="button" onClick={apply}>Apply filters</button></footer>
      </div>
    </div>}
  </div>;
}
