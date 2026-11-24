'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { categoryHref, productHref, rupees, type StoreCategory, type StoreProduct } from './catalog';
export function StorePhoto({url,alt,priority=false}:{url:string|null|undefined;alt:string;priority?:boolean}) { const [failed,setFailed]=useState(false); return url&&!failed?<img src={url} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} onError={()=>setFailed(true)}/>:<div className="store-image-fallback" role="img" aria-label={`No image for ${alt}`}>Home &amp; Lifestyle</div>; }
export function ProductImage({product,priority=false}:{product:StoreProduct;priority?:boolean}) { return <StorePhoto url={product.image?.url} alt={product.image?.altText||product.name} priority={priority}/>; }
export function ProductCard({product,shop=false,video=false}:{product:StoreProduct;shop?:boolean;video?:boolean}) {
  const [motionAllowed,setMotionAllowed]=useState(false); const videoRef=useRef<HTMLVideoElement>(null);
  useEffect(()=>{ if(!video)return; const media=window.matchMedia('(prefers-reduced-motion: reduce)'); const sync=()=>setMotionAllowed(!media.matches);sync();media.addEventListener('change',sync);return()=>media.removeEventListener('change',sync); },[video]);
  useEffect(()=>{ if(!videoRef.current)return; if(motionAllowed) void videoRef.current.play().catch(()=>undefined); else videoRef.current.pause(); },[motionAllowed]);
  const savingPaise = product.compareAtPricePaise !== null && product.minPricePaise !== null
    ? product.compareAtPricePaise - product.minPricePaise : 0;
  return <article className="store-product-card">
    <Link className="store-product-photo" href={productHref(product)}>
      {video && product.videoUrl ? <><ProductImage product={product}/><video ref={videoRef} src={product.videoUrl} poster={product.primaryImage?.url ?? product.image?.url ?? undefined} autoPlay={motionAllowed} muted loop playsInline preload="metadata" aria-label={`${product.name} product video`} className="store-motion-video"/></> : <ProductImage product={product}/>}
      {shop && savingPaise > 0 && <span className="store-offer-ribbon"><span className="store-offer-ribbon-surface">{rupees(savingPaise)} OFF</span></span>}
      {shop && !product.available && <span className="store-stock-overlay"><strong>Out of stock</strong></span>}
      {!video && (product.secondaryImage ?? product.images?.[1]) && <img className="store-product-alt" src={(product.secondaryImage ?? product.images[1]).url} alt="" loading="lazy"/>}
    </Link>
    <div className="store-product-copy">
      <p className="store-product-category">{product.categories[0]?.name??'The collection'}</p>
      <Link href={productHref(product)} className="store-product-name">{product.name}</Link>
      <div className="store-price">{product.minPricePaise!==null?<>{product.variantCount>1?'Starts from ':''}{rupees(product.minPricePaise)}{savingPaise > 0 && <del>{rupees(product.compareAtPricePaise!)}</del>}</>:<span>Price on request</span>}</div>
      {!product.available && <p className="store-product-unavailable">Sold out</p>}
      <Link className="store-product-view" href={productHref(product)}>View piece <ArrowRight size={15}/></Link>
    </div>
  </article>;
}
export function CategoryTile({category,offerLabel}:{category:StoreCategory;offerLabel?:string}) { return <Link className="store-category-tile" href={categoryHref(category)}><div className="store-category-photo"><StorePhoto url={category.primaryImage?.url ?? category.image?.url} alt={category.name}/>{category.secondaryImage && <img className="store-category-alt" src={category.secondaryImage.url} alt="" loading="lazy"/>}{offerLabel&&<span className="store-category-offer-badge">{offerLabel}</span>}</div><span>{category.name}<ArrowRight size={17}/></span></Link>; }
