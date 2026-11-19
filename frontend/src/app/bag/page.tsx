import Link from 'next/link';
export default function Bag() { return <section className="store-bag-page"><p className="store-kicker">Your bag</p><h1>The shopping bag is being prepared.</h1><p>Product discovery is open. Checkout is not available yet.</p><Link className="store-cta" href="/shop">Browse pieces →</Link></section>; }
