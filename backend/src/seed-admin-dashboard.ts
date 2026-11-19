import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { PrismaService } from './prisma.service';
import { readEnvironment } from './environment';
import { hashPassword } from './auth/password';

const sampleCustomers = [
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
      line1: '12th Cross, 4th Main, Indiranagar',
      line2: 'Stage 2',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560038',
      countryCode: 'IN',
    },
  },
  {
    name: 'Rohan Mehta',
    email: 'rohan.mehta@example.com',
    phone: '+919876543210',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    address: {
      recipient: 'Rohan Mehta',
      phone: '+919876543210',
      line1: 'Flat 701, Silver Arch Apartments',
      line2: 'Koregaon Park Road',
      city: 'Pune',
      state: 'Maharashtra',
      pinCode: '411001',
      countryCode: 'IN',
    },
  },
  {
    name: 'Sneha Reddy',
    email: 'sneha.reddy@example.com',
    phone: '+919440123456',
    avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150',
    address: {
      recipient: 'Sneha Reddy',
      phone: '+919440123456',
      line1: 'House 8-2-293, Road No. 14, Banjara Hills',
      line2: 'Opposite Park Hyatt',
      city: 'Hyderabad',
      state: 'Telangana',
      pinCode: '500034',
      countryCode: 'IN',
    },
  },
  {
    name: 'Vikram Malhotra',
    email: 'vikram.malhotra@example.com',
    phone: '+919814098765',
    avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    address: {
      recipient: 'Vikram Malhotra',
      phone: '+919814098765',
      line1: 'House 522, Sector 9-D',
      line2: 'Inner Market Road',
      city: 'Chandigarh',
      state: 'Punjab',
      pinCode: '160009',
      countryCode: 'IN',
    },
  },
  {
    name: 'Pooja Nair',
    email: 'pooja.nair@example.com',
    phone: '+919847011223',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    address: {
      recipient: 'Pooja Nair',
      phone: '+919847011223',
      line1: '32/1105, Panampilly Nagar',
      line2: 'Near Avenue Centre',
      city: 'Kochi',
      state: 'Kerala',
      pinCode: '682036',
      countryCode: 'IN',
    },
  },
  {
    name: 'Kabir Verma',
    email: 'kabir.verma@example.com',
    phone: '+919711055443',
    avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150',
    address: {
      recipient: 'Kabir Verma',
      phone: '+919711055443',
      line1: 'Villa 18, Nirvana Country',
      line2: 'Sector 50',
      city: 'Gurugram',
      state: 'Haryana',
      pinCode: '122018',
      countryCode: 'IN',
    },
  },
  {
    name: 'Meera Sen',
    email: 'meera.sen@example.com',
    phone: '+919830077665',
    avatarUrl: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=150',
    address: {
      recipient: 'Meera Sen',
      phone: '+919830077665',
      line1: '14B, Ballygunge Circular Road',
      line2: 'Minto Park',
      city: 'Kolkata',
      state: 'West Bengal',
      pinCode: '700019',
      countryCode: 'IN',
    },
  },
  {
    name: 'Aditya Joshi',
    email: 'aditya.joshi@example.com',
    phone: '+919414033221',
    avatarUrl: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150',
    address: {
      recipient: 'Aditya Joshi',
      phone: '+919414033221',
      line1: 'D-82, Malviya Nagar',
      line2: 'Near Calgiri Hospital',
      city: 'Jaipur',
      state: 'Rajasthan',
      pinCode: '302017',
      countryCode: 'IN',
    },
  },
];

const productImagesMap: Record<string, string> = {
  'Amber Pleat Lamp': 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80',
  'Cobalt Glass Vase': 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&q=80',
  'Sunday Stripe Cushion': 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=600&q=80',
  'Olive Rib Planter': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=600&q=80',
  'Terracotta Serving Bowl': 'https://images.unsplash.com/photo-1615486511484-92e172cc4fe0?w=600&q=80',
  'Lilac Taper Candle': 'https://images.unsplash.com/photo-1603006905003-be475563bc59?w=600&q=80',
  'Woven Table Runner': 'https://images.unsplash.com/photo-1617897903246-719242758050?w=600&q=80',
  'Petal Trinket Dish': 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?w=600&q=80',
};

