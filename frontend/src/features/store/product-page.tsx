'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ShoppingBag, Play } from 'lucide-react';
import { catalog, rupees, type StoreProduct, type StoreReviews, type StoreVariant } from './catalog';
import { StorePhoto } from './storefront-ui';
import { ProductAboutSection } from './product-about-section';
import { ProductReviewsSection } from './product-reviews-section';
import { useCart } from '../cart/cart-provider';

type Tab = 'about' | 'reviews';
const lowStock = (stock: number) => stock > 0 && stock <= 5;

export function ProductPage({ slug }: { slug: string }) {
  const [product, setProduct] = useState<StoreProduct>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [variantId, setVariantId] = useState('');
  const [image, setImage] = useState(0);
  const [tab, setTab] = useState<Tab>('about');
  const [notice, setNotice] = useState('');
  const [adding, setAdding] = useState(false);
  const cart = useCart();
  const [reviews, setReviews] = useState<StoreReviews>();
  const [reviewError, setReviewError] = useState('');
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);
  const aboutRef = useRef<HTMLButtonElement>(null);
  const reviewsRef = useRef<HTMLButtonElement>(null);
  const swipeStart = useRef<number | null>(null);

  useEffect(() => {
    let live = true;
    catalog.product(slug).then(value => {
      if (!live) return;
      setProduct(value);
      const sorted = [...value.variants].sort((a, b) => a.effectivePricePaise - b.effectivePricePaise || a.id.localeCompare(b.id));
      setVariantId((sorted.find(item => item.stockQuantity > 0) ?? sorted[0])?.id ?? '');
    }).catch(() => { if (live) setError('This piece is not available right now.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [slug]);

  const loadReviews = useCallback(async (page = 1) => {
    setReviewsLoading(true); setReviewError('');
    try {
      const next = await catalog.reviews(slug, page);
      setReviews(current => page === 1 || !current ? next : { ...next, items: [...current.items, ...next.items] });
    } catch { setReviewError('Reviews could not be loaded. Please try again.'); }
    finally { setReviewsLoading(false); }
  }, [slug]);
  useEffect(() => {
    let live = true;
    catalog.reviews(slug).then(value => { if (live) setReviews(value); })
      .catch(() => { if (live) setReviewError('Reviews could not be loaded. Please try again.'); })
      .finally(() => { if (live) setReviewsLoading(false); });
    return () => { live = false; };
  }, [slug]);

  if (loading) return <div className="store-detail store-pdp" role="status">Opening the piece…</div>;
  if (error || !product) return <div className="store-detail store-empty"><h1>Piece unavailable</h1><p>{error}</p><Link href="/shop">Explore other pieces</Link></div>;
  const chosen = product.variants.find(item => item.id === variantId);
  const images = (product.images ?? []).slice(0,2);
  const mediaCount = images.length + (product.videoUrl ? 1 : 0);
  const picture = images[image];
  const moveImage = (direction: number) => setImage(current => (current + direction + mediaCount) % mediaCount);
  const chooseReviews = () => {
    setTab('reviews');
    requestAnimationFrame(() => tabsRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }));
  };
  const addToCart = async (variant: StoreVariant) => { setAdding(true); setNotice(''); try { await cart.add(variant.id, 1); setNotice('Added to cart.'); } catch (reason) { setNotice(reason instanceof Error ? reason.message : 'Could not add this piece. Please try again.'); } finally { setAdding(false); } };
  const switchTab = (next: Tab) => { setTab(next); (next === 'about' ? aboutRef : reviewsRef).current?.focus(); };
  const reviewCount = reviews?.summary.reviewCount ?? 0;
  const stock = chosen?.stockQuantity ?? 0;

  return <div className="store-detail store-pdp">
    <nav className="store-breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span aria-hidden="true">/</span>{product.categories[0] && <><Link href={`/categories/${product.categories[0].slug}`}>{product.categories[0].name}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{product.name}</span></nav>
    <div className="store-pdp-grid">
      <section className="store-pdp-gallery" aria-label={`${product.name} gallery`}><div className="store-pdp-main" onTouchStart={event => { swipeStart.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => { if (swipeStart.current === null || mediaCount < 2) return; const distance = event.changedTouches[0]?.clientX - swipeStart.current; if (Math.abs(distance) > 50) moveImage(distance < 0 ? 1 : -1); swipeStart.current = null; }}>{product.videoUrl && image === images.length ? <video key={product.videoUrl} src={product.videoUrl} poster={images[0]?.url} controls playsInline preload="metadata" aria-label={`${product.name} video`}/> : <StorePhoto key={picture?.url ?? 'missing'} url={picture?.url} alt={picture?.altText || product.name} priority/>}{mediaCount > 1 && <><button type="button" className="store-gallery-arrow store-gallery-prev" aria-label="Previous gallery item" onClick={() => moveImage(-1)}><ArrowLeft size={21}/></button><button type="button" className="store-gallery-arrow store-gallery-next" aria-label="Next gallery item" onClick={() => moveImage(1)}><ArrowRight size={21}/></button><span className="store-gallery-count" aria-live="polite">{image + 1} / {mediaCount}</span></>}</div>{mediaCount > 1 && <div className="store-pdp-thumbnails" aria-label="Product media">{images.map((item, index) => <button type="button" key={`${item.url}-${index}`} aria-label={`Show image ${index + 1}`} aria-pressed={image === index} onClick={() => setImage(index)}><img src={item.url} alt=""/></button>)}{product.videoUrl && <button type="button" className="store-pdp-video-thumb" aria-label="Show product video" aria-pressed={image === images.length} onClick={() => setImage(images.length)}>{images[0]?.url && <img src={images[0].url} alt=""/>}<Play size={22} aria-hidden="true"/></button>}</div>}</section>
      <section className="store-pdp-summary" aria-label="Product information"><p className="store-kicker">{product.categories[0]?.name ?? 'Home & Lifestyle'}</p><h1>{product.name}</h1><button type="button" className="store-pdp-rating" onClick={chooseReviews} aria-label={reviewCount ? `Rated ${reviews?.summary.averageRating?.toFixed(1)} out of 5 from ${reviewCount} reviews. Read reviews.` : 'No reviews yet. Read reviews.'}><span className="store-pdp-stars" aria-hidden="true"><span className="store-pdp-stars-base">★★★★★</span><span className="store-pdp-stars-fill" style={{ width: `${(reviews?.summary.averageRating ?? 0) * 20}%` }}>★★★★★</span></span></button>
        {chosen && <div className="store-pdp-price"><strong>{rupees(chosen.effectivePricePaise)}</strong>{chosen.compareAtPricePaise && <del>{rupees(chosen.compareAtPricePaise)}</del>}</div>}
        <div className="store-pdp-variants"><div className="store-pdp-label-row"><h2>{product.variants.length > 1 ? 'Select your piece' : 'Your piece'}</h2>{chosen && <span>SKU {chosen.sku}</span>}</div><div className="store-variant-options" role="group" aria-label="Variant prices">{product.variants.map(item => <button type="button" key={item.id} aria-label={`${item.sku}, ${rupees(item.effectivePricePaise)}${item.stockQuantity === 0 ? ', out of stock' : ''}`} aria-pressed={item.id === variantId} onClick={() => { setVariantId(item.id); setNotice(''); }}><span>{rupees(item.effectivePricePaise)}</span>{item.compareAtPricePaise && <del>{rupees(item.compareAtPricePaise)}</del>}{!item.available && <small>Out of stock</small>}</button>)}</div></div>
        {chosen && <div className="store-pdp-stock" data-stock={stock === 0 ? 'out' : lowStock(stock) ? 'low' : 'in'}><span aria-hidden="true"/>{stock === 0 ? 'Out of stock' : lowStock(stock) ? `Low stock · ${stock} left` : 'In stock'}</div>}
        {chosen && Array.isArray(chosen.attributes) && chosen.attributes.length > 0 && <div className="store-pdp-feature-preview">{chosen.attributes.filter(item => item.title && item.value).map((item, index) => <span key={`${item.title}-${index}`}><strong>{item.title}:</strong> {item.value}</span>)}</div>}
        <div className="store-pdp-actions"><button type="button" className="store-pdp-button store-pdp-button-primary" disabled={!chosen || stock <= 0 || adding} onClick={() => { if (chosen) void addToCart(chosen); }}><ShoppingBag size={18}/> {adding ? 'Adding…' : 'Add to Cart'}</button>{chosen && stock > 0 ? <Link className="store-pdp-button store-pdp-button-secondary" href={`/checkout?mode=direct&variantId=${encodeURIComponent(chosen.id)}&quantity=1`}>Order Now <ArrowRight size={17}/></Link> : <button type="button" className="store-pdp-button store-pdp-button-secondary" disabled>Order Now <ArrowRight size={17}/></button>}</div>{notice && <p className="store-pdp-notice" role="status">{notice} {notice === 'Added to cart.' && <Link href="/cart">View Cart</Link>}</p>}
      </section>
    </div>
    <div className="store-pdp-tabs" ref={tabsRef}><div className="store-pdp-tablist" role="tablist" aria-label="Product details" onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); switchTab(tab === 'about' ? 'reviews' : 'about'); } }}><button type="button" role="tab" id="product-tab-about" ref={aboutRef} aria-controls="product-panel-about" aria-selected={tab === 'about'} tabIndex={tab === 'about' ? 0 : -1} onClick={() => setTab('about')}>About</button><button type="button" role="tab" id="product-tab-reviews" ref={reviewsRef} aria-controls="product-panel-reviews" aria-selected={tab === 'reviews'} tabIndex={tab === 'reviews' ? 0 : -1} onClick={() => setTab('reviews')}>Reviews ({reviewCount})</button></div><div role="tabpanel" id={`product-panel-${tab}`} aria-labelledby={`product-tab-${tab}`} tabIndex={0}>{tab === 'about' ? <ProductAboutSection product={product} variant={chosen}/> : <ProductReviewsSection slug={slug} reviews={reviews} loading={reviewsLoading} error={reviewError} onRefresh={() => void loadReviews()} onLoadMore={() => void loadReviews((reviews?.page ?? 1) + 1)}/>}</div></div>
  </div>;
}
