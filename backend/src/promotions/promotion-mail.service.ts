import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { authConfig } from '../auth/config';
import { PrismaService } from '../prisma.service';
import { categoryVisibility, branchIds } from '../categories/category-visibility';
import {
  categoryPromotionEmail,
  productPromotionEmail,
  type CategoryPromotionProductItem,
} from './promotion-email-templates';

const calculateSavings = (
  kind: string,
  amountPaise: number | null | undefined,
  percentBasisPoints: number | null | undefined,
  pricePaise: number,
): number => {
  if (kind === 'FIXED') {
    return Math.min(pricePaise, amountPaise ?? 0);
  }
  return Math.min(pricePaise, Math.floor((pricePaise * (percentBasisPoints ?? 0) + 5000) / 10000));
};

const discountBadgeText = (
  kind: string,
  amountPaise: number | null | undefined,
  percentBasisPoints: number | null | undefined,
): string => {
  if (kind === 'FIXED') {
    const rs = Math.round((amountPaise ?? 0) / 100);
    return `FLAT ₹${rs} OFF`;
  }
  const pct = (percentBasisPoints ?? 0) / 100;
  const formattedPct = percentBasisPoints && percentBasisPoints % 100 !== 0 ? pct.toFixed(2) : pct.toFixed(0);
  return `${formattedPct}% OFF`;
};

@Injectable()
export class PromotionMailService {
  private readonly logger = new Logger(PromotionMailService.name);

  constructor(private readonly db: PrismaService) {}

