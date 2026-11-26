'use client';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { categoryHref, rupees, type StoreOffer } from './catalog';

const percent = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
export const offerBadge = (offer: StoreOffer) => offer.discountType === 'FIXED' ? `${rupees(Math.round(offer.discountValue * 100))} OFF` : `${percent(offer.discountValue)}% OFF`;
export const offerLabel = (offer: StoreOffer) => offer.targetType === 'PRODUCT' || offer.targetType === 'CATEGORY'
  ? `${offer.discountType === 'FIXED' ? rupees(Math.round(offer.discountValue * 100)) : `${percent(offer.discountValue)}%`} off on ${offer.targetName}`
  : `${offer.discountType === 'FIXED' ? `Flat ${rupees(Math.round(offer.discountValue * 100))} off sitewide` : `${percent(offer.discountValue)}% off storewide`}`;
export const offerHref = (offer: StoreOffer) => offer.targetType === 'PRODUCT' ? `/products/${offer.targetSlug}` : offer.targetType === 'CATEGORY' ? categoryHref({ slug: offer.targetSlug }) : '/shop';

function Track({ offers, repetitions, copy }: { offers: StoreOffer[]; repetitions: number; copy: number }) {
  return <div className="store-offers-track py-2.5">{Array.from({ length: repetitions }, (_, repetition) => offers.map(offer => {
    const duplicate = copy > 0 || repetition > 0;
    return <Link key={`${copy}-${repetition}-${offer.id}`} className="store-offer-item" href={offerHref(offer)} aria-hidden={duplicate ? true : undefined} tabIndex={duplicate ? -1 : undefined}><span className="store-offer-dot" aria-hidden="true"/><span>{offerLabel(offer)}</span><ArrowUpRight size={16} aria-hidden="true"/></Link>;
  }))}</div>;
}

export function HomeOffersStrip({ offers }: { offers: StoreOffer[] }) {
  if (!offers.length) return null;
  const repetitions = Math.max(2, Math.ceil(4800 / (offers.length * 150)));
  return <section className="store-offers" aria-labelledby="home-offers-title"><div className="store-offers-inner"><div className="store-offers-heading"><span className="store-offers-live" aria-hidden="true"/><h2 id="home-offers-title">Offers live now</h2></div><div className="store-offers-window overflow-x-clip overflow-y-visible"><div className="store-offers-motion" style={{ animationDuration: `${Math.max(40, repetitions * offers.length * 3.2)}s` }}><Track offers={offers} repetitions={repetitions} copy={0}/><Track offers={offers} repetitions={repetitions} copy={1}/></div></div></div></section>;
}