const sampleReviewTexts = [
  { rating: 5, title: 'Breathtaking quality', body: 'The warm amber glow from this lamp creates such a cozy, calming atmosphere in my living room. Packaging was immaculate!' },
  { rating: 5, title: 'Absolutely stunning ceramics', body: 'The terracotta bowl has authentic handcrafted character and weight. Used it for our anniversary dinner and received so many compliments.' },
  { rating: 4, title: 'Rich color, solid build', body: 'The cobalt blue glass catches afternoon light beautifully on my console table. Delivery took 3 days to Mumbai.' },
  { rating: 5, title: 'Pure artisanal luxury', body: 'Fabric is textured yet soft, stitching is top-notch. Truly elevates the whole sofa setup.' },
  { rating: 4, title: 'Elegant minimalist planter', body: 'Perfect earthy green hue and fits a 6-inch nursery pot snugly. Very pleased with the matte ribbed finish.' },
  { rating: 3, title: 'Lovely aesthetic, slightly small', body: 'The candle looks gorgeous on our dining table, though it burned a bit faster than expected. Lovely subtle fragrance though.' },
  { rating: 5, title: 'Exceeded expectations', body: 'The woven runner brings a modern rustic charm to our wooden table. Spills wiped off easily without staining.' },
  { rating: 5, title: 'Delicate and charming', body: 'Keep this trinket dish on my bedside nightstand for everyday jewelry. Beautiful glossy glaze.' },
  { rating: 4, title: 'Subtle sophistication', body: 'Matches our interior theme seamlessly. High quality materials and fast customer response.' },
  { rating: 5, title: 'Remarkable craftsmanship', body: 'You can immediately tell this is handcrafted with care. Worth every rupee.' },
  { rating: 2, title: 'Color slightly different from screen', body: 'The shade looks a bit darker under warm indoor lighting compared to website photos. Still good build quality though.' },
  { rating: 5, title: 'A true centerpiece', body: 'Everyone who visits asks where we got this! Incredible attention to detail.' },
];

