"use client";

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { productsService, type Product, type ProductStatus } from './products';
import { settingsService } from './settings';

type Category = { id: string; name: string; parent: { name: string } | null; status: string };
type VariantDraft = { key: string; id?: string; sku: string; price: string; stock: string; attributes: { title: string; value: string }[] };
const emptyVariant = (): VariantDraft => ({ key: crypto.randomUUID(), sku: '', price: '', stock: '0', attributes: [] });
const slugify = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 140) || 'product';
const validSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const inputClass = 'mt-2 w-full rounded-xl border border-[var(--hl-border)] bg-white px-4 py-3 text-base outline-none transition focus:border-[var(--hl-primary)] focus:ring-2 focus:ring-[var(--hl-primary)]/15';
const cardClass = 'rounded-2xl border border-[var(--hl-border)] bg-[var(--hl-surface)] p-5 shadow-sm sm:p-7';
const errorText = (error: unknown) => error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
function PendingImage({ file, alt }: { file: File; alt: string }) { const [url, setUrl] = useState(''); useEffect(() => { const reader = new FileReader(); reader.onload = () => setUrl(String(reader.result ?? '')); reader.readAsDataURL(file); return () => reader.abort(); }, [file]); return url ? <img src={url} alt={alt} className="aspect-[4/5] w-full rounded-lg object-cover"/> : null; }

