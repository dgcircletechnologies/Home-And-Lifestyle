"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { productsService, type Product, type ProductStatus } from './products';

type Category = { id: string; name: string; parent: { name: string } | null; status: string };
const slugify = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140) || 'product';
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const inputClass = 'mt-2 w-full rounded-xl border border-[var(--hl-border)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--hl-primary)] focus:ring-2 focus:ring-[var(--hl-primary)]/15';
const cardClass = 'rounded-2xl border border-[var(--hl-border)] bg-[var(--hl-surface)] p-5 shadow-sm sm:p-7';
const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';

export function ProductEditorPage({ id }: { id?: string }) {
  const router = useRouter();
  const [product, setProduct] = useState<Product>();
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('DRAFT');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [savedId, setSavedId] = useState(id);
  const [uploadError, setUploadError] = useState('');
  const slugRef = useRef<HTMLInputElement>(null);
  const categoryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    productsService.detail(id).then((value) => {
      if (!active) return;
      setProduct(value); setName(value.name); setSlug(value.slug); setDescription(value.description);
      setStatus(value.status); setCategoryIds(value.categories.map((category) => category.id)); setLoading(false);
    }).catch((cause) => { if (active) { setLoadError(errorText(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    let active = true;
    productsService.categories(categorySearch).then((options) => {
      if (active) { setCategories(options); setCategoryError(''); setCategoryLoading(false); }
    }).catch((cause) => { if (active) { setCategoryError(errorText(cause)); setCategoryLoading(false); } });
    return () => { active = false; };
  }, [categorySearch, categoryRetry]);

  const selected = categoryIds.map((selectedId) => categories.find((category) => category.id === selectedId) ?? product?.categories.find((category) => category.id === selectedId)).filter((category) => category != null);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setFieldError(''); setUploadError('');
    if (!slug.trim() || !validSlug.test(slug) || slug.length > 160) {
      setFieldError(!slug.trim() ? 'Slug is required.' : 'Use lowercase letters, numbers, and single hyphens only (up to 160 characters).'); slugRef.current?.focus(); return;
    }
    if (status === 'PUBLISHED' && categoryIds.length === 0) { setError('Choose at least one category before publishing.'); categoryRef.current?.focus(); return; }
    setBusy(true);
    try {
      const saved = savedId
        ? await productsService.update(savedId, { name, slug, description, categoryIds })
        : await productsService.create({ name, slug, description, categoryIds, sku: sku || undefined, pricePaise: Math.round(Number(price) * 100), stockQuantity: Number(stock) });
      setSavedId(saved.id);
      if (status !== saved.status) await productsService.status(saved.id, status);
      for (const file of [...files]) {
        try { await productsService.uploadImage(saved.id, file); setFiles((pending) => pending.filter((item) => item !== file)); }
        catch (cause) { setUploadError(`${file.name}: ${errorText(cause)} Product details were saved. Retry the remaining images here.`); return; }
      }
      router.push(`/admin/products/${saved.id}`);
      router.refresh();
    } catch (cause) {
      const detail = errorText(cause);
      if (/slug|already exists|unique/i.test(detail)) { setFieldError(detail.includes('already exists') ? 'This slug is already used. Choose another.' : detail); slugRef.current?.focus(); }
      else setError(detail);
    } finally { setBusy(false); }
  };

  if (loading) return <p className="py-16 text-center">Loading product…</p>;
  if (loadError) return <div role="alert" className="py-10 text-[var(--hl-error)]">{loadError} <Link href="/admin/products" className="underline">Back to products</Link></div>;

  return <div className="mx-auto max-w-6xl pb-16">
    <Link href="/admin/products" className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--hl-primary)] hover:underline">← Back to products</Link>
    <div className="mb-7 mt-3 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[var(--hl-accent)]">Product management</p><h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl tracking-tight sm:text-5xl">{id ? 'Edit product' : 'Add product'}</h1><p className="mt-2 text-sm text-[var(--hl-muted)]">{id ? 'Update the details customers see and how this product is organized.' : 'Add the essentials, then choose how this product appears in the store.'}</p></div><button type="submit" form="product-editor" disabled={busy} className="inline-flex items-center justify-center bg-[var(--hl-primary)] text-white hover:bg-[var(--hl-primary-hover)] min-h-12 rounded-xl px-7 font-semibold shadow-sm disabled:opacity-60">{busy ? 'Saving…' : id ? 'Save changes' : 'Create product'}</button></div>
    <form id="product-editor" onSubmit={save} className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="grid min-w-0 gap-6">
        <section className={cardClass}><div className="mb-6"><h2 className="font-[family-name:var(--font-display)] text-2xl">Product information</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">The name and URL customers will use to find this item.</p></div>
          <label className="block text-sm font-semibold">Product name <span className="text-[var(--hl-error)]">*</span><input required maxLength={160} value={name} onChange={(event) => { const next = event.target.value; setName(next); if (!id && !slugTouched) setSlug(slugify(next)); }} className={inputClass} placeholder="e.g. Ceramic Vase" /></label>
          <label className="mt-5 block text-sm font-semibold">Slug <span className="text-[var(--hl-error)]">*</span><input ref={slugRef} required maxLength={160} value={slug} onInvalid={() => setFieldError('Slug is required.')} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value); setFieldError(''); }} aria-invalid={Boolean(fieldError)} aria-describedby="slug-help slug-error" className={inputClass} placeholder="ceramic-vase" /></label>
          <p id="slug-help" className="mt-2 break-all text-xs text-[var(--hl-muted)]">Product URL: /products/{slug || 'your-slug'}</p>{fieldError && <p id="slug-error" role="alert" className="mt-2 text-sm text-[var(--hl-error)]">{fieldError}</p>}
          <label className="mt-5 block text-sm font-semibold">Description <span className="text-[var(--hl-error)]">*</span><textarea required rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} placeholder="Describe the materials, design, and uses…" /></label>
        </section>
        <aside className={`lg:hidden ${cardClass}`}>{organization()}</aside>
        <section className={cardClass}><h2 className="font-[family-name:var(--font-display)] text-2xl">Product images</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">The first image is the primary photo. JPEG, PNG, or WebP, up to 5 MB per image.</p>
          {product?.images[0] && <div className="mt-5 overflow-hidden rounded-xl bg-[var(--hl-page)]"><img src={product.images[0].url} alt={product.images[0].altText || name} className="max-h-72 w-full object-contain" /><p className="p-3 text-sm font-semibold">Primary photo</p></div>}
          {product && product.images.length > 1 && <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{product.images.slice(1).map((image) => <img key={image.id} src={image.url} alt={image.altText || 'Gallery image'} className="aspect-square w-full rounded-xl object-cover" />)}</div>}
          {files.length > 0 && <div className="mt-4 grid gap-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"><span className="min-w-0 truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, position) => position !== index))} className="font-semibold text-[var(--hl-error)]">Remove</button></div>)}</div>}
          <label className="mt-5 inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[var(--hl-border)] px-5 font-semibold text-[var(--hl-primary)] hover:bg-[var(--hl-page)]">Add images<input type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { setFiles((current) => [...current, ...Array.from(event.target.files ?? [])]); event.target.value = ''; }} /></label>
          {uploadError && <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">{uploadError}</p>}
        </section>
        {!id && <section className={cardClass}><h2 className="font-[family-name:var(--font-display)] text-2xl">Pricing & inventory</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">A SKU is generated when left blank. Stock is tracked on the sellable variant.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Price (₹) <span className="text-[var(--hl-error)]">*</span><input required type="number" min="0" step=".01" value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} /></label><label className="text-sm font-semibold">Opening stock<input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} className={inputClass} /></label><label className="text-sm font-semibold sm:col-span-2">SKU (optional)<input value={sku} onChange={(event) => setSku(event.target.value)} className={inputClass} /></label></div></section>}
      </div>
      <aside className={`hidden lg:block ${cardClass}`}>{organization()}</aside>
      {error && <p role="alert" className="text-sm text-[var(--hl-error)] lg:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[var(--hl-border)] pt-5 lg:col-span-2"><Link href="/admin/products" className="inline-flex min-h-11 items-center px-4 text-sm font-semibold text-[var(--hl-muted)] hover:text-[var(--hl-primary)]">Cancel</Link><button disabled={busy} className="inline-flex items-center justify-center bg-[var(--hl-primary)] text-white hover:bg-[var(--hl-primary-hover)] min-h-12 rounded-xl px-7 font-semibold disabled:opacity-60">{busy ? 'Saving…' : id ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </div>;

  function organization() { return <><h2 className="font-[family-name:var(--font-display)] text-2xl">Organization</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">Control visibility and where this product appears.</p><label className="mt-6 block text-sm font-semibold">Product status<select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} className={inputClass}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><p className="mt-2 text-xs text-[var(--hl-muted)]">Publishing requires at least one category and a sellable SKU.</p><div className="mt-6"><label htmlFor="category-search" className="text-sm font-semibold">Categories</label><input id="category-search" ref={categoryRef} value={categorySearch} onChange={(event) => { setCategorySearch(event.target.value); setCategoryLoading(true); }} placeholder="Search categories" className={inputClass} />{selected.length > 0 && <p className="mt-2 text-xs text-[var(--hl-primary)]">Selected: {selected.map((category) => category.name).join(', ')}</p>}{categoryLoading ? <p className="mt-3 text-sm text-[var(--hl-muted)]">Loading categories…</p> : categoryError ? <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">Could not load categories. <button type="button" onClick={() => { setCategoryLoading(true); setCategoryRetry((count) => count + 1); }} className="underline">Retry</button></p> : categories.length === 0 ? <p className="mt-3 text-sm text-[var(--hl-muted)]">{categorySearch ? 'No matching categories.' : 'No categories available.'}</p> : <div className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-[var(--hl-border)] p-2">{categories.map((category) => <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[var(--hl-page)]"><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={(event) => setCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((value) => value !== category.id))} className="size-4 accent-[var(--hl-primary)]" /><span className="min-w-0 break-words">{category.parent ? `${category.parent.name} / ` : ''}{category.name}{category.status === 'INACTIVE' ? ' (inactive)' : ''}</span></label>)}</div>}</div></>; }
}
