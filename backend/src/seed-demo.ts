import 'reflect-metadata';
import { PrismaService } from './prisma.service';
import { hashPassword } from './auth/password';

// ---------------------------------------------------------------------------
// 1. Store Settings & Serviceability Data
// ---------------------------------------------------------------------------
const storeSettingsData = {
  id: 'store',
  storeName: 'Home & Lifestyle',
  supportEmail: 'care@homeandlifestyle.in',
  supportPhone: '+91 98765 43210',
  publicAddress: 'Home & Lifestyle Studio, 42 Indiranagar, 100 Feet Road, Bengaluru, Karnataka 560038',
  businessHours: 'Monday – Saturday, 10:00 AM – 7:00 PM IST',
  giftWrapFeePaise: 19900, // ₹199
  giftMessagesAvailable: true,
  giftReceiptsAvailable: true,
  giftWrapDefaultEligible: true,
  thresholdBasis: 'AFTER_DISCOUNTS',
  waiveHandlingOnFree: false,
};

const restrictedPinCodes = [
  { pinCode: '799001', supported: false, enabled: true, reason: 'Temporarily unserviceable remote region' },
  { pinCode: '194101', supported: false, enabled: true, reason: 'High-altitude logistics restriction' },
];

// ---------------------------------------------------------------------------
// 2. Categories (7 Categories, first 5 shown in storefront Navbar)
// ---------------------------------------------------------------------------
const categoriesData = [
  {
    name: 'Living Room',
    slug: 'living-room',
    description: 'Sculptural seating, coffee tables, and decorative objects crafted for calm interiors.',
    showInStorefrontNav: true,
    storefrontNavPosition: 0,
    imageUrl: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80',
  },
  {
    name: 'Kitchen & Dining',
    slug: 'kitchen-and-dining',
    description: 'Artisanal dinnerware, hand-forged serveware, and kitchen textiles designed for shared meals.',
    showInStorefrontNav: true,
    storefrontNavPosition: 1,
    imageUrl: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80',
  },
  {
    name: 'Lighting',
    slug: 'lighting',
    description: 'Warm fluted glass lamps, sculptural brass pendants, and ambient evening luminaires.',
    showInStorefrontNav: true,
    storefrontNavPosition: 2,
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1200&q=80',
  },
  {
    name: 'Tableware & Ceramics',
    slug: 'tableware-and-ceramics',
    description: 'Hand-thrown stoneware, speckled platters, and terracotta centerpieces with tactile character.',
    showInStorefrontNav: true,
    storefrontNavPosition: 3,
    imageUrl: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=1200&q=80',
  },
  {
    name: 'Textiles & Cushions',
    slug: 'textiles-and-cushions',
    description: 'Pure washed European linen throws, hand-tufted wool covers, and soft woven accents.',
    showInStorefrontNav: true,
    storefrontNavPosition: 4,
    imageUrl: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=1200&q=80',
  },
  {
    name: 'Vases & Planters',
    slug: 'vases-and-planters',
    description: 'Organic fluted vases, matte rib planters, and pedestal vessels that celebrate botany.',
    showInStorefrontNav: false,
    storefrontNavPosition: null,
    imageUrl: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=1200&q=80',
  },
  {
    name: 'Gifting & Decor',
    slug: 'gifting-and-decor',
    description: 'Small-batch botanical candles, brass incense vessels, and mindful gifts wrapped with care.',
    showInStorefrontNav: false,
    storefrontNavPosition: null,
    imageUrl: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80',
    secondaryImageUrl: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80',
  },
];

// ---------------------------------------------------------------------------
// 3. Collections & Tags
// ---------------------------------------------------------------------------
const collectionsData = [
  {
    name: 'Warm Minimalist Living',
    slug: 'warm-minimalist-living',
    description: 'Quiet shapes, tactile materials, and organic silhouettes that create a grounded sanctuary.',
    position: 0,
  },
  {
    name: 'Artisanal Dining',
    slug: 'artisanal-dining',
    description: 'Handcrafted stoneware, linen runners, and forged cutlery made for lingering dinner parties.',
    position: 1,
  },
  {
    name: 'Thoughtful Gifts',
    slug: 'thoughtful-gifts',
    description: 'Heirloom accents and scented creations wrapped with personal care and lasting sentiment.',
    position: 2,
  },
];

const tagsData = [
  { name: 'New Arrival', slug: 'new-arrival' },
  { name: 'Bestseller', slug: 'bestseller' },
  { name: 'Handcrafted', slug: 'handcrafted' },
  { name: 'Sustainable', slug: 'sustainable' },
  { name: 'Limited Edition', slug: 'limited-edition' },
];

// ---------------------------------------------------------------------------
// 4. Products Data (21 products across 7 categories)
// ---------------------------------------------------------------------------
interface SeedProduct {
  name: string;
  slug: string;
  description: string;
  story: string;
  categorySlug: string;
  collectionSlugs: string[];
  tagSlugs: string[];
  materials: string[];
  dimensions: { height?: string; width?: string; depth?: string; diameter?: string; weight?: string };
  careInstructions: string;
  room: string;
  style: string;
  isFeatured: boolean;
  giftWrapEligible: boolean;
  videoUrl?: string | null;
  showInHomeVideoShowcase?: boolean;
  showInHeroCarousel?: boolean;
  images: { url: string; altText: string }[];
  variants: {
    sku: string;
    pricePaise: number;
    compareAtPricePaise?: number | null;
    stockQuantity: number;
    isLimitedStock?: boolean;
    attributes: { title: string; value: string }[];
  }[];
}

