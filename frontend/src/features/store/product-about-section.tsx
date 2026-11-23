import type { StoreProduct, StoreVariant } from './catalog';

type Spec = { title: string; value: string };
const label = (value: string) => value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, first => first.toUpperCase());
const dimensions = (value: unknown): Spec[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).flatMap(([key, raw]) => typeof raw === 'string' || typeof raw === 'number' ? [{ title: label(key), value: String(raw) }] : []);
};

export function ProductAboutSection({ product, variant }: { product: StoreProduct; variant?: StoreVariant }) {
  const details: Spec[] = [
    ...(variant?.sku ? [{ title: 'SKU', value: variant.sku }] : []),
    ...(product.materials?.length ? [{ title: 'Materials', value: product.materials.join(', ') }] : []),
    ...(product.careInstructions?.trim() ? [{ title: 'Care', value: product.careInstructions.trim() }] : []),
    ...(product.categories?.length ? [{ title: 'Categories', value: product.categories.map(item => item.name).join(', ') }] : []),
    ...(product.collections?.length ? [{ title: 'Collections', value: product.collections.join(', ') }] : []),
    ...(product.tags?.length ? [{ title: 'Tags', value: product.tags.join(', ') }] : []),
    ...(product.attributes ?? []).filter(item => item.key && item.value).map(item => ({ title: label(item.key), value: item.value })),
  ];
  const features = Array.isArray(variant?.attributes) ? variant.attributes.filter(item => item.title && item.value) : [];
  const measurements = dimensions(variant?.dimensions ?? product.dimensions);
  return <div className="store-about-panel">
    {(product.description || product.story) && <div className="store-about-prose"><p className="store-kicker">The story</p>{product.description && <p>{product.description}</p>}{product.story && <p>{product.story}</p>}</div>}
    {features.length > 0 && <section><h3>Selected variant features</h3><dl className="store-spec-list">{features.map((item, index) => <div key={`${item.title}-${index}`}><dt>{item.title}</dt><dd>{item.value}</dd></div>)}</dl></section>}
    {measurements.length > 0 && <section><h3>Dimensions</h3><dl className="store-spec-list">{measurements.map(item => <div key={item.title}><dt>{item.title}</dt><dd>{item.value}</dd></div>)}</dl></section>}
    {details.length > 0 && <section><h3>Details</h3><dl className="store-spec-list">{details.map((item, index) => <div key={`${item.title}-${index}`}><dt>{item.title}</dt><dd>{item.value}</dd></div>)}</dl></section>}
  </div>;
}