async function main() {
  const url = new URL(readEnvironment().databaseUrl);
  if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname)) {
    throw new Error('Dummy data seeding requires a local database host.');
  }

  const db = new PrismaService();
  try {
    console.log('--- Starting Admin Dashboard Dummy Data Seeding ---');

    // 1. Find Admin user for history references
    const adminUser = await db.user.findFirst({ where: { role: 'ADMIN', deletedAt: null } });
    if (!adminUser) {
      throw new Error('No admin user found. Run admin bootstrap first.');
    }
    console.log(`Using admin: ${adminUser.name} (${adminUser.email})`);

    // 2. Seed / Upsert Customers, Users, Addresses
    const defaultPasswordHash = await hashPassword('CustomerPass123!');
    const seededCustomers: Array<{ id: string; user: { id: string; name: string }; email: string; name: string; phone: string; address: (typeof sampleCustomers)[number]['address'] }> = [];

    for (const item of sampleCustomers) {
      let customer = await db.customer.findUnique({ where: { email: item.email } });
      if (!customer) {
        customer = await db.customer.create({
          data: {
            name: item.name,
            email: item.email,
            phone: item.phone,
          },
        });
      }

      let user = await db.user.findUnique({ where: { email: item.email } });
      if (!user) {
        user = await db.user.create({
          data: {
            name: item.name,
            email: item.email,
            emailOriginal: item.email,
            emailVerifiedAt: new Date(Date.now() - 25 * 86400000),
            role: 'CUSTOMER',
            passwordHash: defaultPasswordHash,
            avatarUrl: item.avatarUrl,
            customerId: customer.id,
          },
        });
      } else if (!user.customerId) {
        user = await db.user.update({
          where: { id: user.id },
          data: { customerId: customer.id, avatarUrl: item.avatarUrl },
        });
      }

      // Check or create customer address
      const existingAddress = await db.customerAddress.findFirst({ where: { customerId: customer.id } });
      if (!existingAddress) {
        await db.customerAddress.create({
          data: {
            customerId: customer.id,
            ...item.address,
          },
        });
      }

      seededCustomers.push({
        id: customer.id,
        user: { id: user.id, name: user.name },
        email: item.email,
        name: item.name,
        phone: item.phone,
        address: item.address,
      });
    }
    console.log(`Seeded ${seededCustomers.length} active customer profiles with addresses.`);

    // 3. Ensure Products and ProductImages
    const products = await db.product.findMany({
      include: {
        variants: true,
        images: true,
      },
    });

    if (products.length === 0) {
      throw new Error('No products found in DB. Run seed:demo first.');
    }

    let imagesAdded = 0;
    for (const prod of products) {
      if (prod.images.length === 0) {
        const imageUrl = productImagesMap[prod.name] || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80';
        await db.productImage.create({
          data: {
            productId: prod.id,
            url: imageUrl,
            altText: prod.name,
            position: 0,
          },
        });
        imagesAdded++;
      }
    }
    console.log(`Attached ${imagesAdded} product images to products lacking images.`);

    // Refresh products with images and variants
    const allProducts = await db.product.findMany({
      where: { status: 'PUBLISHED' },
      include: { variants: true, images: true },
    });
    const catalogVariants = allProducts.flatMap(p => p.variants.map(v => ({ product: p, variant: v })));
    if (catalogVariants.length === 0) {
      throw new Error('No product variants available for order lines.');
    }

    // 4. Generate Orders & Payments over the last 28 days
    const now = Date.now();
    const orderStatuses: Array<{ status: string; daysAgo: number; hoursOffset: number; paymentStatus: 'SUCCEEDED' | 'PENDING' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' }> = [
      // Today (3 orders)
      { status: 'NEW', daysAgo: 0, hoursOffset: 2, paymentStatus: 'SUCCEEDED' },
      { status: 'NEW', daysAgo: 0, hoursOffset: 5, paymentStatus: 'SUCCEEDED' },
      { status: 'PROCESSING', daysAgo: 0, hoursOffset: 8, paymentStatus: 'SUCCEEDED' },

      // Yesterday (3 orders)
      { status: 'NEW', daysAgo: 1, hoursOffset: 12, paymentStatus: 'SUCCEEDED' },
      { status: 'PROCESSING', daysAgo: 1, hoursOffset: 16, paymentStatus: 'SUCCEEDED' },
      { status: 'READY_TO_SHIP', daysAgo: 1, hoursOffset: 20, paymentStatus: 'SUCCEEDED' },

      // Last 7 days (8 orders)
      { status: 'READY_TO_SHIP', daysAgo: 2, hoursOffset: 10, paymentStatus: 'SUCCEEDED' },
      { status: 'SHIPPED', daysAgo: 2, hoursOffset: 17, paymentStatus: 'SUCCEEDED' },
      { status: 'SHIPPED', daysAgo: 3, hoursOffset: 11, paymentStatus: 'SUCCEEDED' },
      { status: 'SHIPPED', daysAgo: 3, hoursOffset: 19, paymentStatus: 'SUCCEEDED' },
      { status: 'SHIPPED', daysAgo: 4, hoursOffset: 14, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 4, hoursOffset: 22, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 5, hoursOffset: 13, paymentStatus: 'SUCCEEDED' },
      { status: 'CANCELLED', daysAgo: 6, hoursOffset: 15, paymentStatus: 'FAILED' },

      // 8 - 28 days ago (14 orders)
      { status: 'DELIVERED', daysAgo: 7, hoursOffset: 10, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 8, hoursOffset: 15, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 10, hoursOffset: 11, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 11, hoursOffset: 18, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 13, hoursOffset: 12, paymentStatus: 'PARTIALLY_REFUNDED' }, // Has partial refund
      { status: 'DELIVERED', daysAgo: 14, hoursOffset: 16, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 16, hoursOffset: 14, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 18, hoursOffset: 11, paymentStatus: 'SUCCEEDED' },
      { status: 'CANCELLED', daysAgo: 19, hoursOffset: 9, paymentStatus: 'REFUNDED' }, // Fully refunded
      { status: 'DELIVERED', daysAgo: 21, hoursOffset: 17, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 23, hoursOffset: 13, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 24, hoursOffset: 19, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 26, hoursOffset: 15, paymentStatus: 'SUCCEEDED' },
      { status: 'DELIVERED', daysAgo: 28, hoursOffset: 11, paymentStatus: 'SUCCEEDED' },
    ];

    let orderCount = 0;
    let paymentCount = 0;
    let refundCount = 0;
    const deliveredOrdersWithProducts: Array<{ customerId: string; productId: string }> = [];

    for (let i = 0; i < orderStatuses.length; i++) {
      const spec = orderStatuses[i];
      const customer = seededCustomers[i % seededCustomers.length];
      const orderDate = new Date(now - (spec.daysAgo * 86400000 + spec.hoursOffset * 3600000));
      const orderNumber = `ORD-202611-${String(101 + i).padStart(4, '0')}`;
      const checkoutKey = `chk_${randomUUID()}`;

      // Pick 1 to 2 items
      const item1 = catalogVariants[(i * 2) % catalogVariants.length];
      const item2 = (i % 2 === 0) ? catalogVariants[(i * 2 + 1) % catalogVariants.length] : null;

      const qty1 = (i % 3 === 0) ? 2 : 1;
      const unitPrice1 = item1.variant.pricePaise;
      const totalLine1 = unitPrice1 * qty1;

      let subtotalPaise = totalLine1;
      const lineData = [
        {
          id: randomUUID(),
          productIdSnapshot: item1.product.id,
          variantIdSnapshot: item1.variant.id,
          variantId: item1.variant.id,
          productName: item1.product.name,
          variantName: 'Default',
          sku: item1.variant.sku,
          quantity: qty1,
          unitPricePaise: unitPrice1,
          discountPaise: 0,
          taxPaise: Math.round(totalLine1 * 0.18),
          totalPaise: totalLine1,
          discountsSnapshot: [],
          optionsSnapshot: { size: 'Standard' },
        },
      ];

      if (item2 && item2.product.id !== item1.product.id) {
        const qty2 = 1;
        const unitPrice2 = item2.variant.pricePaise;
        const totalLine2 = unitPrice2 * qty2;
        subtotalPaise += totalLine2;
        lineData.push({
          id: randomUUID(),
          productIdSnapshot: item2.product.id,
          variantIdSnapshot: item2.variant.id,
          variantId: item2.variant.id,
          productName: item2.product.name,
          variantName: 'Default',
          sku: item2.variant.sku,
          quantity: qty2,
          unitPricePaise: unitPrice2,
          discountPaise: 0,
          taxPaise: Math.round(totalLine2 * 0.18),
          totalPaise: totalLine2,
          discountsSnapshot: [],
          optionsSnapshot: { size: 'Standard' },
        });
      }

      const shippingPaise = subtotalPaise > 300000 ? 0 : 15000; // Free shipping over ₹3,000
      const totalPaise = subtotalPaise + shippingPaise;

      // Check if order already exists
      const existingOrder = await db.order.findUnique({ where: { orderNumber } });
      if (existingOrder) {
        continue;
      }

      // Create Order
      const createdOrder = await db.order.create({
        data: {
          orderNumber,
          checkoutKey,
          customerId: customer.id,
          email: customer.email,
          phone: customer.phone,
          currency: 'INR',
          deliveryAddress: customer.address,
          status: spec.status,
          subtotalPaise,
          discountPaise: 0,
          shippingPaise,
          taxPaise: Math.round(subtotalPaise * 0.18),
          giftFeePaise: 0,
          totalPaise,
          createdAt: orderDate,
          updatedAt: orderDate,
          lines: {
            create: lineData,
          },
        },
        include: { lines: true },
      });
      orderCount++;

      if (spec.status === 'DELIVERED') {
        deliveredOrdersWithProducts.push({
          customerId: customer.id,
          productId: item1.product.id,
        });
      }

      // Order Status History
      await db.orderStatusHistory.create({
        data: {
          orderId: createdOrder.id,
          adminId: adminUser.id,
          previousStatus: 'NEW',
          status: spec.status,
          action: spec.status === 'NEW' ? 'create' : spec.status.toLowerCase(),
          createdAt: orderDate,
        },
      });

      // Shipment for SHIPPED and DELIVERED
      if (['SHIPPED', 'DELIVERED'].includes(spec.status)) {
        const carrier = (i % 2 === 0) ? 'Blue Dart Express' : 'Delhivery Logistics';
        const trackingNumber = `TRK${Date.now().toString().slice(-6)}${100 + i}`;
        const shipment = await db.shipment.create({
          data: {
            orderId: createdOrder.id,
            carrier,
            trackingNumber,
            status: spec.status,
            dispatchedAt: new Date(orderDate.getTime() + 18 * 3600000),
            deliveredAt: spec.status === 'DELIVERED' ? new Date(orderDate.getTime() + 65 * 3600000) : null,
          },
        });

        for (const line of createdOrder.lines) {
          await db.shipmentLine.create({
            data: {
              shipmentId: shipment.id,
              orderLineId: line.id,
              orderId: createdOrder.id,
              quantity: line.quantity,
            },
          });
        }
      }

      // Payment Attempt
      const paymentDate = new Date(orderDate.getTime() + 120000); // 2 minutes after order
      const payment = await db.paymentAttempt.create({
        data: {
          orderId: createdOrder.id,
          provider: 'RAZORPAY',
          providerAccount: 'default',
          idempotencyKey: `idemp_${createdOrder.id}`,
          providerPaymentId: `pay_${Date.now().toString(36)}_${i}`,
          providerOrderId: `order_rzp_${Date.now().toString(36)}_${i}`,
          amountPaise: totalPaise,
          currency: 'INR',
          status: spec.paymentStatus,
          failureCode: spec.paymentStatus === 'FAILED' ? 'BAD_REQUEST_PAYMENT_DECLINED' : null,
          createdAt: paymentDate,
          updatedAt: paymentDate,
        },
      });
      paymentCount++;

      // Partial or full refund where specified
      if (spec.paymentStatus === 'PARTIALLY_REFUNDED') {
        const refundAmount = Math.round(totalPaise * 0.4);
        await db.refund.create({
          data: {
            paymentId: payment.id,
            provider: 'RAZORPAY',
            providerAccount: 'default',
            idempotencyKey: `rfnd_idemp_${createdOrder.id}`,
            providerRefundId: `rfnd_${Date.now().toString(36)}_${i}`,
            amountPaise: refundAmount,
            status: 'SUCCEEDED',
            reason: 'Customer reported minor cosmetic imperfection on one item; goodwill discount granted.',
            createdAt: new Date(paymentDate.getTime() + 86400000),
            updatedAt: new Date(paymentDate.getTime() + 86400000),
          },
        });
        refundCount++;
      } else if (spec.paymentStatus === 'REFUNDED') {
        await db.refund.create({
          data: {
            paymentId: payment.id,
            provider: 'RAZORPAY',
            providerAccount: 'default',
            idempotencyKey: `rfnd_idemp_${createdOrder.id}`,
            providerRefundId: `rfnd_${Date.now().toString(36)}_${i}`,
            amountPaise: totalPaise,
            status: 'SUCCEEDED',
            reason: 'Order cancelled by customer prior to warehouse dispatch.',
            createdAt: new Date(paymentDate.getTime() + 3600000),
            updatedAt: new Date(paymentDate.getTime() + 3600000),
          },
        });
        refundCount++;
      }
    }
    console.log(`Created ${orderCount} orders, ${paymentCount} payment attempts, and ${refundCount} refunds.`);

    // 5. Seed Reviews across products
    let reviewCount = 0;
    const existingReviewsCount = await db.review.count();

    if (existingReviewsCount < 10) {
      for (let i = 0; i < sampleReviewTexts.length; i++) {
        const sample = sampleReviewTexts[i];
        const customer = seededCustomers[i % seededCustomers.length];
        const product = allProducts[i % allProducts.length];
        const reviewDate = new Date(now - (i * 2 + 1) * 86400000);

        // First 3 reviews PENDING (shows in admin attention alert!)
        // Review 4 is REJECTED
        // Rest are APPROVED
        let moderationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' = 'APPROVED';
        let storeReply: string | null = null;
        let repliedAt: Date | null = null;
        let repliedById: string | null = null;
        let moderationReason: string | null = null;

        if (i < 3) {
          moderationStatus = 'PENDING';
        } else if (i === 10) {
          moderationStatus = 'REJECTED';
          moderationReason = 'Contains competitor pricing claims';
        } else {
          moderationStatus = 'APPROVED';
          if (i % 3 === 0) {
            storeReply = 'Thank you for your delightful review! We are passionate about quality and so glad it brought joy to your space.';
            repliedAt = new Date(reviewDate.getTime() + 12 * 3600000);
            repliedById = adminUser.id;
          }
        }

        const review = await db.review.create({
          data: {
            productId: product.id,
            customerId: customer.id,
            rating: sample.rating,
            title: sample.title,
            body: sample.body,
            moderationStatus,
            moderationVersion: moderationStatus === 'APPROVED' ? 1 : 0,
            moderationReason,
            storeReply,
            repliedAt,
            repliedById,
            createdAt: reviewDate,
            updatedAt: reviewDate,
          },
        });
        reviewCount++;

        // Add history for approved / rejected reviews
        if (moderationStatus !== 'PENDING') {
          await db.reviewModerationHistory.create({
            data: {
              reviewId: review.id,
              adminId: adminUser.id,
              action: moderationStatus === 'APPROVED' ? 'approve' : 'reject',
              previousStatus: 'PENDING',
              status: moderationStatus,
              reason: moderationReason,
              createdAt: new Date(reviewDate.getTime() + 3600000),
            },
          });
        }
      }
      console.log(`Created ${reviewCount} customer reviews (including pending attention, approved, and replied).`);
    } else {
      console.log(`Reviews already seeded (${existingReviewsCount} present).`);
    }

    console.log('--- Admin Dashboard Dummy Data Seeding Complete! ---');
  } finally {
    await db.$disconnect();
  }
}

void main().catch(error => {
  console.error('Seeding failed:', error);
  process.exitCode = 1;
});
