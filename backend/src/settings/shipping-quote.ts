import type { PinCodeServiceability, ShippingRule } from '../../generated/prisma/client';

export type QuoteLine = {
  productId: string; variantId: string; name: string; quantity: number;
  categoryIds: string[]; weightGrams: number | null; lengthMm: number | null;
  widthMm: number | null; heightMm: number | null; isFragile: boolean; isBulky: boolean;
};
export type QuotePolicy = { thresholdBasis: string; waiveHandlingOnFree: boolean };
export type Merchandise = { originalMerchandisePaise: number; merchandisePaise: number; automaticPaise: number; couponPaise: number };
type Match = ShippingRule & { rank: number };
const measured = (value: number | null, min: number | null, max: number | null) => (min === null && max === null) || (value !== null && (min === null || value >= min) && (max === null || value <= max));
export function ruleMatches(rule: ShippingRule, line: QuoteLine, pin: string) {
  return rule.enabled && !rule.state && (!rule.pinCode || rule.pinCode === pin) && (!rule.productId || rule.productId === line.productId) &&
    (!rule.categoryId || line.categoryIds.includes(rule.categoryId)) &&
    measured(line.weightGrams, rule.minWeightGrams, rule.maxWeightGrams) &&
    measured(line.lengthMm, rule.minLengthMm, rule.maxLengthMm) &&
    measured(line.widthMm, rule.minWidthMm, rule.maxWidthMm) &&
    measured(line.heightMm, rule.minHeightMm, rule.maxHeightMm);
}
const rank = (rule: ShippingRule) => rule.productId ? 3 : rule.categoryId ? 2 : rule.pinCode ? 1 : 0;
const first = <K extends keyof ShippingRule>(rules: Match[], key: K): ShippingRule[K] | null => rules.find(rule => rule[key] !== null)?.[key] ?? null;
const unavailable = (pin: string, reason: string, coverageRule: string) => ({ available: false, priced: false, pinCode: pin, coverageRule, reason, currency: 'INR' as const });

export function evaluateShipping(input: { pinCode: string; coverage: PinCodeServiceability | null; rules: ShippingRule[]; lines: QuoteLine[]; merchandise: Merchandise; policy: QuotePolicy }) {
  const { pinCode: pin, coverage, rules, lines, merchandise, policy } = input;
  if (!coverage || !coverage.enabled) return unavailable(pin, 'Delivery is unavailable because this PIN is not on the supported list.', 'Unlisted PINs are unavailable');
  if (!coverage.supported) return unavailable(pin, `Delivery is unavailable because PIN ${pin} is restricted${coverage.reason ? `: ${coverage.reason}` : '.'}`, 'Explicit restriction');
  const qualifyingSubtotalPaise = policy.thresholdBasis === 'BEFORE_DISCOUNTS' ? merchandise.originalMerchandisePaise : merchandise.merchandisePaise;
  const storeRules = rules.filter(rule => rule.enabled && !rule.productId && !rule.categoryId && !rule.pinCode);
  const threshold = storeRules.find(rule => rule.freeShippingThresholdPaise !== null)?.freeShippingThresholdPaise ?? null;
  const thresholdMet = threshold !== null && qualifyingSubtotalPaise >= threshold;
  let baseChargePaise = 0, handlingChargePaise = 0, itemWaivedPaise = 0;
  const lineBreakdown: { name: string; quantity: number; basePaise: number; handlingPaise: number; waivedPaise: number; ruleNames: string[] }[] = [];
  const missing: string[] = [];
  let dispatchMinDays = coverage.dispatchMinDays, dispatchMaxDays = coverage.dispatchMaxDays;
  let deliveryMinDays = coverage.deliveryMinDays, deliveryMaxDays = coverage.deliveryMaxDays;
  for (const line of lines) {
    const matches = rules.filter(rule => ruleMatches(rule, line, pin)).map(rule => Object.assign(rule, { rank: rank(rule) }) as Match).sort((a, b) => b.rank - a.rank || (b.pinCode ? 1 : 0) - (a.pinCode ? 1 : 0) || a.id.localeCompare(b.id));
    if (matches.length > 1 && matches[0].rank === matches[1].rank && matches[0].pinCode === matches[1].pinCode) {
      return unavailable(pin, `Shipping rules conflict for ${line.name}. Disable or narrow one matching rule.`, 'Conflicting rates');
    }
    const included = first(matches, 'shippingIncluded') === true || first(matches, 'freeShipping') === true;
    const rawBase = first(matches, 'baseChargePaise');
    if (!included && rawBase === null) { missing.push(line.name); continue; }
    const base = included ? 0 : Number(rawBase);
    const fragile = line.isFragile ? Number(first(matches, 'fragileChargePaise') ?? 0) : 0;
    const bulky = line.isBulky ? Number(first(matches, 'bulkyChargePaise') ?? 0) : 0;
    const handling = Math.max(fragile, bulky) * line.quantity;
    baseChargePaise = Math.max(baseChargePaise, base);
    handlingChargePaise += handling;
    itemWaivedPaise += included ? Number(rawBase ?? 0) : 0;
    dispatchMinDays ??= first(matches, 'dispatchMinDays'); dispatchMaxDays ??= first(matches, 'dispatchMaxDays');
    deliveryMinDays ??= first(matches, 'deliveryMinDays'); deliveryMaxDays ??= first(matches, 'deliveryMaxDays');
    lineBreakdown.push({ name: line.name, quantity: line.quantity, basePaise: base, handlingPaise: handling, waivedPaise: included ? Number(rawBase ?? 0) : 0, ruleNames: matches.map(rule => rule.name) });
  }
  if (missing.length) return { ...unavailable(pin, `Delivery is supported, but no base rate can price ${missing.join(', ')}. Configure a default or matching rate.`, 'Supported PIN'), available: true, missingMeasurementsOrRate: missing };
  const waivedBasePaise = thresholdMet ? baseChargePaise : 0;
  const waivedHandlingPaise = thresholdMet && policy.waiveHandlingOnFree ? handlingChargePaise : 0;
  const finalChargePaise = baseChargePaise + handlingChargePaise - waivedBasePaise - waivedHandlingPaise;
  const reason = thresholdMet ? `Base delivery waived because the ${policy.thresholdBasis === 'BEFORE_DISCOUNTS' ? 'pre-discount' : 'post-discount'} merchandise subtotal reached the free-delivery threshold.${policy.waiveHandlingOnFree ? ' Handling is waived too.' : ' Eligible handling charges remain.'}` : 'Delivery is available; charges follow the saved matching rules.';
  return { available: true, priced: true, pinCode: pin, coverageRule: 'Supported PIN', reason, currency: 'INR' as const, qualifyingSubtotalPaise, thresholdPaise: threshold, thresholdBasis: policy.thresholdBasis, baseChargePaise, handlingChargePaise, waivedBasePaise, waivedHandlingPaise, itemWaivedPaise, finalChargePaise, merchandise, lineBreakdown, estimate: { dispatchMinDays, dispatchMaxDays, deliveryMinDays, deliveryMaxDays }, source: 'saved rules' };
}
