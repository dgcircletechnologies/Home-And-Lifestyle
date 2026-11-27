'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { productHref, rupees, type StoreProduct } from './catalog';

const IMAGE_BEAT_MS = 2500;
const VIDEO_SLIDE_MS = 5000;

export function HomeHeroCarousel({ products }: { products: StoreProduct[] }) {
  const slides = useMemo(() => products.filter(product => product.primaryImage?.url ?? product.image?.url), [products]);
  const count = slides.length;
  // Edge clones let the track finish moving in either direction before resetting its position.
  const panels = count > 1 ? [slides[count - 1], ...slides, slides[0]] : slides;
  const [physicalIndex, setPhysicalIndex] = useState(count > 1 ? 1 : 0);
  const [step, setStep] = useState<0 | 1>(0);
  const [outgoingSecondary, setOutgoingSecondary] = useState<number | null>(null);
  const [sliding, setSliding] = useState(false);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [timerKey, setTimerKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const remainingMs = useRef(IMAGE_BEAT_MS);
  const logicalIndex = count > 1 ? (physicalIndex - 1 + count) % count : 0;
  const activeVideoUrl = slides[logicalIndex]?.videoUrl?.trim();

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setTransitionEnabled(false);
        setSliding(false);
        setOutgoingSecondary(null);
        setPhysicalIndex(current => count > 1 && current === count + 1 ? 1 : current === 0 && count > 1 ? count : current);
      } else setTransitionEnabled(true);
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [count]);

  const move = useCallback((direction: 1 | -1) => {
    if (sliding || !count) return;
    const next = (logicalIndex + direction + count) % count;
    setAnnouncement(`Showing ${slides[next].name}, slide ${next + 1} of ${count}`);
    setTimerKey(value => value + 1);
    if (count === 1) { setStep(0); return; }
    if (reducedMotion) {
      setTransitionEnabled(false);
      setPhysicalIndex(next + 1);
      setStep(0);
      setOutgoingSecondary(null);
      return;
    }
    setOutgoingSecondary(step === 1 ? physicalIndex : null);
    setStep(0);
    setTransitionEnabled(true);
    setSliding(true);
    setPhysicalIndex(value => value + direction);
  }, [count, logicalIndex, physicalIndex, reducedMotion, slides, sliding, step]);

  useEffect(() => { remainingMs.current = activeVideoUrl ? VIDEO_SLIDE_MS : IMAGE_BEAT_MS; }, [activeVideoUrl, logicalIndex, reducedMotion, step, timerKey]);

  useEffect(() => {
    if (hovered || focused || reducedMotion || sliding || !count || (count === 1 && !activeVideoUrl && !slides[0].secondaryImage?.url)) return;
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      if (!activeVideoUrl && step === 0 && slides[logicalIndex].secondaryImage?.url) setStep(1);
      else move(1);
    }, remainingMs.current);
    return () => { window.clearTimeout(timer); remainingMs.current = Math.max(0, remainingMs.current - (performance.now() - startedAt)); };
  }, [activeVideoUrl, count, focused, hovered, logicalIndex, move, reducedMotion, slides, sliding, step, timerKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    return () => { video.pause(); video.currentTime = 0; };
  }, [physicalIndex, reducedMotion, sliding, timerKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (hovered || focused) video.pause();
    else void video.play().catch(() => undefined);
  }, [focused, hovered, physicalIndex, reducedMotion, sliding, timerKey]);

  const select = (target: number) => {
    if (target === logicalIndex) { setStep(0); setTimerKey(value => value + 1); return; }
    if (sliding) {
      setSliding(false);
      setTransitionEnabled(false);
      setPhysicalIndex(target + 1);
      setStep(0);
      setOutgoingSecondary(null);
      setTimerKey(value => value + 1);
      setAnnouncement(`Showing ${slides[target].name}, slide ${target + 1} of ${count}`);
      requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
      return;
    }
    if (target === (logicalIndex + 1) % count) { move(1); return; }
    if (target === (logicalIndex - 1 + count) % count) { move(-1); return; }
    setTransitionEnabled(false);
    setPhysicalIndex(target + 1);
    setStep(0);
    setOutgoingSecondary(null);
    setTimerKey(value => value + 1);
    setAnnouncement(`Showing ${slides[target].name}, slide ${target + 1} of ${count}`);
    requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
  };

  const finishSlide = (event: React.TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') return;
    setOutgoingSecondary(null);
    if (physicalIndex === 0 || physicalIndex === count + 1) {
      setTransitionEnabled(false);
      setPhysicalIndex(physicalIndex === 0 ? count : 1);
      requestAnimationFrame(() => requestAnimationFrame(() => setTransitionEnabled(true)));
    }
    setSliding(false);
  };

  if (!count) return <section className="store-hero-fallback" aria-labelledby="home-title"><div className="store-hero-panel"><div className="store-hero-carousel-copy"><span className="store-hero-new">THE HOME &amp; LIFESTYLE EDIT</span><h1 id="home-title" className="store-hero-title">A little more you in every room.</h1><p className="store-hero-description">Color, character, and useful details for the spaces you make your own.</p><Link className="store-home-cta" href="/shop">Shop Now <ArrowRight size={18}/></Link></div><div className="store-hero-photo"><Image src="/images/home-hero-placeholder.png" alt="A sunlit living room with a sculptural lamp, cushions, and a ceramic vase" fill priority sizes="100vw"/></div></div></section>;

  return <section className="store-hero-carousel" aria-label="Featured products" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); }} onTouchStart={event => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }} onTouchEnd={event => { const start = touchStart.current; touchStart.current = null; if (!start) return; const dx = event.changedTouches[0].clientX - start.x; const dy = event.changedTouches[0].clientY - start.y; if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) move(dx < 0 ? 1 : -1); }}>
    <div className={`store-hero-track${transitionEnabled && !reducedMotion ? ' is-animated' : ''}`} style={{ transform: `translateX(-${physicalIndex * 100}%)` }} onTransitionEnd={finishSlide}>
      {panels.map((product, panelIndex) => {
        const primary = product.primaryImage ?? product.image;
        const price = product.minPricePaise;
        const original = product.compareAtPricePaise;
        const isActive = panelIndex === physicalIndex;
        const secondaryVisible = product.secondaryImage?.url && ((isActive && step === 1) || outgoingSecondary === panelIndex);
        return <div key={`${product.id}-${panelIndex}`} className="store-hero-panel" aria-hidden={!isActive}>
          <div className="store-hero-carousel-copy"><div className="store-hero-tags" aria-label="Product tags">{(product.tags?.length ? product.tags.slice(0, 2) : ['NEW']).map(tag => <span key={tag} className="store-hero-new">{tag}</span>)}</div>{isActive ? <h1 id="home-title" className="store-hero-title">{product.name}</h1> : <div className="store-hero-title">{product.name}</div>}<p className="store-hero-description">{product.description}</p>{price !== null && <p className="store-hero-price"><span>{product.variantCount > 1 ? 'Starts from ' : ''}{rupees(price)}</span>{original !== null && original > price && <del>{rupees(original)}</del>}</p>}<Link className="store-home-cta" href={productHref(product)} tabIndex={isActive ? undefined : -1}>Shop Now <ArrowRight size={18}/></Link></div>
          <div className="store-hero-photo">{product.videoUrl?.trim() && isActive && !sliding && !reducedMotion ? <video ref={videoRef} src={product.videoUrl.trim()} poster={primary!.url} autoPlay muted loop playsInline preload="metadata" aria-label={`${product.name} video`}/> : <><Image src={primary!.url} alt="" fill priority={panelIndex === 1 || (count === 1 && panelIndex === 0)} loading={panelIndex === 1 || (count === 1 && panelIndex === 0) ? 'eager' : 'lazy'} sizes="100vw" className="store-hero-primary"/>{!product.videoUrl?.trim() && product.secondaryImage?.url && <Image src={product.secondaryImage.url} alt="" fill loading="lazy" sizes="100vw" className={`store-hero-secondary${secondaryVisible ? ' is-visible' : ''}`}/>}</>}</div>
        </div>;
      })}
    </div>
    {count > 1 && <div className="store-hero-dots" aria-label="Choose featured product">{slides.map((product, position) => <button key={product.id} type="button" aria-label={`Show ${product.name}`} aria-current={position === logicalIndex ? 'true' : undefined} onClick={() => select(position)}/>)}</div>}
    <span className="sr-only" role="status">{announcement}</span>
  </section>;
}