  /**
   * Count active, email-verified customers eligible for campaigns.
   */
  async countVerifiedCustomers(): Promise<number> {
    try {
      return await this.db.user.count({
        where: {
          role: 'CUSTOMER',
          emailVerifiedAt: { not: null },
          disabledAt: null,
          deletedAt: null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to count verified customers: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /**
   * Retrieve list of verified customers for campaign targeting.
   */
  async getVerifiedCustomers(): Promise<Array<{ id: string; email: string; name: string | null }>> {
    try {
      const users = await this.db.user.findMany({
        where: {
          role: 'CUSTOMER',
          emailVerifiedAt: { not: null },
          disabledAt: null,
          deletedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      });

      return users.filter(u => u.email && typeof u.email === 'string' && u.email.includes('@') && u.email.includes('.'));
    } catch (error) {
      this.logger.error(`Failed to fetch verified customers: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  }

  /**
   * Send a promotion campaign to all active verified customers.
   * Runs in batches of 5–10 with non-blocking error isolation.
   */
  async sendPromotionCampaign(
    promotionId: string,
  ): Promise<{ targetedCount: number; sentCount: number; failedCount: number }> {
    let config: ReturnType<typeof authConfig>;
    try {
      config = authConfig();
    } catch (err) {
      this.logger.warn(`Auth/Mail config invalid: ${err instanceof Error ? err.message : String(err)}. Campaign aborted.`);
      return { targetedCount: 0, sentCount: 0, failedCount: 0 };
    }

    const promotion = await this.db.promotion.findUnique({
      where: { id: promotionId },
      include: {
        category: true,
        product: {
          include: {
            images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1 },
            variants: { orderBy: { pricePaise: 'asc' } },
          },
        },
      },
    });

    if (!promotion) {
      this.logger.warn(`Promotion ${promotionId} not found. Campaign aborted.`);
      return { targetedCount: 0, sentCount: 0, failedCount: 0 };
    }

    if (!promotion.categoryId && !promotion.productId) {
      this.logger.warn(`Promotion ${promotionId} is neither Category nor Product offer. Campaign aborted.`);
      return { targetedCount: 0, sentCount: 0, failedCount: 0 };
    }

    const customers = await this.getVerifiedCustomers();
    if (customers.length === 0) {
      this.logger.log(`No verified customers found for promotion campaign ${promotionId}.`);
      return { targetedCount: 0, sentCount: 0, failedCount: 0 };
    }

    // Check SMTP readiness
    const hasSmtp = Boolean(
      config.smtpHost &&
      config.smtpPort &&
      config.mailFrom &&
      Boolean(config.smtpUser) === Boolean(config.smtpPassword),
    );

    if (!hasSmtp) {
      this.logger.warn(
        `SMTP configuration is incomplete. Skipping actual email delivery for promotion ${promotionId} to ${customers.length} verified customers.`,
      );
      // Still update lastSharedAt and lastSharedCount to avoid stuck state
      try {
        await this.db.promotion.update({
          where: { id: promotionId },
          data: {
            lastSharedAt: new Date(),
            lastSharedCount: 0,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed to update promotion share metadata: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { targetedCount: customers.length, sentCount: 0, failedCount: customers.length };
    }

    const storeSettings = await this.db.storeSettings.findUnique({
      where: { id: 'store' },
      select: { storeName: true, supportEmail: true, supportPhone: true },
    }).catch(() => null);

    const storeName = storeSettings?.storeName || config.storeName || 'Home & Lifestyle';
    const supportEmail = storeSettings?.supportEmail || undefined;
    const supportPhone = storeSettings?.supportPhone || undefined;
    const frontendUrl = config.frontend;
    const discountBadge = discountBadgeText(promotion.kind, promotion.amountPaise, promotion.percentBasisPoints);

    let transport: ReturnType<typeof nodemailer.createTransport> | undefined;
    try {
      transport = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        requireTLS: !config.smtpSecure,
        auth: config.smtpUser ? { user: config.smtpUser, pass: config.smtpPassword } : undefined,
        connectionTimeout: 4000,
        greetingTimeout: 4000,
        socketTimeout: 6000,
        logger: false,
        debug: false,
      });
    } catch (err) {
      this.logger.error(`Failed to create SMTP transport: ${err instanceof Error ? err.message : String(err)}`);
      return { targetedCount: customers.length, sentCount: 0, failedCount: customers.length };
    }

    let sentCount = 0;
    let failedCount = 0;

    try {
      // 1. Prepare Category Email Template Data if category discount
      if (promotion.categoryId && promotion.category) {
        const category = promotion.category;
        const tree = await categoryVisibility(this.db);
        const categoryIds = branchIds(tree, category.id);

        const publishedProducts = await this.db.product.findMany({
          where: {
            status: 'PUBLISHED',
            categories: { some: { categoryId: { in: categoryIds } } },
            variants: { some: {} },
          },
          select: {
            id: true,
            name: true,
            slug: true,
            images: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: 1, select: { url: true } },
            variants: { select: { pricePaise: true }, orderBy: { pricePaise: 'asc' } },
          },
          take: 6,
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        });

        const showcaseProducts: CategoryPromotionProductItem[] = publishedProducts.map(p => {
          const originalPricePaise = p.variants[0]?.pricePaise ?? 0;
          const saving = calculateSavings(promotion.kind, promotion.amountPaise, promotion.percentBasisPoints, originalPricePaise);
          const discountedPricePaise = Math.max(0, originalPricePaise - saving);
          return {
            name: p.name,
            slug: p.slug,
            imageUrl: p.images[0]?.url ?? null,
            originalPricePaise,
            discountedPricePaise,
          };
        });

        // Batch sending to customers
        const batchSize = 10;
        for (let i = 0; i < customers.length; i += batchSize) {
          const batch = customers.slice(i, i + batchSize);
          const promises = batch.map(async customer => {
            const emailData = categoryPromotionEmail({
              storeName,
              supportEmail,
              supportPhone,
              frontendUrl,
              customerName: customer.name || 'Valued Customer',
              promotionName: promotion.name,
              discountBadge,
              startsAt: promotion.startsAt,
              endsAt: promotion.endsAt,
              category: {
                name: category.name,
                slug: category.slug,
                imageUrl: category.imageUrl,
                description: category.description,
              },
              products: showcaseProducts,
            });

            try {
              const res = await transport!.sendMail({
                from: { name: storeName, address: config.mailFrom },
                to: customer.email,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                disableFileAccess: true,
                disableUrlAccess: true,
              });
              if (res.accepted && res.accepted.length > 0) {
                return true;
              }
              return false;
            } catch (err) {
              this.logger.warn(`Failed sending promotion email to ${customer.email}: ${err instanceof Error ? err.message : String(err)}`);
              return false;
            }
          });

          const results = await Promise.allSettled(promises);
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value === true) {
              sentCount++;
            } else {
              failedCount++;
            }
          }

          if (i + batchSize < customers.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      } else if (promotion.productId && promotion.product) {
        // 2. Prepare Product Email Template Data
        const product = promotion.product;
        const variants = product.variants;
        const minOriginalPricePaise = variants.length > 0 ? variants[0].pricePaise : 0;
        const saving = calculateSavings(promotion.kind, promotion.amountPaise, promotion.percentBasisPoints, minOriginalPricePaise);
        const minDiscountedPricePaise = Math.max(0, minOriginalPricePaise - saving);

        const batchSize = 10;
        for (let i = 0; i < customers.length; i += batchSize) {
          const batch = customers.slice(i, i + batchSize);
          const promises = batch.map(async customer => {
            const emailData = productPromotionEmail({
              storeName,
              supportEmail,
              supportPhone,
              frontendUrl,
              customerName: customer.name || 'Valued Customer',
              promotionName: promotion.name,
              discountBadge,
              startsAt: promotion.startsAt,
              endsAt: promotion.endsAt,
              product: {
                name: product.name,
                slug: product.slug,
                imageUrl: product.images[0]?.url ?? null,
                description: product.description,
                isMultiVariant: variants.length > 1,
                minOriginalPricePaise,
                minDiscountedPricePaise,
              },
            });

            try {
              const res = await transport!.sendMail({
                from: { name: storeName, address: config.mailFrom },
                to: customer.email,
                subject: emailData.subject,
                text: emailData.text,
                html: emailData.html,
                disableFileAccess: true,
                disableUrlAccess: true,
              });
              if (res.accepted && res.accepted.length > 0) {
                return true;
              }
              return false;
            } catch (err) {
              this.logger.warn(`Failed sending promotion email to ${customer.email}: ${err instanceof Error ? err.message : String(err)}`);
              return false;
            }
          });

          const results = await Promise.allSettled(promises);
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value === true) {
              sentCount++;
            } else {
              failedCount++;
            }
          }

          if (i + batchSize < customers.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

      this.logger.log(`Promotion campaign ${promotionId} completed: targeted=${customers.length}, sent=${sentCount}, failed=${failedCount}`);
    } finally {
      transport?.close();
    }

    try {
      await this.db.promotion.update({
        where: { id: promotionId },
        data: {
          lastSharedAt: new Date(),
          lastSharedCount: sentCount,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to update promotion ${promotionId} lastShared info: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { targetedCount: customers.length, sentCount, failedCount };
  }
}