export function ProductEditorPage({ id }: { id?: string }) {
  const router = useRouter(); const listParams = useSearchParams();
  const [product, setProduct] = useState<Product>();
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<ProductStatus>('DRAFT');
  const [giftWrapEligible, setGiftWrapEligible] = useState<boolean | undefined>(undefined);
  const [newArrival, setNewArrival] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryLoading, setCategoryLoading] = useState(true);
  const [categoryError, setCategoryError] = useState('');
  const [categoryRetry, setCategoryRetry] = useState(0);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);
  const [variantError, setVariantError] = useState('');
  const [files, setFiles] = useState<File[]>([]); const [videoFile, setVideoFile] = useState<File | null>(null); const [videoPreview, setVideoPreview] = useState<string | null>(null); const [videoUrl, setVideoUrl] = useState<string | null>(null); const [removeVideo, setRemoveVideo] = useState(false); const [showVideo, setShowVideo] = useState(false);
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
      setStatus(value.status); setVideoUrl(value.videoUrl ?? null); setShowVideo(Boolean(value.showInHomeVideoShowcase)); setGiftWrapEligible(value.giftWrapEligible); setNewArrival(value.newArrival); setCategoryIds(value.categories.map((category) => category.id));
      setVariants(value.variants.map(item => ({ key: item.id, id: item.id, sku: item.sku, price: (item.pricePaise / 100).toFixed(2), stock: String(item.stockQuantity), attributes: Array.isArray(item.attributes) ? item.attributes : [] })));
      setLoading(false);
    }).catch((cause) => { if (active) { setLoadError(errorText(cause)); setLoading(false); } });
    return () => { active = false; };
  }, [id]);

  useEffect(() => { if (id) return; let active = true; settingsService.gifting().then(value => { if (active) setGiftWrapEligible(current => current ?? value.giftWrapDefaultEligible); }).catch(() => undefined); return () => { active = false; }; }, [id]);

  useEffect(() => {
    let active = true;
    productsService.categories(categorySearch).then((options) => {
      if (active) { setCategories(options); setCategoryError(''); setCategoryLoading(false); }
    }).catch((cause) => { if (active) { setCategoryError(errorText(cause)); setCategoryLoading(false); } });
    return () => { active = false; };
  }, [categorySearch, categoryRetry]);

  useEffect(() => () => { if (videoPreview) URL.revokeObjectURL(videoPreview); }, [videoPreview]);
  const selected = categoryIds.map((selectedId) => categories.find((category) => category.id === selectedId) ?? product?.categories.find((category) => category.id === selectedId)).filter((category) => category != null);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(''); setFieldError(''); setUploadError(''); setVariantError('');
    if (!slug.trim() || !validSlug.test(slug) || slug.length > 160) {
      setFieldError(!slug.trim() ? 'Slug is required.' : 'Use lowercase letters, numbers, and single hyphens only (up to 160 characters).'); slugRef.current?.focus(); return;
    }
    if (status === 'PUBLISHED' && categoryIds.length === 0) { setError('Choose at least one category before publishing.'); categoryRef.current?.focus(); return; }
    if ((product?.images.length ?? 0) + files.length < 1) { setUploadError('A primary image is required.'); return; }
    if ((product?.images.length ?? 0) <= 2 && (product?.images.length ?? 0) + files.length > 2) { setUploadError('Choose at most two images.'); return; }
    if (!variants.length || variants.some(item => !item.sku.trim() || !item.price || !Number.isFinite(Number(item.price)) || Number(item.price) <= 0 || !Number.isInteger(Number(item.stock)) || Number(item.stock) < 0)) { setVariantError('Every variant needs a SKU, a price above ₹0, and whole-number stock of 0 or more.'); return; }
    if (new Set(variants.map(item => item.sku.trim().toLowerCase())).size !== variants.length) { setVariantError('Each variant needs a unique SKU.'); return; }
    if (variants.some(item => item.attributes.some(row => (row.title.trim() || row.value.trim()) && (!row.title.trim() || !row.value.trim())))) { setVariantError('Each attribute needs both a title and a value.'); return; }
    const variantPayload = variants.map(item => ({ ...(item.id ? { id: item.id } : {}), sku: item.sku.trim(), pricePaise: Math.round(Number(item.price) * 100), stockQuantity: Number(item.stock), attributes: item.attributes.map(row => ({ title: row.title.trim(), value: row.value.trim() })).filter(row => row.title || row.value) }));
    setBusy(true);
    try {
      const uploadedFirst = Boolean(savedId && product && product.images.length === 0 && files[0]);
      if (uploadedFirst) await productsService.uploadImage(savedId!, files[0]);
      const saved = savedId
        ? await productsService.update(savedId, { name, slug, description, categoryIds, variants: variantPayload, giftWrapEligible, newArrival })
        : await productsService.createWithImages({ name, slug, description, categoryIds, variants: variantPayload, giftWrapEligible, newArrival }, files);
      setSavedId(saved.id);
      for (const file of [...(id || product ? (uploadedFirst ? files.slice(1) : files) : [])]) {
        try { await productsService.uploadImage(saved.id, file); setFiles((pending) => pending.filter((item) => item !== file)); }
        catch (cause) { setUploadError(`${file.name}: ${errorText(cause)} Product details were saved. Retry the remaining images here.`); return; }
      }
      if (removeVideo && product?.videoUrl) await productsService.removeVideo(saved.id);
      if (videoFile) await productsService.uploadVideo(saved.id, videoFile);
      if (showVideo !== Boolean(saved.showInHomeVideoShowcase) || videoFile || removeVideo) await productsService.update(saved.id, { showInHomeVideoShowcase: Boolean(showVideo && (videoFile || (!removeVideo && videoUrl))) });
      if (status !== saved.status) await productsService.status(saved.id, status);
      router.push(`/admin/products/${saved.id}?${listParams}`);
      router.refresh();
    } catch (cause) {
      const detail = errorText(cause);
      if (/slug/i.test(detail) && !/SKU/i.test(detail)) { setFieldError(detail.includes('already exists') ? 'This slug is already used. Choose another.' : detail); slugRef.current?.focus(); }
      else setError(detail);
    } finally { setBusy(false); }
  };

  if (loading) return <p className="py-16 text-center">Loading product…</p>;
  if (loadError) return <div role="alert" className="py-10 text-[var(--hl-error)]">{loadError} <Link href={`/admin/products?${listParams}`} className="underline">Back to products</Link></div>;

  return <div className="mx-auto max-w-5xl pb-16">
    <Link href={`/admin/products?${listParams}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--hl-primary)] hover:underline">← Back to products</Link>
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
        <section className={cardClass}><h2 className="font-[family-name:var(--font-display)] text-2xl">Gifting</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">Product eligibility overrides the store default. Existing products are never changed when the default changes.</p><label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={giftWrapEligible ?? false} onChange={(event) => setGiftWrapEligible(event.target.checked)} className="size-5 accent-[var(--hl-primary)]" />Eligible for gift wrapping</label></section>
        <section className={cardClass}><h2 className="font-[family-name:var(--font-display)] text-2xl">Product images</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">One primary image is required. Add one optional secondary image for hover. JPEG, PNG, or WebP, up to 5 MB each.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">{[0,1].map(index => { const existing = product?.images[index]; const pending = files[index - (product?.images.length ?? 0)]; return <div key={index} className="rounded-xl border border-[var(--hl-border)] p-3"><p className="mb-3 text-sm font-semibold">{index === 0 ? 'Primary Image *' : 'Secondary / Hover Image'}</p>{existing ? <><img src={existing.url} alt={existing.altText || `${name} image ${index + 1}`} className="aspect-[4/5] w-full rounded-lg object-cover"/><div className="mt-3 flex flex-wrap gap-3"><label className="cursor-pointer text-sm font-semibold text-[var(--hl-primary)]">Replace<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={async event => { const file = event.target.files?.[0]; if (!file || !savedId) return; setBusy(true); try { await productsService.replaceImage(savedId, existing.id, file); setProduct(await productsService.detail(savedId)); } catch (cause) { setUploadError(errorText(cause)); } finally { setBusy(false); event.target.value = ''; } }}/></label><button type="button" disabled={busy || product?.images.length === 1} className="text-sm font-semibold text-[var(--hl-error)]" onClick={async () => { if (!savedId) return; setBusy(true); try { await productsService.removeImage(savedId, existing.id); setProduct(await productsService.detail(savedId)); } catch (cause) { setUploadError(errorText(cause)); } finally { setBusy(false); } }}>Remove</button></div></> : pending ? <div className="text-sm"><PendingImage file={pending} alt={`${name} pending image`}/><p className="mt-2 truncate">{pending.name}</p><button type="button" onClick={() => setFiles(current => current.filter(file => file !== pending))} className="mt-2 font-semibold text-[var(--hl-error)]">Remove</button></div> : <label className="grid aspect-[4/5] cursor-pointer place-content-center rounded-lg border border-dashed border-[var(--hl-border)] text-center text-sm font-semibold text-[var(--hl-primary)]">Choose image<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={event => { const selected = event.target.files?.[0]; if (selected) setFiles(current => [...current, selected].slice(0, Math.max(0, 2 - (product?.images.length ?? 0)))); event.target.value = ''; }}/></label>}</div>; })}</div>{product && product.images.length > 2 && <div className="mt-4 text-sm"><p>Legacy gallery has {product.images.length} images. Keep or replace the first two; remove extras to add new images.</p>{product.images.slice(2).map(image => <button type="button" key={image.id} onClick={async () => { await productsService.removeImage(product.id, image.id); setProduct(await productsService.detail(product.id)); }} className="mr-3 mt-2 text-[var(--hl-error)] underline">Remove extra image</button>)}</div>}{uploadError && <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">{uploadError}</p>}</section>
        <section className={cardClass}><h2 className="font-[family-name:var(--font-display)] text-2xl">Product Video (Optional)</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">MP4, WebM, or MOV, up to 50 MB.</p>{(videoPreview || (!removeVideo && videoUrl)) && <video src={videoPreview ?? videoUrl ?? undefined} controls muted playsInline className="mt-4 aspect-video w-full rounded-xl bg-black object-contain"/>}<div className="mt-4 flex flex-wrap gap-3"><label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border px-4 text-sm font-semibold text-[var(--hl-primary)]">{videoUrl ? 'Replace video' : 'Upload video'}<input type="file" accept="video/mp4,video/webm,video/quicktime,.mov" className="sr-only" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 50 * 1024 * 1024) { setUploadError('Video must be 50 MB or smaller.'); return; } setVideoFile(file); setVideoPreview(URL.createObjectURL(file)); setRemoveVideo(false); event.target.value = ''; }}/></label>{(videoFile || (videoUrl && !removeVideo)) && <button type="button" onClick={() => { setVideoFile(null); setVideoPreview(null); setRemoveVideo(true); setShowVideo(false); }} className="text-sm font-semibold text-[var(--hl-error)]">Remove Video</button>}</div>{videoFile && <p className="mt-2 text-xs" role="status">{videoFile.name} will upload when you save.</p>}<label className="mt-5 flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={showVideo} disabled={!videoFile && (!videoUrl || removeVideo)} onChange={event => setShowVideo(event.target.checked)} className="size-5 accent-[var(--hl-primary)]"/>Feature in Homepage Video Section</label>{!videoFile && (!videoUrl || removeVideo) && <p className="mt-2 text-xs text-[var(--hl-muted)]">Upload a video first to feature this product in the homepage video section</p>}</section>
        <section className={cardClass}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-[family-name:var(--font-display)] text-2xl">Variants (SKUs)</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">Each SKU has its own price, stock, and optional features.</p></div><button type="button" onClick={() => setVariants(current => [...current, emptyVariant()])} className="min-h-11 rounded-xl border px-4 font-semibold text-[var(--hl-primary)]">+ Add Variant</button></div>
          {variantError && <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">{variantError}</p>}
          <div className="mt-5 grid gap-4">{variants.map((item, index) => { const duplicate = variants.some(other => other.key !== item.key && other.sku.trim().toLowerCase() === item.sku.trim().toLowerCase() && item.sku.trim()); const change = (patch: Partial<VariantDraft>) => setVariants(current => current.map(row => row.key === item.key ? { ...row, ...patch } : row)); return <div key={item.key} className="rounded-xl border border-[var(--hl-border)] p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">Variant {index + 1}</h3>{variants.length > 1 && <button type="button" onClick={() => setVariants(current => current.filter(row => row.key !== item.key))} className="min-h-10 text-sm font-semibold text-[var(--hl-error)]">Remove Variant</button>}</div><div className="mt-3 grid gap-4 sm:grid-cols-3"><label className="text-sm font-semibold">SKU *<input required value={item.sku} onChange={event => change({ sku: event.target.value })} aria-invalid={duplicate} className={inputClass}/>{duplicate && <span className="text-xs text-[var(--hl-error)]">This SKU is repeated.</span>}</label><label className="text-sm font-semibold">Price (₹) *<input required type="number" min="0.01" step="0.01" value={item.price} onChange={event => change({ price: event.target.value })} className={inputClass}/></label><label className="text-sm font-semibold">Stock *<input required type="number" min="0" step="1" value={item.stock} onChange={event => change({ stock: event.target.value })} className={inputClass}/></label></div><div className="mt-5"><p className="text-sm font-semibold">Features / Attributes (Optional)</p>{item.attributes.map((row, position) => <div key={position} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold">Title<input value={row.title} onChange={event => change({ attributes: item.attributes.map((entry, i) => i === position ? { ...entry, title: event.target.value } : entry) })} className={inputClass} placeholder="Size"/></label><label className="text-xs font-semibold">Value<input value={row.value} onChange={event => change({ attributes: item.attributes.map((entry, i) => i === position ? { ...entry, value: event.target.value } : entry) })} className={inputClass} placeholder="Large"/></label><button type="button" onClick={() => change({ attributes: item.attributes.filter((_, i) => i !== position) })} className="self-end min-h-11 text-sm text-[var(--hl-error)]">Remove</button></div>)}<button type="button" onClick={() => change({ attributes: [...item.attributes, { title: '', value: '' }] })} className="mt-3 min-h-10 text-sm font-semibold text-[var(--hl-primary)]">+ Add Attribute</button></div></div>; })}</div>
        </section>
      </div>
      <aside className={`hidden lg:block ${cardClass}`}>{organization()}</aside>
      {error && <p role="alert" className="text-sm text-[var(--hl-error)] lg:col-span-2">{error}</p>}
      <div className="flex flex-wrap items-center justify-end gap-4 border-t border-[var(--hl-border)] pt-5 lg:col-span-2"><Link href={`/admin/products?${listParams}`} className="inline-flex min-h-11 items-center px-4 text-sm font-semibold text-[var(--hl-muted)] hover:text-[var(--hl-primary)]">Cancel</Link><button disabled={busy} className="inline-flex items-center justify-center bg-[var(--hl-primary)] text-white hover:bg-[var(--hl-primary-hover)] min-h-12 rounded-xl px-7 font-semibold disabled:opacity-60">{busy ? 'Saving…' : id ? 'Save changes' : 'Create product'}</button></div>
    </form>
  </div>;

  function organization() { return <><h2 className="font-[family-name:var(--font-display)] text-2xl">Organization</h2><p className="mt-1 text-sm text-[var(--hl-muted)]">Control visibility and where this product appears.</p><label className="mt-6 block text-sm font-semibold">Product status<select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus)} className={inputClass}><option value="DRAFT">Draft</option><option value="PUBLISHED">Published</option><option value="ARCHIVED">Archived</option></select></label><p className="mt-2 text-xs text-[var(--hl-muted)]">Publishing requires at least one category and a sellable SKU.</p><label className="mt-5 flex min-h-11 items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={newArrival} onChange={event=>setNewArrival(event.target.checked)} className="size-5 accent-[var(--hl-primary)]"/>New Arrival</label><p className="text-xs text-[var(--hl-muted)]">Published products with this tag appear in the storefront New Arrivals view, newest first.</p><div className="mt-6"><label htmlFor="category-search" className="text-sm font-semibold">Categories</label><input id="category-search" ref={categoryRef} value={categorySearch} onChange={(event) => { setCategorySearch(event.target.value); setCategoryLoading(true); }} placeholder="Search categories" className={inputClass} />{selected.length > 0 && <p className="mt-2 text-xs text-[var(--hl-primary)]">Selected: {selected.map((category) => category.name).join(', ')}</p>}{categoryLoading ? <p className="mt-3 text-sm text-[var(--hl-muted)]">Loading categories…</p> : categoryError ? <p role="alert" className="mt-3 text-sm text-[var(--hl-error)]">Could not load categories. <button type="button" onClick={() => { setCategoryLoading(true); setCategoryRetry((count) => count + 1); }} className="underline">Retry</button></p> : categories.length === 0 ? <p className="mt-3 text-sm text-[var(--hl-muted)]">{categorySearch ? 'No matching categories.' : 'No categories available.'}</p> : <div className="mt-3 max-h-60 space-y-1 overflow-y-auto rounded-xl border border-[var(--hl-border)] p-2">{categories.map((category) => <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-[var(--hl-page)]"><input type="checkbox" checked={categoryIds.includes(category.id)} onChange={(event) => setCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((value) => value !== category.id))} className="size-4 accent-[var(--hl-primary)]" /><span className="min-w-0 break-words">{category.parent ? `${category.parent.name} / ` : ''}{category.name}{category.status === 'INACTIVE' ? ' (inactive)' : ''}</span></label>)}</div>}</div></>; }
}
