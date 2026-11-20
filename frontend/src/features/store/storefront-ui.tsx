'use client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { categoryHref, productHref, rupees, type StoreCategory, type StoreProduct } from './catalog';
export function StorePhoto({url,alt,priority=false}:{url:string|null|undefined;alt:string;priority?:boolean}) { const [failed,setFailed]=useState(false); return url&&!failed?<img src={url} alt={alt} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':undefined} onError={()=>setFailed(true)}/>:<div className="store-image-fallback" role="img" aria-label={`No image for ${alt}`}>Home &amp; Lifestyle</div>; }
export function ProductImage({product,priority=false}:{product:StoreProduct;priority?:boolean}) { return <StorePhoto url={product.image?.url} alt={product.image?.altText||product.name} priority={priority}/>; }
export function ProductCard({product,shop=false}:{product:StoreProduct;shop?:boolean}) {
  const savingPaise = product.compareAtPricePaise !== null && product.minPricePaise !== null
    ? product.compareAtPricePaise - product.minPricePaise : 0;
  return <article className="store-product-card">
    <Link className="store-product-photo" href={productHref(product)}>
      <ProductImage product={product}/>
      {shop && savingPaise > 0 && <span className="store-offer-ribbon"><span className="store-offer-ribbon-surface">{rupees(savingPaise)} OFF</span></span>}
      {shop && !product.available && <span className="store-stock-overlay"><strong>Out of stock</strong></span>}
      {product.images?.[1] && <img className="store-product-alt" src={product.images[1].url} alt="" loading="lazy"/>}
    </Link>
    <div className="store-product-copy">
      <p className="store-product-category">{product.categories[0]?.name??'The collection'}</p>
      <Link href={productHref(product)} className="store-product-name">{product.name}</Link>
      <div className="store-price">{product.minPricePaise!==null?<>{product.minPricePaise!==product.maxPricePaise?'From ':''}{rupees(product.minPricePaise)}{product.maxPricePaise!==product.minPricePaise&&<span className="store-price-range"> – {rupees(product.maxPricePaise!)}</span>}{savingPaise > 0 && <del>{rupees(product.compareAtPricePaise!)}</del>}</>:<span>Price on request</span>}</div>
      {!product.available && <p className="store-product-unavailable">Sold out</p>}
      <Link className="store-product-view" href={productHref(product)}>View piece <ArrowRight size={15}/></Link>
    </div>
  </article>;
}
export function CategoryTile({category,offerLabel}:{category:StoreCategory;offerLabel?:string}) { return <Link className="store-category-tile" href={categoryHref(category)}><div className="store-category-photo"><StorePhoto url={category.image?.url} alt={category.name}/>{offerLabel&&<span className="store-category-offer-badge">{offerLabel}</span>}</div><span>{category.name}<ArrowRight size={17}/></span></Link>; }
