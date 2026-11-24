'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { catalog, productHref, type StoreHome } from './catalog';
import { CategoryTile, ProductCard, ProductImage } from './storefront-ui';
import { HomeOffersStrip, offerBadge } from './home-offers';

export function Homepage() {
  const [data,setData]=useState<StoreHome>(),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=useCallback(()=>{setLoading(true);setError('');catalog.home().then(setData).catch(()=>setError('The shop could not load. Please try again.')).finally(()=>setLoading(false))},[]);
  useEffect(()=>{let live=true;catalog.home().then(value=>{if(live)setData(value)}).catch(()=>{if(live)setError('The shop could not load. Please try again.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  if(loading)return <div className="store-home store-home-loading" role="status"><div className="store-hero-skeleton"/><div className="store-section"><p>Preparing the shop…</p></div></div>;
  if(error)return <div className="store-home store-empty"><h1>We could not open the shop.</h1><p>{error}</p><button className="store-home-cta" onClick={load}>Try again</button></div>;
  if(!data)return null;
  const hero=data.featured.find(p=>p.image)??data.latest.find(p=>p.image)??data.latest[0];
  const categories=data.categories.filter(c=>!c.parentId).slice(0,6);
  const products=(data.featured.length?data.featured:data.latest).slice(0,4);
  const edit=data.collections.find(item=>!/gift/i.test(item.name));
  const giftingCollection=data.collections.find(item=>/gift/i.test(item.name));
  const giftProducts=data.giftable.length?data.giftable:giftingCollection?.products??[];
  const giftingHref=giftingCollection?`/collections/${giftingCollection.slug}`:'/shop?giftable=true';
  const categoryRows=data.categories.map(category=>({category,products:data.categoryRows?.find(row=>row.slug===category.slug)?.products??[]})).filter(row=>row.products.length);
  const offers=data.offers??[];
  const categoryOffers=new Map(offers.filter(offer=>offer.targetType==='CATEGORY').map(offer=>[offer.targetId,offer]));
  return <div className="store-home"><section className="store-hero" aria-labelledby="home-title"><div className="store-hero-copy"><p className="store-kicker">The Home &amp; Lifestyle edit</p><h1 id="home-title">A little more <em>you</em> in every room.</h1><p>Color, character, and useful details for the spaces you make your own.</p><Link className="store-cta store-home-cta" href={hero?productHref(hero):'/shop'}>{hero?'Discover the featured piece':'Explore the shop'}<ArrowRight size={19}/></Link></div><div className="store-hero-art"><Image src="/images/home-hero-placeholder.png" alt="A sunlit living room with a sculptural lamp, cushions, and a ceramic vase" fill priority sizes="(max-width: 700px) 100vw, 55vw"/><span className="store-hero-caption">A corner to make your own</span></div></section>
    <HomeOffersStrip offers={offers}/>
    {categories.length>0&&<section className="store-section store-categories" aria-labelledby="categories-title"><div className="store-section-heading"><div><p className="store-kicker">Find your corner</p><h2 id="categories-title">Shop by category</h2></div><Link href="/shop" className="store-text-link store-home-cta">Explore all categories <ArrowRight size={19}/></Link></div><div className="store-category-grid" role="region" aria-label="Shop by category cards" tabIndex={0}>{categories.map(category=><CategoryTile key={category.id} category={category} offerLabel={categoryOffers.get(category.id)?offerBadge(categoryOffers.get(category.id)!):undefined}/>)}</div></section>}
    {Boolean(data.videoProducts?.length)&&<section className="store-section store-motion" aria-labelledby="motion-title"><div className="store-section-heading"><div><p className="store-kicker">See it in your space</p><h2 id="motion-title">Shop in Motion</h2></div><Link href="/shop" className="store-text-link store-home-cta">Shop all <ArrowRight size={17}/></Link></div><div className="store-product-grid" role="region" aria-label="Shop in Motion products" tabIndex={0}>{data.videoProducts!.map(product=><ProductCard key={product.id} product={product} video/>)}</div></section>}
    <section className="store-section store-arrivals" aria-labelledby="arrivals-title"><div className="store-section-heading"><div><p className="store-kicker">The current edit</p><h2 id="arrivals-title">Featured pieces</h2></div><Link href="/shop" className="store-text-link store-home-cta">Discover the featured pieces <ArrowRight size={17}/></Link></div>{products.length?<div className="store-product-grid" role="region" aria-label="Featured pieces" tabIndex={0}>{products.map(product=><ProductCard key={product.id} product={product}/>)}</div>:<p className="store-no-products">Pieces are on their way. Browse the categories above for inspiration.</p>}</section>
    {edit?.products?.[0]?.image&&<section className="store-section store-edit" aria-labelledby="edit-title"><div className="store-edit-art"><ProductImage product={edit.products[0]}/></div><div className="store-edit-copy"><p className="store-kicker">Shop the edit</p><h2 id="edit-title">{edit.name}</h2><p>{edit.description??'A few pieces that feel right together.'}</p><Link className="store-cta store-home-cta" href={`/collections/${edit.slug}`}>Explore the collections <ArrowRight size={18}/></Link></div></section>}
    {categoryRows.map(({category,products})=><section key={category.id} className="store-section store-home-category-row" aria-labelledby={`home-category-${category.id}`}><div className="store-section-heading"><div><p className="store-kicker">Explore the collection</p><div className="store-home-category-title"><h2 id={`home-category-${category.id}`}>Shop {category.name}</h2>{categoryOffers.get(category.id)&&<span className="store-category-offer-badge">{offerBadge(categoryOffers.get(category.id)!)}</span>}</div></div><Link href={`/categories/${category.slug}`} className="store-text-link store-home-cta">Shop all <ArrowRight size={17}/></Link></div><div className="store-product-grid" role="region" aria-label={`Shop ${category.name} products`} tabIndex={0}>{products.map(product=><ProductCard key={product.id} product={product} shop/>)}</div></section>)}
    {giftProducts.length>0&&<section className="store-section store-gifting" aria-labelledby="gifting-title"><div><p className="store-kicker">A thoughtful gesture</p><h2 id="gifting-title">A good gift feels personal.</h2><p>Discover pieces selected for giving, from small accents to everyday favorites.</p><Link className="store-text-link store-home-cta" href={giftingHref}>Explore giftable pieces <ArrowRight size={17}/></Link></div><div className="store-gifting-pieces">{giftProducts.slice(0,2).map(product=><Link href={productHref(product)} key={product.id}><ProductImage product={product}/><span>{product.name}</span></Link>)}</div></section>}

  </div>;
}
