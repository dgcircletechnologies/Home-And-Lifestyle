import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { categoryVisibility, branchIds } from '../categories/category-visibility';

export type ShopInput = { category?: string; material?: string; colour?: string; room?: string; style?: string; size?: string; finish?: string; tag?: string; collection?: string; stock?: 'true'; sale?: 'true'; min?: number; max?: number; sort: 'newest'|'price-asc'|'price-desc'|'name-asc'|'name-desc'; page: number; pageSize: number; search?: string; giftable?: 'true' };
const groups = ['category','material','colour','room','style','size','finish','tag','collection'] as const;
type Group = typeof groups[number];
const selectedValues = (value?: string) => (value ?? '').split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
const saving = (rule: { kind: string; amountPaise: number|null; percentBasisPoints: number|null }, price: number) => Math.min(price, rule.kind === 'FIXED' ? rule.amountPaise ?? 0 : Math.floor((price * (rule.percentBasisPoints ?? 0) + 5000) / 10000));
@Injectable()
export class ShopService {
  constructor(private readonly db: PrismaService) {}
  async list(input: ShopInput) {
    const now = new Date(), tree = await categoryVisibility(this.db);
    const categories = tree.categories.filter(item => tree.isActive(item.id));
    const branch = new Map(categories.map(item => [item.slug, new Set(branchIds(tree,item.id))]));
    const activeIds = categories.map(item => item.id);
    const [products, promotions] = await Promise.all([
      this.db.product.findMany({ where: { status: 'PUBLISHED', categories: { some: { categoryId: { in: activeIds } } }, variants: { some: {} } }, select: {
        id:true,name:true,slug:true,createdAt:true,isFeatured:true,giftWrapEligible:true,materials:true,
        images:{orderBy:[{position:'asc' as const},{id:'asc' as const}],take:2,select:{url:true,altText:true}},
        attributes:{select:{key:true,textValue:true}}, categories:{select:{categoryId:true,category:{select:{name:true,slug:true}}}},
        tags:{select:{tag:{select:{name:true,slug:true}}}}, collections:{select:{collection:{select:{name:true,slug:true,startsAt:true,endsAt:true}}}},
        variants:{select:{id:true,pricePaise:true,stockQuantity:true,images:{orderBy:[{position:'asc' as const},{id:'asc' as const}],take:1,select:{url:true,altText:true}},selections:{select:{value:{select:{label:true,option:{select:{key:true}}}}}}}},
      }}),
      this.db.promotion.findMany({where:{lifecycle:'PUBLISHED',enabled:true,OR:[{startsAt:null},{startsAt:{lte:now}}],AND:[{OR:[{endsAt:null},{endsAt:{gt:now}}]}]},select:{id:true,productId:true,categoryId:true,kind:true,amountPaise:true,percentBasisPoints:true}}),
    ]);
    const selected = new Map<Group,string[]>(groups.map(group => [group,selectedValues(input[group])]))
    if (input.collection === 'new-arrivals') selected.set('collection', []);
    const options = new Map<Group,Map<string,string>>(groups.map(group => [group,new Map()]));
    const entries = products.map(product => {
      const ids = product.categories.map(link => link.categoryId).filter(id => activeIds.includes(id));
      const common = new Map<Group,Map<string,string>>(groups.map(group => [group,new Map()]));
      const add = (group:Group,value:string,label=value) => common.get(group)!.set(value.toLowerCase(),label);
      categories.forEach(category => { if(ids.some(id => branch.get(category.slug)!.has(id))) add('category',category.slug,category.name); });
      product.materials.forEach(value => add('material',value));
      product.attributes.forEach(attribute => { const key=attribute.key.toLowerCase() as Group; if(groups.includes(key) && attribute.textValue) add(key,attribute.textValue); });
      product.tags.forEach(link => add('tag',link.tag.slug,link.tag.name));
      product.collections.forEach(link => { const value=link.collection; if((!value.startsAt||value.startsAt<=now)&&(!value.endsAt||value.endsAt>now)) add('collection',value.slug,value.name); });
      const rules=promotions.filter(rule => rule.productId===product.id || (rule.categoryId && ids.some(id => branch.get(tree.byId.get(rule.categoryId!)?.slug ?? '')?.has(id))));
      const variants=product.variants.map(variant => {
        const facets=new Map<Group,Map<string,string>>(groups.map(group => [group,new Map(common.get(group))]));
        variant.selections.forEach(selection => { const key=selection.value.option.key.toLowerCase() as Group; if(groups.includes(key)) facets.get(key)!.set(selection.value.label.toLowerCase(),selection.value.label); });
        const discount=rules.map(rule => ({id:rule.id,amount:saving(rule,variant.pricePaise)})).sort((a,b)=>b.amount-a.amount||a.id.localeCompare(b.id))[0]?.amount ?? 0;
        for(const group of groups) for(const [value,label] of facets.get(group)!) options.get(group)!.set(value,label);
        return { ...variant, facets, price:variant.pricePaise-discount, original:discount?variant.pricePaise:null };
      });
      return { product,ids,variants };
    });
    const match = (entry:typeof entries[number]) => {
      if(input.search && !entry.product.name.toLowerCase().includes(input.search.toLowerCase())) return [];
      if(input.giftable && !entry.product.giftWrapEligible) return [];
      if(input.collection === 'new-arrivals' && !entry.product.tags.some(link => link.tag.slug === 'new-arrival' || link.tag.slug === 'new-arrivals')) return [];
      return entry.variants.filter(variant => (!input.stock||variant.stockQuantity>0) && (!input.sale||variant.original!==null) && (input.min===undefined||variant.price>=input.min*100) && (input.max===undefined||variant.price<=input.max*100) && groups.every(group => !selected.get(group)!.length || selected.get(group)!.some(value => variant.facets.get(group)!.has(value))));
    };
    const cards=entries.flatMap(entry => { const variants=match(entry).sort((a,b)=>a.price-b.price||a.id.localeCompare(b.id)); if(!variants.length)return [];const cheapest=variants[0];return [{id:entry.product.id,name:entry.product.name,slug:entry.product.slug,createdAt:entry.product.createdAt,image:cheapest.images[0]??entry.product.images[0]??null,images:entry.product.images,minPricePaise:cheapest.price,maxPricePaise:variants.at(-1)!.price,compareAtPricePaise:cheapest.original,available:variants.some(v=>v.stockQuantity>0),categories:entry.product.categories.filter(link=>activeIds.includes(link.categoryId)).map(link=>link.category)}]; });
    cards.sort((a,b)=>{let order=0;if(input.sort==='price-asc')order=a.minPricePaise-b.minPricePaise;else if(input.sort==='price-desc')order=b.minPricePaise-a.minPricePaise;else if(input.sort==='name-asc')order=a.name.localeCompare(b.name,undefined,{sensitivity:'base'});else if(input.sort==='name-desc')order=b.name.localeCompare(a.name,undefined,{sensitivity:'base'});else order=b.createdAt.getTime()-a.createdAt.getTime();return order||a.id.localeCompare(b.id);});
    const total=cards.length,totalPages=Math.ceil(total/input.pageSize),page=Math.min(input.page,Math.max(1,totalPages));
    const filters=Object.fromEntries(groups.map(group=>[group,[...options.get(group)!].map(([value,label])=>({value,label})).sort((a,b)=>a.label.localeCompare(b.label))]));
    const onSale = entries.some(entry => entry.variants.some(variant => variant.original !== null));
    return {items:cards.slice((page-1)*input.pageSize,page*input.pageSize),total,totalPages,page,pageSize:input.pageSize,filters,onSale};
  }
}