const productsData: SeedProduct[] = [
  // --- Living Room (1..3) ---
  {
    name: 'Aura Handwoven Lounge Chair',
    slug: 'aura-handwoven-lounge-chair',
    showInHeroCarousel: true,
    description: 'Sculptural lounge chair featuring an FSC-certified solid ash frame and handwoven Danish cord seat.',
    story: 'Designed in collaboration with craftspersons in Saharanpur, blending Nordic restraint with traditional Indian cord weaving.',
    categorySlug: 'living-room',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['bestseller', 'handcrafted'],
    materials: ['Solid Ash Wood', 'Danish Paper Cord'],
    dimensions: { height: '78 cm', width: '68 cm', depth: '72 cm', weight: '8.4 kg' },
    careInstructions: 'Dust regularly with a dry soft cloth. Protect from direct prolonged sunlight.',
    room: 'Living Room',
    style: 'Modern Minimalist',
    isFeatured: true,
    giftWrapEligible: false,
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    showInHomeVideoShowcase: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=1200&q=80', altText: 'Aura Handwoven Lounge Chair in natural ash' },
      { url: 'https://images.unsplash.com/photo-1580481077195-c3a821a58875?w=1200&q=80', altText: 'Aura Handwoven Lounge Chair corner styling' },
    ],
    variants: [
      { sku: 'AURA-CHAIR-ASH', pricePaise: 1299900, compareAtPricePaise: 1499900, stockQuantity: 6, attributes: [{ title: 'Finish', value: 'Natural Ash' }, { title: 'Size', value: 'Standard' }] },
      { sku: 'AURA-CHAIR-WAL', pricePaise: 1449900, compareAtPricePaise: 1699900, stockQuantity: 4, attributes: [{ title: 'Finish', value: 'Dark Walnut' }, { title: 'Size', value: 'Standard' }] },
    ],
  },
  {
    name: 'Brutalist Solid Teak Coffee Table',
    slug: 'brutalist-solid-teak-coffee-table',
    showInHeroCarousel: true,
    description: 'Low-profile circular coffee table hand-turned from reclaimed Burma teak with natural oil polish.',
    story: 'Heavy architectural block geometry inspired by Chandigarh modernist heritage and honest timber grain.',
    categorySlug: 'living-room',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['handcrafted', 'sustainable'],
    materials: ['Reclaimed Teak Wood'],
    dimensions: { height: '38 cm', diameter: '85 cm', weight: '18 kg' },
    careInstructions: 'Use coasters. Treat with natural beeswax every 6 months to nourish the grain.',
    room: 'Living Room',
    style: 'Wabi-Sabi',
    isFeatured: true,
    giftWrapEligible: false,
    images: [
      { url: 'https://images.unsplash.com/photo-1533090161767-e6ffed986c88?w=1200&q=80', altText: 'Brutalist Solid Teak Coffee Table front view' },
      { url: 'https://images.unsplash.com/photo-1519974719765-e6559eac2575?w=1200&q=80', altText: 'Brutalist Solid Teak Coffee Table surface detail' },
    ],
    variants: [
      { sku: 'TEAK-COFFEE-85', pricePaise: 949900, compareAtPricePaise: null, stockQuantity: 5, attributes: [{ title: 'Size', value: '85cm' }] },
    ],
  },
  {
    name: 'Komorebi Fluted Brass Wall Sconce',
    slug: 'komorebi-fluted-brass-wall-sconce',
    showInHeroCarousel: true,
    description: 'Architectural wall luminaire casting indirect upward and downward radiance through fluted brass fins.',
    story: 'Translating the poetic Japanese concept of dappled light filtering through tree canopies into warm interior illumination.',
    categorySlug: 'living-room',
    collectionSlugs: [],
    tagSlugs: ['new-arrival'],
    materials: ['Solid Brushed Brass', 'Frosted Glass Diffuser'],
    dimensions: { height: '32 cm', width: '12 cm', depth: '10 cm', weight: '1.6 kg' },
    careInstructions: 'Wipe with microfiber cloth. Unlacquered brass develops a handsome organic patina over time.',
    room: 'Living Room',
    style: 'Contemporary',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1200&q=80', altText: 'Komorebi Fluted Brass Wall Sconce illuminated' },
      { url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=1200&q=80', altText: 'Komorebi Fluted Wall Sconce brass profile' },
    ],
    variants: [
      { sku: 'KOMO-SCONCE-BRS', pricePaise: 349900, compareAtPricePaise: 399900, stockQuantity: 8, attributes: [{ title: 'Finish', value: 'Brushed Brass' }] },
      { sku: 'KOMO-SCONCE-BLK', pricePaise: 369900, compareAtPricePaise: null, stockQuantity: 5, attributes: [{ title: 'Finish', value: 'Matte Charcoal' }] },
    ],
  },

  // --- Kitchen & Dining (4..6) ---
  {
    name: 'Kyoto Stoneware Dinner Set',
    slug: 'kyoto-stoneware-dinner-set',
    showInHeroCarousel: true,
    description: 'Sixteen-piece complete dining service in reactive dual-tone matte ochre and speckled cream glaze.',
    story: 'Fired at 1280°C in Khurja kilns for exceptional chip resistance, tactile matte exterior, and glossy food-safe interior.',
    categorySlug: 'kitchen-and-dining',
    collectionSlugs: ['artisanal-dining', 'thoughtful-gifts'],
    tagSlugs: ['bestseller', 'handcrafted'],
    materials: ['High-Fired Stoneware'],
    dimensions: { weight: '8.2 kg' },
    careInstructions: 'Microwave, oven, and dishwasher safe. Avoid sudden thermal shocks.',
    room: 'Dining Room',
    style: 'Wabi-Sabi',
    isFeatured: true,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=1200&q=80', altText: 'Kyoto Stoneware Dinner Set on linen table' },
      { url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80', altText: 'Kyoto Stoneware Dinner Set bowl and plate stack' },
    ],
    variants: [
      { sku: 'KYOTO-SET-16', pricePaise: 489900, compareAtPricePaise: 549900, stockQuantity: 9, attributes: [{ title: 'Set Size', value: '16 Piece' }, { title: 'Colour', value: 'Ochre & Cream' }] },
    ],
  },
  {
    name: 'Hand-Forged Matte Gold Cutlery Set',
    slug: 'hand-forged-matte-gold-cutlery-set',
    description: 'Heavy gauge 18/10 stainless steel flatware with titanium PVD champagne gold matte finish.',
    story: 'Balanced teardrop handles and understated satin luster elevate everyday meals into celebratory banquets.',
    categorySlug: 'kitchen-and-dining',
    collectionSlugs: ['artisanal-dining'],
    tagSlugs: ['handcrafted'],
    materials: ['18/10 Stainless Steel', 'Titanium PVD Coating'],
    dimensions: { weight: '1.2 kg' },
    careInstructions: 'Dishwasher safe. Avoid harsh abrasive scouring pads to retain satin finish.',
    room: 'Dining Room',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1584346133934-a3afd2a33c4c?w=1200&q=80', altText: 'Hand-Forged Matte Gold Cutlery Set layout' },
      { url: 'https://images.unsplash.com/photo-1576867757603-05b134ebc379?w=1200&q=80', altText: 'Hand-Forged Matte Gold Cutlery Set detail' },
    ],
    variants: [
      { sku: 'CUTLERY-GOLD-4PC', pricePaise: 129900, compareAtPricePaise: null, stockQuantity: 15, attributes: [{ title: 'Set Size', value: '4-Piece (1 Place)' }, { title: 'Finish', value: 'Matte Gold' }] },
      { sku: 'CUTLERY-GOLD-16PC', pricePaise: 449900, compareAtPricePaise: 499900, stockQuantity: 8, attributes: [{ title: 'Set Size', value: '16-Piece (4 Places)' }, { title: 'Finish', value: 'Matte Gold' }] },
    ],
  },
  {
    name: 'Acacia End-Grain Chopping Block',
    slug: 'acacia-end-grain-chopping-block',
    description: 'Substantial butcher block board assembled from end-grain acacia blocks with recessed finger grooves.',
    story: 'Gentle on knife edges, end-grain fiber orientation naturally heals knife cuts and endures for generations.',
    categorySlug: 'kitchen-and-dining',
    collectionSlugs: [],
    tagSlugs: ['sustainable'],
    materials: ['Natural Acacia Hardwood'],
    dimensions: { height: '5 cm', width: '45 cm', depth: '32 cm', weight: '3.8 kg' },
    careInstructions: 'Hand wash only with mild soap. Oil monthly with food-safe mineral oil.',
    room: 'Kitchen',
    style: 'Contemporary',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?w=1200&q=80', altText: 'Acacia End-Grain Chopping Block on kitchen island' },
      { url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1200&q=80', altText: 'Acacia End-Grain Chopping Block wood pattern' },
    ],
    variants: [
      { sku: 'ACACIA-BLOCK-45', pricePaise: 219900, compareAtPricePaise: null, stockQuantity: 11, attributes: [{ title: 'Size', value: '45x32cm' }] },
    ],
  },

  // --- Lighting (7..9) ---
  {
    name: 'Amber Pleat Glass Table Lamp',
    slug: 'amber-pleat-glass-table-lamp',
    description: 'Mouth-blown fluted amber glass table lamp with solid antique brass stem and warm linen drum shade.',
    story: 'Inspired by retro 1970s Italian ambient lamps, casting an inviting diffused amber hue across bedside or study.',
    categorySlug: 'lighting',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['bestseller'],
    materials: ['Mouth-Blown Glass', 'Solid Brass', 'Natural Linen'],
    dimensions: { height: '48 cm', diameter: '28 cm', weight: '2.4 kg' },
    careInstructions: 'Wipe glass with lint-free cloth. E27 warm LED bulb (3000K) recommended.',
    room: 'Bedroom',
    style: 'Mid-Century',
    isFeatured: true,
    giftWrapEligible: true,
    videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    showInHomeVideoShowcase: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80', altText: 'Amber Pleat Glass Table Lamp illuminated' },
      { url: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=1200&q=80', altText: 'Amber Pleat Glass Table Lamp side profile' },
    ],
    variants: [
      { sku: 'AMBER-LAMP-SM', pricePaise: 289900, compareAtPricePaise: 329900, stockQuantity: 7, attributes: [{ title: 'Size', value: 'Small (38cm)' }, { title: 'Colour', value: 'Amber' }] },
      { sku: 'AMBER-LAMP-LG', pricePaise: 369900, compareAtPricePaise: 429900, stockQuantity: 5, attributes: [{ title: 'Size', value: 'Large (48cm)' }, { title: 'Colour', value: 'Amber' }] },
    ],
  },
  {
    name: 'Alabaster Glow Pendant Light',
    slug: 'alabaster-glow-pendant-light',
    description: 'Carved natural translucent Spanish alabaster hemisphere suspended by a braided twisted fabric cord.',
    story: 'Every stone shade reveals unique veining when illuminated, creating an organic celestial orb over dining tables.',
    categorySlug: 'lighting',
    collectionSlugs: [],
    tagSlugs: ['handcrafted', 'limited-edition'],
    materials: ['Natural Alabaster Stone', 'Brushed Brass Hardware'],
    dimensions: { height: '22 cm', diameter: '30 cm', weight: '4.5 kg' },
    careInstructions: 'Clean with dry microfiber cloth. Professional electrical installation advised.',
    room: 'Dining Room',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: false,
    images: [
      { url: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?w=1200&q=80', altText: 'Alabaster Glow Pendant Light dining view' },
      { url: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=1200&q=80', altText: 'Alabaster Glow Pendant Light stone veining' },
    ],
    variants: [
      { sku: 'ALABASTER-PEND-30', pricePaise: 549900, compareAtPricePaise: null, stockQuantity: 4, attributes: [{ title: 'Diameter', value: '30cm' }] },
    ],
  },
  {
    name: 'Nordic Minimalist Arc Floor Lamp',
    slug: 'nordic-minimalist-arc-floor-lamp',
    description: 'Gracefully curved cantilevered floor lamp anchored by a solid white marble plinth base.',
    story: 'Reaching over sectionals without ceiling wiring, offering task light for late-night reading and hosting.',
    categorySlug: 'lighting',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['new-arrival'],
    materials: ['White Carrara Marble', 'Powder-Coated Steel', 'Brass'],
    dimensions: { height: '190 cm', width: '120 cm', weight: '16.5 kg' },
    careInstructions: 'Wipe marble base with damp cloth and dry immediately. Dust metal frame regularly.',
    room: 'Living Room',
    style: 'Contemporary',
    isFeatured: false,
    giftWrapEligible: false,
    images: [
      { url: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80', altText: 'Nordic Minimalist Arc Floor Lamp living room' },
      { url: 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=1200&q=80', altText: 'Nordic Arc Floor Lamp marble base detail' },
    ],
    variants: [
      { sku: 'ARC-LAMP-BRS', pricePaise: 899900, compareAtPricePaise: 999900, stockQuantity: 4, attributes: [{ title: 'Finish', value: 'Warm Brass' }] },
      { sku: 'ARC-LAMP-CHR', pricePaise: 949900, compareAtPricePaise: null, stockQuantity: 3, attributes: [{ title: 'Finish', value: 'Matte Charcoal' }] },
    ],
  },

  // --- Tableware & Ceramics (10..12) ---
  {
    name: 'Terracotta Artisanal Serving Bowl',
    slug: 'terracotta-artisanal-serving-bowl',
    description: 'Generously proportioned shallow serving bowl with raw terracotta exterior and glossy white interior dip.',
    story: 'Wheel-thrown by master potters in Alwar, celebrating the ancient earth heritage of Indian pottery.',
    categorySlug: 'tableware-and-ceramics',
    collectionSlugs: ['artisanal-dining', 'thoughtful-gifts'],
    tagSlugs: ['handcrafted', 'sustainable'],
    materials: ['Earthen Terracotta Clay', 'Lead-Free Gloss Glaze'],
    dimensions: { height: '10 cm', diameter: '34 cm', weight: '1.9 kg' },
    careInstructions: 'Hand wash with mild detergent. Air dry thoroughly before storing.',
    room: 'Dining Room',
    style: 'Wabi-Sabi',
    isFeatured: true,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=1200&q=80', altText: 'Terracotta Artisanal Serving Bowl overview' },
      { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=1200&q=80', altText: 'Terracotta Serving Bowl rim glaze transition' },
    ],
    variants: [
      { sku: 'TERRA-BOWL-34', pricePaise: 149900, compareAtPricePaise: 179900, stockQuantity: 12, attributes: [{ title: 'Diameter', value: '34cm' }] },
    ],
  },
  {
    name: 'Sora Glazed Ceramic Coffee Mugs (Set of 2)',
    slug: 'sora-glazed-ceramic-coffee-mugs',
    description: 'Pair of cozy oversized ceramic mugs featuring ergonomic finger rests and variegated dripped glaze.',
    story: 'Shaped to fit naturally into cupped palms on slow Sunday mornings with freshly brewed filter coffee.',
    categorySlug: 'tableware-and-ceramics',
    collectionSlugs: ['artisanal-dining', 'thoughtful-gifts'],
    tagSlugs: ['bestseller'],
    materials: ['Stoneware Ceramic'],
    dimensions: { height: '9 cm', diameter: '8.5 cm', weight: '700 g' },
    careInstructions: 'Microwave and dishwasher safe. Capacity 350ml each.',
    room: 'Kitchen',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1200&q=80', altText: 'Sora Glazed Ceramic Coffee Mugs pair' },
      { url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=1200&q=80', altText: 'Sora Glazed Coffee Mug handle and glaze detail' },
    ],
    variants: [
      { sku: 'SORA-MUG-MOSS', pricePaise: 99900, compareAtPricePaise: null, stockQuantity: 14, attributes: [{ title: 'Colour', value: 'Moss Green' }, { title: 'Set', value: 'Pair' }] },
      { sku: 'SORA-MUG-MIST', pricePaise: 99900, compareAtPricePaise: null, stockQuantity: 10, attributes: [{ title: 'Colour', value: 'Sea Mist' }, { title: 'Set', value: 'Pair' }] },
      { sku: 'SORA-MUG-OCHR', pricePaise: 99900, compareAtPricePaise: null, stockQuantity: 8, attributes: [{ title: 'Colour', value: 'Earth Ochre' }, { title: 'Set', value: 'Pair' }] },
    ],
  },
  {
    name: 'Wabi-Sabi Speckled Salad Plates (Set of 4)',
    slug: 'wabi-sabi-speckled-salad-plates',
    description: 'Set of four organic-rim side plates with iron flecks embedded in warm cream stoneware glaze.',
    story: 'No two pieces are identical, highlighting deliberate asymmetry and wabi-sabi appreciation of natural beauty.',
    categorySlug: 'tableware-and-ceramics',
    collectionSlugs: ['artisanal-dining'],
    tagSlugs: ['handcrafted'],
    materials: ['Iron-Speckled Stoneware'],
    dimensions: { height: '2 cm', diameter: '21 cm', weight: '1.8 kg' },
    careInstructions: 'Dishwasher and microwave safe.',
    room: 'Dining Room',
    style: 'Wabi-Sabi',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80', altText: 'Wabi-Sabi Speckled Salad Plates stacked' },
      { url: 'https://images.unsplash.com/photo-1617897903246-719242758050?w=1200&q=80', altText: 'Wabi-Sabi Salad Plate table place setting' },
    ],
    variants: [
      { sku: 'WABI-PLATE-4PC', pricePaise: 189900, compareAtPricePaise: 219900, stockQuantity: 9, attributes: [{ title: 'Set Size', value: 'Set of 4' }] },
    ],
  },

  // --- Textiles & Cushions (13..15) ---
  {
    name: 'Sunday Waffle Linen Throw Blanket',
    slug: 'sunday-waffle-linen-throw-blanket',
    description: 'Pre-washed honeycomb waffle throw blanket woven from 100% French flax with eyelash fringed edges.',
    story: 'Breathable in warm Indian summers yet deeply insulating during monsoon evenings, softening with every wash.',
    categorySlug: 'textiles-and-cushions',
    collectionSlugs: ['warm-minimalist-living', 'thoughtful-gifts'],
    tagSlugs: ['bestseller', 'sustainable'],
    materials: ['100% French Flax Linen'],
    dimensions: { width: '130 cm', depth: '180 cm', weight: '1.1 kg' },
    careInstructions: 'Machine wash cold on gentle cycle. Tumble dry low or line dry in shade for relaxed texture.',
    room: 'Bedroom',
    style: 'Modern Minimalist',
    isFeatured: true,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=1200&q=80', altText: 'Sunday Waffle Linen Throw draped on sofa' },
      { url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1200&q=80', altText: 'Sunday Waffle Linen weave texture close-up' },
    ],
    variants: [
      { sku: 'THROW-LINEN-OAT', pricePaise: 249900, compareAtPricePaise: 289900, stockQuantity: 10, attributes: [{ title: 'Colour', value: 'Oatmeal' }, { title: 'Size', value: '130x180cm' }] },
      { sku: 'THROW-LINEN-TER', pricePaise: 249900, compareAtPricePaise: 289900, stockQuantity: 6, attributes: [{ title: 'Colour', value: 'Terracotta' }, { title: 'Size', value: '130x180cm' }] },
      { sku: 'THROW-LINEN-SAG', pricePaise: 249900, compareAtPricePaise: 289900, stockQuantity: 8, attributes: [{ title: 'Colour', value: 'Sage Olive' }, { title: 'Size', value: '130x180cm' }] },
    ],
  },
  {
    name: 'Nomadic Hand-Tufted Wool Cushion Cover',
    slug: 'nomadic-hand-tufted-wool-cushion-cover',
    description: 'High-pile geometric cushion cover hand-knotted by artisans using undyed New Zealand virgin wool.',
    story: 'Rich tactile dimensions inspired by Berber tribal tapestries, backed by heavy organic cotton canvas.',
    categorySlug: 'textiles-and-cushions',
    collectionSlugs: [],
    tagSlugs: ['handcrafted'],
    materials: ['Undyed Wool', 'Organic Cotton Canvas'],
    dimensions: { width: '45 cm', depth: '45 cm', weight: '650 g' },
    careInstructions: 'Dry clean recommended. Spot clean with mild wool detergent.',
    room: 'Living Room',
    style: 'Contemporary',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1200&q=80', altText: 'Nomadic Hand-Tufted Wool Cushion Cover' },
      { url: 'https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=1200&q=80', altText: 'Nomadic Wool Cushion tufted texture' },
    ],
    variants: [
      { sku: 'CUSH-NOMAD-16', pricePaise: 119900, compareAtPricePaise: null, stockQuantity: 12, attributes: [{ title: 'Size', value: '40x40cm (16")' }] },
      { sku: 'CUSH-NOMAD-20', pricePaise: 149900, compareAtPricePaise: null, stockQuantity: 7, attributes: [{ title: 'Size', value: '50x50cm (20")' }] },
    ],
  },
  {
    name: 'Raw Silk Textured Floor Cushion',
    slug: 'raw-silk-textured-floor-cushion',
    description: 'Oversized tufted meditation floor pouf in slubbed matka raw silk filled with firm organic cotton batting.',
    story: 'Designed for grounded Indian living rooms, spontaneous tea gatherings, and floor lounging.',
    categorySlug: 'textiles-and-cushions',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['new-arrival', 'handcrafted'],
    materials: ['Matka Raw Silk', 'Organic Cotton Fill'],
    dimensions: { height: '20 cm', width: '60 cm', depth: '60 cm', weight: '3.2 kg' },
    careInstructions: 'Spot clean only. Air in shaded breeze to refresh fibers.',
    room: 'Living Room',
    style: 'Wabi-Sabi',
    isFeatured: false,
    giftWrapEligible: false,
    videoUrl: 'https://media.w3.org/2010/05/sintel/trailer.mp4',
    showInHomeVideoShowcase: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80', altText: 'Raw Silk Textured Floor Cushion' },
      { url: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&q=80', altText: 'Raw Silk Cushion styled in reading nook' },
    ],
    variants: [
      { sku: 'FLOOR-CUSH-SILK', pricePaise: 329900, compareAtPricePaise: 379900, stockQuantity: 5, attributes: [{ title: 'Size', value: '60x60cm' }, { title: 'Colour', value: 'Raw Ochre' }] },
    ],
  },

  // --- Vases & Planters (16..18) ---
  {
    name: 'Cobalt Sculptural Wave Vase',
    slug: 'cobalt-sculptural-wave-vase',
    description: 'Hand-blown undulating glass vessel with electric cobalt blue core and optically clear rim.',
    story: 'An artistic focal point that catches morning window light, equally striking empty or filled with dried botanicals.',
    categorySlug: 'vases-and-planters',
    collectionSlugs: [],
    tagSlugs: ['bestseller'],
    materials: ['Hand-Blown Crystal Glass'],
    dimensions: { height: '30 cm', width: '18 cm', depth: '12 cm', weight: '1.7 kg' },
    careInstructions: 'Rinse with warm water and vinegar. Dry with microfiber cloth to avoid water spots.',
    room: 'Living Room',
    style: 'Contemporary',
    isFeatured: true,
    giftWrapEligible: true,
    videoUrl: 'https://media.w3.org/2010/05/bunny/trailer.mp4',
    showInHomeVideoShowcase: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=1200&q=80', altText: 'Cobalt Sculptural Wave Vase in studio' },
      { url: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=1200&q=80', altText: 'Cobalt Sculptural Vase glass curve refraction' },
    ],
    variants: [
      { sku: 'COBALT-VASE-30', pricePaise: 229900, compareAtPricePaise: 269900, stockQuantity: 6, attributes: [{ title: 'Colour', value: 'Cobalt Blue' }, { title: 'Height', value: '30cm' }] },
    ],
  },
  {
    name: 'Zen Ribbed Ceramic Planter with Saucer',
    slug: 'zen-ribbed-ceramic-planter',
    description: 'Cylindrical indoor plant pot featuring tactile vertical fluting and seamless matching drainage dish.',
    story: 'Promoting healthy root growth through integrated drainage while maintaining clean aesthetic lines on wooden floors.',
    categorySlug: 'vases-and-planters',
    collectionSlugs: [],
    tagSlugs: ['sustainable'],
    materials: ['Porous Stoneware Ceramic'],
    dimensions: { height: '22 cm', diameter: '20 cm', weight: '2.1 kg' },
    careInstructions: 'Wipe exterior with damp cloth. Ensure drainage hole remains unobstructed.',
    room: 'Balcony',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: false,
    images: [
      { url: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=1200&q=80', altText: 'Zen Ribbed Ceramic Planter with monstera plant' },
      { url: 'https://images.unsplash.com/photo-1512428813834-c702c7702b78?w=1200&q=80', altText: 'Zen Ribbed Planter texture close-up' },
    ],
    variants: [
      // Testing: 1 low stock variant (2 units) and 1 out-of-stock variant (0 units)
      { sku: 'ZEN-PLANT-6IN', pricePaise: 89900, compareAtPricePaise: null, stockQuantity: 2, isLimitedStock: true, attributes: [{ title: 'Size', value: '6-inch' }, { title: 'Colour', value: 'Olive Green' }] },
      { sku: 'ZEN-PLANT-8IN', pricePaise: 129900, compareAtPricePaise: null, stockQuantity: 7, attributes: [{ title: 'Size', value: '8-inch' }, { title: 'Colour', value: 'Olive Green' }] },
      { sku: 'ZEN-PLANT-10IN', pricePaise: 169900, compareAtPricePaise: null, stockQuantity: 0, attributes: [{ title: 'Size', value: '10-inch' }, { title: 'Colour', value: 'Olive Green' }] },
    ],
  },
  {
    name: 'Monolithic Fluted Pedestal Urn',
    slug: 'monolithic-fluted-pedestal-urn',
    description: 'Dramatic architectural urn vase sculpted from cast mineral stone composite with raw honed texture.',
    story: 'Commanding entryway presence inspired by neoclassical Grecian urns reinterpreted for serene minimal spaces.',
    categorySlug: 'vases-and-planters',
    collectionSlugs: ['warm-minimalist-living'],
    tagSlugs: ['limited-edition'],
    materials: ['Mineral Stone Composite'],
    dimensions: { height: '42 cm', diameter: '26 cm', weight: '5.6 kg' },
    careInstructions: 'Watertight interior. Wipe clean with soft damp cloth.',
    room: 'Living Room',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: false,
    images: [
      { url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=1200&q=80', altText: 'Monolithic Fluted Pedestal Urn side table' },
      { url: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=1200&q=80', altText: 'Monolithic Pedestal Urn matte finish detail' },
    ],
    variants: [
      { sku: 'URN-PEDESTAL-42', pricePaise: 389900, compareAtPricePaise: null, stockQuantity: 4, attributes: [{ title: 'Height', value: '42cm' }, { title: 'Finish', value: 'Chalk White' }] },
    ],
  },

  // --- Gifting & Decor (19..21) ---
  {
    name: 'Botanical Sandalwood & Amber Scented Candle',
    slug: 'botanical-sandalwood-amber-candle',
    description: 'Hand-poured 100% natural soy wax candle infused with Mysore sandalwood, warm amber resin, and vetiver.',
    story: 'Poured in a reusable handmade stoneware tumbler that becomes an espresso cup once the candle burns down.',
    categorySlug: 'gifting-and-decor',
    collectionSlugs: ['thoughtful-gifts'],
    tagSlugs: ['bestseller', 'sustainable'],
    materials: ['Soy Wax', 'Cotton Wick', 'Stoneware Tumbler'],
    dimensions: { height: '10 cm', diameter: '8 cm', weight: '550 g' },
    careInstructions: 'Trim wick to 5mm before every burn. Never leave a burning candle unattended.',
    room: 'Living Room',
    style: 'Wabi-Sabi',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=1200&q=80', altText: 'Botanical Sandalwood & Amber Scented Candle lit' },
      { url: 'https://images.unsplash.com/photo-1508746829417-e6f548d8d6ed?w=1200&q=80', altText: 'Botanical Candle ceramic vessel top view' },
    ],
    variants: [
      { sku: 'CANDLE-SAN-200G', pricePaise: 79900, compareAtPricePaise: 89900, stockQuantity: 20, attributes: [{ title: 'Weight', value: '200g (40 hrs)' }] },
      { sku: 'CANDLE-SAN-400G', pricePaise: 139900, compareAtPricePaise: 159900, stockQuantity: 12, attributes: [{ title: 'Weight', value: '400g (80 hrs)' }] },
    ],
  },
  {
    name: 'Handcrafted Brass Incense Burner & Vessel',
    slug: 'handcrafted-brass-incense-burner',
    description: 'Solid machined brass dhoop cone and stick incense holder with custom ash catcher dish.',
    story: 'Elevating daily aromatic morning rituals with weighted brass precision and mindful geometric proportion.',
    categorySlug: 'gifting-and-decor',
    collectionSlugs: ['thoughtful-gifts'],
    tagSlugs: ['handcrafted'],
    materials: ['Solid Spun Brass'],
    dimensions: { height: '6 cm', diameter: '12 cm', weight: '450 g' },
    careInstructions: 'Clean ash with dry brush. Polish occasionally with brass cleaner if bright shine is desired.',
    room: 'Bedroom',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=1200&q=80', altText: 'Handcrafted Brass Incense Burner with burning stick' },
      { url: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=1200&q=80', altText: 'Handcrafted Brass Incense dish detail' },
    ],
    variants: [
      { sku: 'INCENSE-BRS-DISC', pricePaise: 169900, compareAtPricePaise: null, stockQuantity: 15, attributes: [{ title: 'Material', value: 'Brushed Brass' }] },
    ],
  },
  {
    name: 'Scandi Minimalist Arch Desk Mirror',
    slug: 'scandi-minimalist-arch-desk-mirror',
    description: 'Arch-top free-standing vanity mirror slotted securely into a solid natural European oak base.',
    story: 'Reflecting soft natural bedroom light with distortion-free optical glass and honest timber joinery.',
    categorySlug: 'gifting-and-decor',
    collectionSlugs: ['thoughtful-gifts'],
    tagSlugs: ['new-arrival'],
    materials: ['European Oak Wood', 'Float Mirror Glass'],
    dimensions: { height: '36 cm', width: '25 cm', depth: '8 cm', weight: '1.4 kg' },
    careInstructions: 'Clean mirror glass with glass cleaner. Dust oak base with dry microfiber.',
    room: 'Bedroom',
    style: 'Modern Minimalist',
    isFeatured: false,
    giftWrapEligible: true,
    images: [
      { url: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&q=80', altText: 'Scandi Minimalist Arch Desk Mirror on dresser' },
      { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=80', altText: 'Arch Desk Mirror wooden stand joinery' },
    ],
    variants: [
      { sku: 'MIRROR-ARCH-OAK', pricePaise: 249900, compareAtPricePaise: null, stockQuantity: 8, attributes: [{ title: 'Size', value: '36x25cm' }] },
    ],
  },
];

// ---------------------------------------------------------------------------
// 5. Customers & Verified Accounts
// ---------------------------------------------------------------------------
const customersData = [
  {
    name: 'Priya Patel',
    email: 'priya.patel@example.com',
    phone: '+919820145678',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
    address: {
      recipient: 'Priya Patel',
      phone: '+919820145678',
      line1: 'B-402, Sumer Kendra, Pandurang Budhkar Marg',
      line2: 'Worli',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400018',
      countryCode: 'IN',
    },
  },
  {
    name: 'Aarav Sharma',
    email: 'aarav.sharma@example.com',
    phone: '+919811234567',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    address: {
      recipient: 'Aarav Sharma',
      phone: '+919811234567',
      line1: 'Plot 14, Block C, Vasant Vihar',
      line2: 'Near Priya Cinema',
      city: 'New Delhi',
      state: 'Delhi',
      pinCode: '110057',
      countryCode: 'IN',
    },
  },
  {
    name: 'Ananya Iyer',
    email: 'ananya.iyer@example.com',
    phone: '+919900188765',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    address: {
      recipient: 'Ananya Iyer',
      phone: '+919900188765',
      line1: '12th Cross, 4th Main, Indiranagar Stage 2',
      line2: 'Near Defence Colony Playfield',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560038',
      countryCode: 'IN',
    },
  },
];

// ---------------------------------------------------------------------------
// 6. Realistic Reviews Data (Approved + Pending)
// ---------------------------------------------------------------------------
const reviewsData = [
  {
    productSlug: 'aura-handwoven-lounge-chair',
    customerEmail: 'priya.patel@example.com',
    rating: 5,
    title: 'Exquisite comfort and architectural elegance',
    body: 'The natural ash finish and Danish cord weaving are flawless. It anchors our reading nook so gracefully. Delivery to Mumbai was swift and well-packaged.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'aura-handwoven-lounge-chair',
    customerEmail: 'aarav.sharma@example.com',
    rating: 5,
    title: 'Heirloom craftsmanship',
    body: 'Remarkable build quality. You can immediately sense the solid wood construction and hand-tensioned cord. Worth every rupee.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'kyoto-stoneware-dinner-set',
    customerEmail: 'ananya.iyer@example.com',
    rating: 5,
    title: 'Elevates every single dinner party',
    body: 'The dual-tone glaze is even richer in person than on screen. Substantial weight in hand and washed cleanly in our dishwasher without any issues.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'amber-pleat-glass-table-lamp',
    customerEmail: 'priya.patel@example.com',
    rating: 5,
    title: 'The warm amber glow is magical',
    body: 'Creates such an inviting, serene evening ambiance in our bedroom. The brass base has satisfying heft and the fluted glass refracts light delightfully.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'amber-pleat-glass-table-lamp',
    customerEmail: 'ananya.iyer@example.com',
    rating: 4,
    title: 'Stunning centerpiece on the console',
    body: 'Delighted with the craftsmanship. Swapped in a warm filament 2700K bulb and it transformed our living space completely.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'terracotta-artisanal-serving-bowl',
    customerEmail: 'aarav.sharma@example.com',
    rating: 5,
    title: 'Authentic Indian earth character',
    body: 'The tactile contrast between raw terracotta and the dip glaze is gorgeous. Used it to serve warm festive biryani and received endless compliments.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'sunday-waffle-linen-throw-blanket',
    customerEmail: 'priya.patel@example.com',
    rating: 5,
    title: 'Pure linen luxury for the sofa',
    body: 'Unbelievably soft waffle weave that breathes in summer and keeps you cozy with AC on. The terracotta hue is earthy and grounded.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'cobalt-sculptural-wave-vase',
    customerEmail: 'ananya.iyer@example.com',
    rating: 5,
    title: 'A true work of glass art',
    body: 'Catching sunlight on our dining credenza, this vase looks like a gallery piece. Packed with multiple layers of honeycomb paper and arrived in pristine condition.',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'botanical-sandalwood-amber-candle',
    customerEmail: 'aarav.sharma@example.com',
    rating: 5,
    title: 'Subtle, authentic sandalwood aroma',
    body: 'Not overpowering like synthetic candles. Pure calming Mysore sandalwood with amber notes. Love that the ceramic vessel can be reused as a tumbler!',
    moderationStatus: 'APPROVED' as const,
  },
  {
    productSlug: 'zen-ribbed-ceramic-planter',
    customerEmail: 'priya.patel@example.com',
    rating: 4,
    title: 'Clean minimal lines with thoughtful drainage',
    body: 'The matching saucer is a lifesaver for indoor wooden floors. Looks handsome housing our fiddle-leaf fig plant.',
    moderationStatus: 'APPROVED' as const,
  },
  // Pending reviews for Admin Moderation verification
  {
    productSlug: 'brutalist-solid-teak-coffee-table',
    customerEmail: 'aarav.sharma@example.com',
    rating: 5,
    title: 'Exceptional timber quality and grain',
    body: 'Heavy solid teak with beautiful natural grain. Fits our modern wabi-sabi living room theme to perfection.',
    moderationStatus: 'PENDING' as const,
  },
  {
    productSlug: 'handcrafted-brass-incense-burner',
    customerEmail: 'ananya.iyer@example.com',
    rating: 4,
    title: 'Beautiful daily ritual piece',
    body: 'Solid brass weight and catches incense ash neatly on the saucer. Very pleased with this purchase.',
    moderationStatus: 'PENDING' as const,
  },
];

// ---------------------------------------------------------------------------
// Main Idempotent Execution Function
// ---------------------------------------------------------------------------
async function main() {
  const db = new PrismaService();
  try {
    console.log('=== Home & Lifestyle Manual Demo Data Seed ===');
    console.log('Seeding realistic India / INR catalogue, store settings, promotions, and reviews...');

    // 1. Store Settings
    await db.storeSettings.upsert({
      where: { id: 'store' },
      update: {
        storeName: storeSettingsData.storeName,
        supportEmail: storeSettingsData.supportEmail,
        supportPhone: storeSettingsData.supportPhone,
        publicAddress: storeSettingsData.publicAddress,
        businessHours: storeSettingsData.businessHours,
        giftWrapFeePaise: storeSettingsData.giftWrapFeePaise,
        giftMessagesAvailable: storeSettingsData.giftMessagesAvailable,
        giftReceiptsAvailable: storeSettingsData.giftReceiptsAvailable,
        giftWrapDefaultEligible: storeSettingsData.giftWrapDefaultEligible,
        thresholdBasis: storeSettingsData.thresholdBasis,
        waiveHandlingOnFree: storeSettingsData.waiveHandlingOnFree,
      },
      create: storeSettingsData,
    });
    console.log('✓ Store settings & gifting configuration updated.');

    // 2. Restricted PIN codes
    for (const pin of restrictedPinCodes) {
      await db.pinCodeServiceability.upsert({
        where: { pinCode: pin.pinCode },
        update: { supported: pin.supported, enabled: pin.enabled, reason: pin.reason },
        create: pin,
      });
    }
    console.log(`✓ Restricted PIN codes (${restrictedPinCodes.map(p => p.pinCode).join(', ')}) configured.`);

    // 3. Categories
    const categoryMap = new Map<string, string>();
    for (const cat of categoriesData) {
      const record = await db.category.upsert({
        where: { slug: cat.slug },
        update: {
          name: cat.name,
          description: cat.description,
          status: 'ACTIVE',
          showInStorefrontNav: cat.showInStorefrontNav,
          storefrontNavPosition: cat.storefrontNavPosition,
          imageUrl: cat.imageUrl,
          secondaryImageUrl: cat.secondaryImageUrl,
          deletedAt: null,
        },
        create: {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          status: 'ACTIVE',
          showInStorefrontNav: cat.showInStorefrontNav,
          storefrontNavPosition: cat.storefrontNavPosition,
          imageUrl: cat.imageUrl,
          secondaryImageUrl: cat.secondaryImageUrl,
        },
      });
      categoryMap.set(cat.slug, record.id);
    }
    console.log(`✓ Seeded ${categoriesData.length} categories (5 active in storefront navbar).`);

    // 4. Collections
    const collectionMap = new Map<string, string>();
    for (const col of collectionsData) {
      const record = await db.collection.upsert({
        where: { slug: col.slug },
        update: {
          name: col.name,
          description: col.description,
          position: col.position,
        },
        create: {
          name: col.name,
          slug: col.slug,
          description: col.description,
          position: col.position,
        },
      });
      collectionMap.set(col.slug, record.id);
    }
    console.log(`✓ Seeded ${collectionsData.length} curated collections.`);

    // 5. Tags
    const tagMap = new Map<string, string>();
    for (const tag of tagsData) {
      const record = await db.tag.upsert({
        where: { slug: tag.slug },
        update: { name: tag.name },
        create: { name: tag.name, slug: tag.slug },
      });
      tagMap.set(tag.slug, record.id);
    }
    console.log(`✓ Seeded ${tagsData.length} merchandising tags.`);

    // 6. Products, Variants, Images, Attributes
    const productMap = new Map<string, string>();
    for (const p of productsData) {
      const categoryId = categoryMap.get(p.categorySlug);
      if (!categoryId) continue;

      const productRecord = await db.product.upsert({
        where: { slug: p.slug },
        update: {
          name: p.name,
          description: p.description,
          story: p.story,
          status: 'PUBLISHED',
          isFeatured: p.isFeatured,
          giftWrapEligible: p.giftWrapEligible,
          videoUrl: p.videoUrl ?? null,
          showInHomeVideoShowcase: Boolean(p.showInHomeVideoShowcase && p.videoUrl),
          showInHeroCarousel: Boolean(p.showInHeroCarousel),
          materials: p.materials,
          dimensions: p.dimensions,
          careInstructions: p.careInstructions,
        },
        create: {
          name: p.name,
          slug: p.slug,
          description: p.description,
          story: p.story,
          status: 'PUBLISHED',
          isFeatured: p.isFeatured,
          giftWrapEligible: p.giftWrapEligible,
          videoUrl: p.videoUrl ?? null,
          showInHomeVideoShowcase: Boolean(p.showInHomeVideoShowcase && p.videoUrl),
          showInHeroCarousel: Boolean(p.showInHeroCarousel),
          materials: p.materials,
          dimensions: p.dimensions,
          careInstructions: p.careInstructions,
        },
      });
      productMap.set(p.slug, productRecord.id);

      // Link to Category
      await db.productCategory.upsert({
        where: { productId_categoryId: { productId: productRecord.id, categoryId } },
        update: {},
        create: { productId: productRecord.id, categoryId },
      });

      // Link to Collections
      for (let i = 0; i < p.collectionSlugs.length; i++) {
        const colId = collectionMap.get(p.collectionSlugs[i]);
        if (colId) {
          await db.productCollection.upsert({
            where: { productId_collectionId: { productId: productRecord.id, collectionId: colId } },
            update: { position: i },
            create: { productId: productRecord.id, collectionId: colId, position: i },
          });
        }
      }

      // Link to Tags
      for (const tagSlug of p.tagSlugs) {
        const tagId = tagMap.get(tagSlug);
        if (tagId) {
          await db.productTag.upsert({
            where: { productId_tagId: { productId: productRecord.id, tagId } },
            update: {},
            create: { productId: productRecord.id, tagId },
          });
        }
      }

      // Images (replace cleanly to keep positions 0 and 1)
      await db.productImage.deleteMany({ where: { productId: productRecord.id } });
      for (let i = 0; i < p.images.length; i++) {
        await db.productImage.create({
          data: {
            productId: productRecord.id,
            url: p.images[i].url,
            altText: p.images[i].altText,
            position: i,
          },
        });
      }

      // Attributes (room, style)
      await db.productAttribute.deleteMany({ where: { productId: productRecord.id } });
      await db.productAttribute.createMany({
        data: [
          { productId: productRecord.id, key: 'room', textValue: p.room },
          { productId: productRecord.id, key: 'style', textValue: p.style },
        ],
      });

      // Variants
      for (let i = 0; i < p.variants.length; i++) {
        const v = p.variants[i];
        const optKey = `opt-${p.slug}-${i}`;
        await db.productVariant.upsert({
          where: { sku: v.sku },
          update: {
            pricePaise: v.pricePaise,
            compareAtPricePaise: v.compareAtPricePaise ?? null,
            stockQuantity: v.stockQuantity,
            isLimitedStock: Boolean(v.isLimitedStock),
            attributes: v.attributes,
          },
          create: {
            productId: productRecord.id,
            sku: v.sku,
            pricePaise: v.pricePaise,
            compareAtPricePaise: v.compareAtPricePaise ?? null,
            stockQuantity: v.stockQuantity,
            isLimitedStock: Boolean(v.isLimitedStock),
            optionCombinationKey: optKey,
            attributes: v.attributes,
          },
        });
      }
    }
    console.log(`✓ Seeded ${productsData.length} published products with multi-image galleries, variants, and facets.`);

    // 7. Active Promotions
    const featuredProduct = await db.product.findUnique({ where: { slug: 'amber-pleat-glass-table-lamp' } });
    const kitchenCategory = await db.category.findUnique({ where: { slug: 'kitchen-and-dining' } });
    const lightingCategory = await db.category.findUnique({ where: { slug: 'lighting' } });

    const futureDate = new Date('2027-12-31T23:59:59Z');

    // 7.1 Product percentage discount (20% off)
    if (featuredProduct) {
      const existing = await db.promotion.findFirst({ where: { productId: featuredProduct.id, name: 'Curated Icon Special: 20% Off' } });
      if (existing) {
        await db.promotion.update({
          where: { id: existing.id },
          data: { lifecycle: 'PUBLISHED', enabled: true, kind: 'PERCENTAGE', percentBasisPoints: 2000, endsAt: futureDate },
        });
      } else {
        await db.promotion.create({
          data: {
            name: 'Curated Icon Special: 20% Off',
            lifecycle: 'PUBLISHED',
            enabled: true,
            productId: featuredProduct.id,
            kind: 'PERCENTAGE',
            percentBasisPoints: 2000,
            endsAt: futureDate,
          },
        });
      }
    }

    // 7.2 Category flat INR discount (₹200 off)
    if (kitchenCategory) {
      const existing = await db.promotion.findFirst({ where: { categoryId: kitchenCategory.id, name: 'Artisanal Dining Festive Savings: ₹200 Off' } });
      if (existing) {
        await db.promotion.update({
          where: { id: existing.id },
          data: { lifecycle: 'PUBLISHED', enabled: true, kind: 'FIXED', amountPaise: 20000, endsAt: futureDate },
        });
      } else {
        await db.promotion.create({
          data: {
            name: 'Artisanal Dining Festive Savings: ₹200 Off',
            lifecycle: 'PUBLISHED',
            enabled: true,
            categoryId: kitchenCategory.id,
            kind: 'FIXED',
            amountPaise: 20000,
            endsAt: futureDate,
          },
        });
      }
    }

    // 7.3 Category percentage discount (15% off)
    if (lightingCategory) {
      const existing = await db.promotion.findFirst({ where: { categoryId: lightingCategory.id, name: 'Luminous Living: 15% Off Lighting' } });
      if (existing) {
        await db.promotion.update({
          where: { id: existing.id },
          data: { lifecycle: 'PUBLISHED', enabled: true, kind: 'PERCENTAGE', percentBasisPoints: 1500, endsAt: futureDate },
        });
      } else {
        await db.promotion.create({
          data: {
            name: 'Luminous Living: 15% Off Lighting',
            lifecycle: 'PUBLISHED',
            enabled: true,
            categoryId: lightingCategory.id,
            kind: 'PERCENTAGE',
            percentBasisPoints: 1500,
            endsAt: futureDate,
          },
        });
      }
    }
    console.log('✓ Seeded active product & category promotions (ticker & badges active).');

    // 8. Coupons
    await db.coupon.upsert({
      where: { code: 'WELCOME10' },
      update: {
        name: 'Welcome 10% Off',
        lifecycle: 'PUBLISHED',
        scope: 'CART',
        enabled: true,
        kind: 'PERCENTAGE',
        percentBasisPoints: 1000,
        maximumDiscountPaise: 50000,
        expiresAt: futureDate,
      },
      create: {
        name: 'Welcome 10% Off',
        code: 'WELCOME10',
        lifecycle: 'PUBLISHED',
        scope: 'CART',
        enabled: true,
        kind: 'PERCENTAGE',
        percentBasisPoints: 1000,
        maximumDiscountPaise: 50000,
        expiresAt: futureDate,
      },
    });

    await db.coupon.upsert({
      where: { code: 'HOME250' },
      update: {
        name: 'Home ₹250 Flat Off',
        lifecycle: 'PUBLISHED',
        scope: 'CART',
        enabled: true,
        kind: 'FIXED',
        amountPaise: 25000,
        minimumCartPaise: 150000,
        expiresAt: futureDate,
      },
      create: {
        name: 'Home ₹250 Flat Off',
        code: 'HOME250',
        lifecycle: 'PUBLISHED',
        scope: 'CART',
        enabled: true,
        kind: 'FIXED',
        amountPaise: 25000,
        minimumCartPaise: 150000,
        expiresAt: futureDate,
      },
    });
    console.log('✓ Seeded active coupons: WELCOME10 (10% off) & HOME250 (₹250 off min ₹1,500).');

    // 9. Demo Customers & Verified User Accounts
    const defaultPasswordHash = await hashPassword('CustomerPass123!');
    const customerIdMap = new Map<string, string>();

    for (const c of customersData) {
      const customer = await db.customer.upsert({
        where: { email: c.email },
        update: { name: c.name, phone: c.phone },
        create: { name: c.name, email: c.email, phone: c.phone },
      });
      customerIdMap.set(c.email, customer.id);

      // Verify customer address exists
      const existingAddress = await db.customerAddress.findFirst({ where: { customerId: customer.id } });
      if (!existingAddress) {
        await db.customerAddress.create({
          data: { customerId: customer.id, isDefault: true, ...c.address },
        });
      }

      // Check User account: NEVER overwrite an ADMIN user!
      const existingUser = await db.user.findUnique({ where: { email: c.email } });
      if (!existingUser) {
        await db.user.create({
          data: {
            name: c.name,
            email: c.email,
            emailOriginal: c.email,
            emailVerifiedAt: new Date(),
            role: 'CUSTOMER',
            passwordHash: defaultPasswordHash,
            avatarUrl: c.avatarUrl,
            customerId: customer.id,
          },
        });
      } else if (existingUser.role === 'CUSTOMER' && !existingUser.customerId) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { customerId: customer.id, avatarUrl: c.avatarUrl },
        });
      }
    }
    console.log(`✓ Seeded ${customersData.length} verified demo customer profiles & default addresses.`);

    // 10. Reviews (Approved + Pending)
    let reviewCount = 0;
    for (const r of reviewsData) {
      const productId = productMap.get(r.productSlug);
      const customerId = customerIdMap.get(r.customerEmail);
      if (!productId) continue;

      const existingReview = await db.review.findFirst({
        where: { productId, title: r.title },
      });

      if (!existingReview) {
        await db.review.create({
          data: {
            productId,
            customerId: customerId ?? null,
            rating: r.rating,
            title: r.title,
            body: r.body,
            moderationStatus: r.moderationStatus,
          },
        });
        reviewCount++;
      }
    }
    console.log(`✓ Seeded ${reviewCount} reviews (${reviewsData.filter(r => r.moderationStatus === 'APPROVED').length} Approved, ${reviewsData.filter(r => r.moderationStatus === 'PENDING').length} Pending).`);

    console.log('=== Demo Data Seeding Completed Successfully! ===');
  } finally {
    await db.$disconnect();
  }
}

void main().catch(error => {
  console.error(`Demo seed error: ${error instanceof Error ? error.message : 'Unknown error.'}`);
  process.exitCode = 1;
});
