'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, MapPin } from 'lucide-react';
import { catalog, productHref, type StoreHome } from './catalog';
import { CategoryTile, ProductCard, ProductImage } from './storefront-ui';

export function Homepage() {
  const [data,setData]=useState<StoreHome>(),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const [pin,setPin]=useState(''),[pinBusy,setPinBusy]=useState(false),[pinMessage,setPinMessage]=useState(''),[pinAvailable,setPinAvailable]=useState<boolean|null>(null);
  const load=useCallback(()=>{setLoading(true);setError('');catalog.home().then(setData).catch(()=>setError('The shop could not load. Please try again.')).finally(()=>setLoading(false))},[]);
  useEffect(()=>{let live=true;catalog.home().then(value=>{if(live)setData(value)}).catch(()=>{if(live)setError('The shop could not load. Please try again.')}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
  const checkPin=async(event:React.FormEvent)=>{event.preventDefault();if(!/^[1-9][0-9]{5}$/.test(pin)){setPinMessage('Enter a valid six-digit Indian PIN code.');setPinAvailable(false);return}setPinBusy(true);setPinMessage('');try{const result=await catalog.pin(pin);setPinMessage(result.message);setPinAvailable(result.available)}catch{setPinMessage('Delivery availability is temporarily unavailable. Please try again.');setPinAvailable(null)}finally{setPinBusy(false)}};
  if(loading)return <div className="store-home store-home-loading" role="status"><div className="store-hero-skeleton"/><div className="store-section"><p>Preparing the shop…</p></div></div>;
  if(error)return <div className="store-home store-empty"><h1>We could not open the shop.</h1><p>{error}</p><button onClick={load}>Try again</button></div>;
  if(!data)return null;
  const hero=data.featured.find(p=>p.image)??data.latest.find(p=>p.image)??data.latest[0];
  const categories=data.categories.filter(c=>!c.parentId).slice(0,6);
  const products=(data.featured.length?data.featured:data.latest).slice(0,4);
  const edit=data.collections.find(item=>!/gift/i.test(item.name));
  const giftingCollection=data.collections.find(item=>/gift/i.test(item.name));
  const giftProducts=data.giftable.length?data.giftable:giftingCollection?.products??[];
  const giftingHref=giftingCollection?`/collections/${giftingCollection.slug}`:'/shop?giftable=true';
  return <div className="store-home"><section className="store-hero" aria-labelledby="home-title"><div className="store-hero-copy"><p className="store-kicker">The Home &amp; Lifestyle edit</p><h1 id="home-title">A little more <em>you</em> in every room.</h1><p>Color, character, and useful details for the spaces you make your own.</p><Link className="store-cta" href={hero?productHref(hero):'/shop'}>{hero?'Discover the featured piece':'Explore the shop'}<ArrowRight size={19}/></Link></div><div className="store-hero-art">{hero?<ProductImage product={hero} priority/>:<div className="store-image-fallback" role="img" aria-label="Home and Lifestyle collection">Home &amp; Lifestyle</div>}<span className="store-hero-caption">{hero?.name??'The collection'}</span></div></section>
    {categories.length>0&&<section className="store-section store-categories" aria-labelledby="categories-title"><div className="store-section-heading"><div><p className="store-kicker">Find your corner</p><h2 id="categories-title">Shop by category</h2></div><Link href="/shop" className="store-text-link">Explore all pieces <ArrowRight size={17}/></Link></div><div className="store-category-grid">{categories.map(category=><CategoryTile key={category.id} category={category}/>)}</div></section>}
    <section className="store-section store-arrivals" aria-labelledby="arrivals-title"><div className="store-section-heading"><div><p className="store-kicker">The current edit</p><h2 id="arrivals-title">Featured pieces</h2></div><Link href="/shop" className="store-text-link">View all <ArrowRight size={17}/></Link></div>{products.length?<div className="store-product-grid">{products.map(product=><ProductCard key={product.id} product={product}/>)}</div>:<p className="store-no-products">Pieces are on their way. Browse the categories above for inspiration.</p>}</section>
    {edit?.products?.[0]?.image&&<section className="store-section store-edit" aria-labelledby="edit-title"><div className="store-edit-art"><ProductImage product={edit.products[0]}/></div><div className="store-edit-copy"><p className="store-kicker">Shop the edit</p><h2 id="edit-title">{edit.name}</h2><p>{edit.description??'A few pieces that feel right together.'}</p><Link className="store-cta store-cta-light" href={`/collections/${edit.slug}`}>Explore the collection <ArrowRight size={18}/></Link></div></section>}
    {giftProducts.length>0&&<section className="store-section store-gifting" aria-labelledby="gifting-title"><div><p className="store-kicker">A thoughtful gesture</p><h2 id="gifting-title">A good gift feels personal.</h2><p>Discover pieces selected for giving, from small accents to everyday favorites.</p><Link className="store-text-link" href={giftingHref}>Explore giftable pieces <ArrowRight size={17}/></Link></div><div className="store-gifting-pieces">{giftProducts.slice(0,2).map(product=><Link href={productHref(product)} key={product.id}><ProductImage product={product}/><span>{product.name}</span></Link>)}</div></section>}
    <section className="store-section store-delivery" aria-labelledby="delivery-title"><div><p className="store-kicker">Before you fall in love</p><h2 id="delivery-title">Check delivery to your PIN.</h2><p>Availability is based on your destination. Charges and arrival depend on the pieces you choose.</p></div><form onSubmit={checkPin}><label htmlFor="delivery-pin">Indian PIN code</label><div><MapPin size={20}/><input id="delivery-pin" inputMode="numeric" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="e.g. 110001"/><button disabled={pinBusy}>{pinBusy?'Checking…':'Check'}</button></div>{pinMessage&&<p role="status" className={pinAvailable===true?'store-pin-yes':'store-pin-no'}>{pinMessage}</p>}</form></section>

  </div>;
}
