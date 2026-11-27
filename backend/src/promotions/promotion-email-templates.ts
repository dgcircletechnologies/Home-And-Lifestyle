export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

export const formatInr = (paise: number): string => {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
};

export const formatIstExpiry = (date: Date): string => {
  try {
    const formatted = date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return `${formatted} IST`;
  } catch {
    return `${date.toISOString().slice(0, 10)} UTC`;
  }
};

export const toAbsoluteUrl = (url: string | null | undefined, frontendUrl: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = frontendUrl.replace(/\/+$/, '');
  const path = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${base}${path}`;
};

export interface CategoryPromotionProductItem {
  name: string;
  slug: string;
  imageUrl?: string | null;
  originalPricePaise: number;
  discountedPricePaise: number;
}

export interface CategoryPromotionEmailData {
  storeName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  frontendUrl: string;
  customerName: string;
  promotionName: string;
  discountBadge: string;
  savingsLabel?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  category: {
    name: string;
    slug: string;
    imageUrl?: string | null;
    description?: string | null;
  };
  products: CategoryPromotionProductItem[];
}

export interface ProductPromotionEmailData {
  storeName: string;
  supportEmail?: string | null;
  supportPhone?: string | null;
  frontendUrl: string;
  customerName: string;
  promotionName: string;
  discountBadge: string;
  savingsLabel?: string | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  product: {
    name: string;
    slug: string;
    imageUrl?: string | null;
    description?: string | null;
    isMultiVariant?: boolean;
    minOriginalPricePaise: number;
    minDiscountedPricePaise: number;
  };
}

const sharedEmailHead = (subject: string) => `
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    *, *:before, *:after { box-sizing: border-box !important; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; min-width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table { border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    td, th { word-break: break-word; overflow-wrap: anywhere; }
    img { border: 0; outline: none; text-decoration: none; display: block; max-width: 100%; }
    @media only screen and (max-width: 600px) {
      .email-headline { font-size: 19px !important; line-height: 1.3 !important; }
      .email-card { width: 100% !important; max-width: 100% !important; border-radius: 8px !important; }
      .email-outer-td { padding: 12px 8px 32px !important; }
      .email-header-td { padding: 16px 16px 12px !important; }
      .email-hero-td { padding: 20px 16px !important; }
      .email-body-td { padding: 20px 16px !important; }
      .email-footer-td { padding: 16px 16px !important; }
      .mobile-full-width { display: block !important; width: 100% !important; }
      .mobile-btn { display: block !important; width: 100% !important; text-align: center !important; padding: 10px 16px !important; }
      .mobile-product-card { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
    }
  </style>
</head>`;

/**
 * 1. Category Promotion Email
 */
export function categoryPromotionEmail(data: CategoryPromotionEmailData): { subject: string; text: string; html: string } {
  const storeName = data.storeName.trim() || 'Home & Lifestyle';
  const firstName = data.customerName.trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const categoryUrl = toAbsoluteUrl(`/categories/${data.category.slug}`, data.frontendUrl);
  const categoryImageUrl = toAbsoluteUrl(data.category.imageUrl, data.frontendUrl);
  const expiryFormatted = data.endsAt ? formatIstExpiry(data.endsAt) : null;
  const subject = `${data.discountBadge} on ${data.category.name} | ${storeName}`;

  // Plain text fallback
  const textLines: string[] = [
    greeting,
    '',
    `Special Offer: ${data.discountBadge} on ${data.category.name}`,
    ...(data.category.description ? [data.category.description, ''] : []),
    ...(expiryFormatted ? [`Offer valid until: ${expiryFormatted}`, ''] : []),
    `Shop the category: ${categoryUrl}`,
    '',
  ];

  if (data.products.length > 0) {
    textLines.push('Featured Pieces on Offer:');
    for (const item of data.products) {
      const orig = formatInr(item.originalPricePaise);
      const disc = formatInr(item.discountedPricePaise);
      const itemUrl = toAbsoluteUrl(`/products/${item.slug}`, data.frontendUrl);
      textLines.push(`- ${item.name}: Now ${disc} (Was ${orig}) -> ${itemUrl}`);
    }
    textLines.push('');
  }

  if (data.supportEmail || data.supportPhone) {
    textLines.push('Need help? Contact our support team:');
    if (data.supportEmail) textLines.push(`Email: ${data.supportEmail}`);
    if (data.supportPhone) textLines.push(`Phone: ${data.supportPhone}`);
    textLines.push('');
  }
  textLines.push(`You received this email because you are a verified customer of ${storeName}.`);

  // HTML Product items
  const productCardsHtml = data.products.map(item => {
    const orig = formatInr(item.originalPricePaise);
    const disc = formatInr(item.discountedPricePaise);
    const itemUrl = toAbsoluteUrl(`/products/${item.slug}`, data.frontendUrl);
    const itemImg = toAbsoluteUrl(item.imageUrl, data.frontendUrl);
    const savingPaise = Math.max(0, item.originalPricePaise - item.discountedPricePaise);
    const savingLabel = savingPaise > 0 ? `Save ${formatInr(savingPaise)}` : null;

    return `
      <tr>
        <td style="padding: 12px; background-color: #fdfbf7; border: 1px solid #e7ded4; border-radius: 12px; margin-bottom: 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: auto;">
            <tr>
              ${itemImg ? `
              <td width="88" valign="top" style="width: 88px; padding-right: 14px;">
                <a href="${escapeHtml(itemUrl)}" target="_blank" style="text-decoration: none; display: block;">
                  <img src="${escapeHtml(itemImg)}" alt="${escapeHtml(item.name)}" width="88" height="88" style="width: 88px; height: 88px; object-fit: cover; border-radius: 8px; border: 1px solid #ebd9c8;" />
                </a>
              </td>
              ` : ''}
              <td valign="middle" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                <a href="${escapeHtml(itemUrl)}" target="_blank" style="text-decoration: none; color: #1c1917; font-size: 13px; font-weight: 600; line-height: 1.4; display: block; margin-bottom: 6px;">
                  ${escapeHtml(item.name)}
                </a>
                <div style="font-size: 14px; line-height: 1.4;">
                  <span style="font-size: 14px; font-weight: 700; color: #28613a; font-variant-numeric: tabular-nums; margin-right: 8px;">${escapeHtml(disc)}</span>
                  ${orig !== disc ? `<span style="font-size: 13px; font-variant-numeric: tabular-nums; color: #78716c; text-decoration: line-through; margin-right: 8px;">${escapeHtml(orig)}</span>` : ''}
                  ${savingLabel ? `<span style="display: inline-block; font-size: 11px; font-weight: 700; color: #28613a; background-color: #eaf5ee; border: 1px solid #b8dfc4; padding: 2px 6px; border-radius: 4px;">${escapeHtml(savingLabel)}</span>` : ''}
                </div>
                <div style="margin-top: 8px;">
                  <a href="${escapeHtml(itemUrl)}" target="_blank" style="display: inline-block; font-size: 12px; font-weight: 700; color: #2a1215; text-decoration: underline;">
                    Shop Now &rarr;
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr><td height="10" style="font-size: 0; line-height: 0;">&nbsp;</td></tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
${sharedEmailHead(subject)}
<body style="margin: 0; padding: 0; background-color: #f7f4ee; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f4ee; width: 100%;">
    <tr>
      <td align="center" class="email-outer-td" style="padding: 24px 12px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e7ded4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(42, 18, 21, 0.05); text-align: left;">
          
          <!-- Brand Header -->
          <tr>
            <td class="email-header-td" style="padding: 24px 28px 18px; border-bottom: 1px solid #f0e9df; background-color: #faf7f2;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 700; color: #2a1215; letter-spacing: -0.01em;">
                      ${escapeHtml(storeName)}
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #28613a; background-color: #eaf5ee; border: 1px solid #b8dfc4; border-radius: 9999px; padding: 4px 10px;">
                      ${escapeHtml(data.discountBadge)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td class="email-hero-td" style="padding: 28px 28px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
              
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #8c531b;">
                Special Category Offer
              </p>
              
              <h1 class="email-headline" style="margin: 0 0 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 21px; line-height: 1.3; font-weight: 700; color: #2a1215;">
                ${escapeHtml(data.discountBadge)} on ${escapeHtml(data.category.name)}
              </h1>

              ${data.category.description ? `
              <p style="margin: 0 auto 16px; max-width: 480px; font-size: 14px; line-height: 1.5; color: #57534e;">
                ${escapeHtml(data.category.description)}
              </p>
              ` : ''}

              ${expiryFormatted ? `
              <p style="margin: 0 0 20px; font-size: 13px; font-weight: 600; color: #8c531b;">
                ⏰ Offer ends on <span style="text-decoration: underline;">${escapeHtml(expiryFormatted)}</span>
              </p>
              ` : ''}

              ${categoryImageUrl ? `
              <div style="margin: 0 0 20px; border-radius: 12px; overflow: hidden; border: 1px solid #ebd9c8;">
                <a href="${escapeHtml(categoryUrl)}" target="_blank" style="text-decoration: none; display: block;">
                  <img src="${escapeHtml(categoryImageUrl)}" alt="${escapeHtml(data.category.name)}" width="544" style="width: 100%; max-height: 260px; object-fit: cover; display: block;" />
                </a>
              </div>
              ` : ''}

              <!-- Primary CTA -->
              <div style="margin: 20px 0 10px;">
                <a href="${escapeHtml(categoryUrl)}" target="_blank" class="mobile-btn" style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #ffffff; background-color: #2a1215; text-decoration: none; border-radius: 10px; padding: 10px 20px; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(42, 18, 21, 0.2);">
                  Shop ${escapeHtml(data.category.name)} &rarr;
                </a>
              </div>
            </td>
          </tr>

          ${data.products.length > 0 ? `
          <!-- Product Showcase -->
          <tr>
            <td class="email-body-td" style="padding: 10px 28px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
              <div style="border-top: 1px solid #f0e9df; padding-top: 24px; margin-bottom: 16px;">
                <h2 style="margin: 0 0 14px; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: 700; color: #2a1215;">
                  Featured Pieces in this Collection
                </h2>
              </div>
              
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout: fixed; width: 100%;">
                ${productCardsHtml}
              </table>

              <div style="text-align: center; margin-top: 16px;">
                <a href="${escapeHtml(categoryUrl)}" target="_blank" class="mobile-btn" style="display: inline-block; font-size: 14px; font-weight: 700; color: #2a1215; background-color: #f7f4ee; border: 1px solid #dfd6c8; text-decoration: none; border-radius: 8px; padding: 10px 20px;">
                  View All Pieces in ${escapeHtml(data.category.name)} &rarr;
                </a>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td class="email-footer-td" style="padding: 24px 28px; background-color: #faf7f2; border-top: 1px solid #f0e9df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: #78716c;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #44403c;">
                ${escapeHtml(storeName)}
              </p>
              ${data.supportEmail || data.supportPhone ? `
              <p style="margin: 0 0 10px;">
                Questions? Reach out to us at 
                ${data.supportEmail ? `<a href="mailto:${escapeHtml(data.supportEmail)}" style="color: #2a1215; text-decoration: underline;">${escapeHtml(data.supportEmail)}</a>` : ''}
                ${data.supportEmail && data.supportPhone ? ' or ' : ''}
                ${data.supportPhone ? `<span style="color: #2a1215; font-weight: 500;">${escapeHtml(data.supportPhone)}</span>` : ''}
              </p>
              ` : ''}
              <p style="margin: 0; font-size: 11px; color: #a8a29e;">
                You received this exclusive update because you are an active, verified customer of ${escapeHtml(storeName)}. Prices and discounts are in INR and subject to availability.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text: textLines.join('\n'), html };
}

/**
 * 2. Product Promotion Email
 */
export function productPromotionEmail(data: ProductPromotionEmailData): { subject: string; text: string; html: string } {
  const storeName = data.storeName.trim() || 'Home & Lifestyle';
  const firstName = data.customerName.trim().split(/\s+/)[0] || '';
  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const productUrl = toAbsoluteUrl(`/products/${data.product.slug}`, data.frontendUrl);
  const productImageUrl = toAbsoluteUrl(data.product.imageUrl, data.frontendUrl);
  const expiryFormatted = data.endsAt ? formatIstExpiry(data.endsAt) : null;
  const subject = `${data.discountBadge} on ${data.product.name} | ${storeName}`;

  const origPrice = formatInr(data.product.minOriginalPricePaise);
  const discPrice = formatInr(data.product.minDiscountedPricePaise);
  const prefix = data.product.isMultiVariant ? 'Starts from ' : '';
  const savingPaise = Math.max(0, data.product.minOriginalPricePaise - data.product.minDiscountedPricePaise);
  const savingsLabel = savingPaise > 0 ? `Save ${formatInr(savingPaise)}` : null;

  // Plain text fallback
  const textLines: string[] = [
    greeting,
    '',
    `Special Offer: ${data.discountBadge} on ${data.product.name}`,
    ...(data.product.description ? [data.product.description, ''] : []),
    `Price: ${prefix}${discPrice} (Was ${origPrice})`,
    ...(savingsLabel ? [savingsLabel] : []),
    ...(expiryFormatted ? [`Offer valid until: ${expiryFormatted}`, ''] : []),
    `Shop this deal: ${productUrl}`,
    '',
  ];

  if (data.supportEmail || data.supportPhone) {
    textLines.push('Need help? Contact our support team:');
    if (data.supportEmail) textLines.push(`Email: ${data.supportEmail}`);
    if (data.supportPhone) textLines.push(`Phone: ${data.supportPhone}`);
    textLines.push('');
  }
  textLines.push(`You received this email because you are a verified customer of ${storeName}.`);

  const html = `<!DOCTYPE html>
<html lang="en">
${sharedEmailHead(subject)}
<body style="margin: 0; padding: 0; background-color: #f7f4ee; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f7f4ee; width: 100%;">
    <tr>
      <td align="center" class="email-outer-td" style="padding: 24px 12px 48px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-card" style="width: 100%; max-width: 600px; background-color: #ffffff; border: 1px solid #e7ded4; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(42, 18, 21, 0.05); text-align: left;">
          
          <!-- Brand Header -->
          <tr>
            <td class="email-header-td" style="padding: 24px 28px 18px; border-bottom: 1px solid #f0e9df; background-color: #faf7f2;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 17px; font-weight: 700; color: #2a1215; letter-spacing: -0.01em;">
                      ${escapeHtml(storeName)}
                    </span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #28613a; background-color: #eaf5ee; border: 1px solid #b8dfc4; border-radius: 9999px; padding: 4px 10px;">
                      ${escapeHtml(data.discountBadge)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Hero Section -->
          <tr>
            <td class="email-hero-td" style="padding: 28px 28px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
              
              <p style="margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #8c531b;">
                Spotlight Deal
              </p>
              
              <h1 class="email-headline" style="margin: 0 0 12px; font-family: Georgia, 'Times New Roman', serif; font-size: 21px; line-height: 1.3; font-weight: 700; color: #2a1215;">
                ${escapeHtml(data.product.name)}
              </h1>

              ${data.product.description ? `
              <p style="margin: 0 auto 16px; max-width: 480px; font-size: 14px; line-height: 1.5; color: #57534e;">
                ${escapeHtml(data.product.description)}
              </p>
              ` : ''}

              ${productImageUrl ? `
              <div style="margin: 0 auto 20px; max-width: 480px; border-radius: 12px; overflow: hidden; border: 1px solid #ebd9c8;">
                <a href="${escapeHtml(productUrl)}" target="_blank" style="text-decoration: none; display: block;">
                  <img src="${escapeHtml(productImageUrl)}" alt="${escapeHtml(data.product.name)}" width="480" style="width: 100%; max-height: 340px; object-fit: cover; display: block;" />
                </a>
              </div>
              ` : ''}

              <!-- Price Box -->
              <div style="display: inline-block; background-color: #fdfbf7; border: 1px solid #e7ded4; border-radius: 12px; padding: 14px 20px; margin-bottom: 20px;">
                <div style="font-size: 13px; font-weight: 600; color: #78716c; margin-bottom: 4px;">
                  ${escapeHtml(prefix)}Current Price
                </div>
                <div style="font-size: 18px; font-weight: 700; color: #28613a; font-variant-numeric: tabular-nums; line-height: 1.3;">
                  ${escapeHtml(discPrice)}
                  ${origPrice !== discPrice ? `<span style="font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; color: #78716c; text-decoration: line-through; margin-left: 10px;">${escapeHtml(origPrice)}</span>` : ''}
                </div>
                ${savingsLabel ? `
                <div style="margin-top: 6px;">
                  <span style="display: inline-block; font-size: 12px; font-weight: 700; color: #28613a; background-color: #eaf5ee; border: 1px solid #b8dfc4; padding: 3px 8px; border-radius: 4px;">
                    ${escapeHtml(savingsLabel)} (${escapeHtml(data.discountBadge)})
                  </span>
                </div>
                ` : ''}
              </div>

              ${expiryFormatted ? `
              <p style="margin: 0 0 20px; font-size: 13px; font-weight: 600; color: #8c531b;">
                ⏰ Limited time offer: Ends on <span style="text-decoration: underline;">${escapeHtml(expiryFormatted)}</span>
              </p>
              ` : ''}

              <!-- CTA Button -->
              <div style="margin: 10px 0 10px;">
                <a href="${escapeHtml(productUrl)}" target="_blank" class="mobile-btn" style="display: inline-block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; font-weight: 700; color: #ffffff; background-color: #2a1215; text-decoration: none; border-radius: 10px; padding: 10px 20px; letter-spacing: 0.02em; box-shadow: 0 2px 8px rgba(42, 18, 21, 0.2);">
                  Shop This Deal &rarr;
                </a>
              </div>
            </td>
          </tr>

          <!-- Reassurance Strip -->
          <tr>
            <td style="padding: 16px 28px; background-color: #faf7f2; border-top: 1px solid #f0e9df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="font-size: 13px; color: #57534e; line-height: 1.5;">
                    ✨ <strong>Curated for living</strong> &nbsp;&bull;&nbsp; 📦 <strong>Safe doorstep delivery across India</strong>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="email-footer-td" style="padding: 24px 28px; background-color: #faf7f2; border-top: 1px solid #f0e9df; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: #78716c;">
              <p style="margin: 0 0 8px; font-weight: 600; color: #44403c;">
                ${escapeHtml(storeName)}
              </p>
              ${data.supportEmail || data.supportPhone ? `
              <p style="margin: 0 0 10px;">
                Questions? Reach out to us at 
                ${data.supportEmail ? `<a href="mailto:${escapeHtml(data.supportEmail)}" style="color: #2a1215; text-decoration: underline;">${escapeHtml(data.supportEmail)}</a>` : ''}
                ${data.supportEmail && data.supportPhone ? ' or ' : ''}
                ${data.supportPhone ? `<span style="color: #2a1215; font-weight: 500;">${escapeHtml(data.supportPhone)}</span>` : ''}
              </p>
              ` : ''}
              <p style="margin: 0; font-size: 11px; color: #a8a29e;">
                You received this exclusive update because you are an active, verified customer of ${escapeHtml(storeName)}. Prices and discounts are in INR and subject to availability.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text: textLines.join('\n'), html };
}
