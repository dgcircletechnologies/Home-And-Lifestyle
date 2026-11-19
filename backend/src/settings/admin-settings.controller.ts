import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public, Roles } from '../auth/access';
import { emailSchema, parse } from '../auth/contracts';
import { AdminSettingsService } from './admin-settings.service';

const version = z.number().int().min(0);
const uuid = z.string().uuid();
const pin = z.string().regex(/^[1-9][0-9]{5}$/, 'Use a six-digit Indian PIN code.');
const paise = z.number().int().min(0).max(100_000_000);
const optionalNumber = z.number().int().min(0).max(1_000_000).nullable().default(null);
const days = z.number().int().min(0).max(365).nullable().default(null);
const store = z.object({ version, storeName: z.string().trim().min(1).max(100), supportEmail: emailSchema.nullable(), supportPhone: z.string().trim().regex(/^\+?[0-9()\s-]{7,25}$/).nullable() }).strict();
const gifting = z.object({ version, giftWrapDefaultEligible: z.boolean(), giftMessagesAvailable: z.boolean(), giftReceiptsAvailable: z.boolean(), giftWrapFeePaise: paise }).strict();
const shipping = z.object({ version, thresholdBasis: z.enum(['BEFORE_DISCOUNTS', 'AFTER_DISCOUNTS']), waiveHandlingOnFree: z.boolean() }).strict();
const pinBatch = z.object({ version, pinCodes: z.array(pin).min(1).max(100).refine(values => new Set(values).size === values.length, 'Remove duplicate PIN codes.'), supported: z.boolean(), enabled: z.boolean(), reason: z.string().trim().max(250).nullable().optional(), dispatchMinDays: days.optional(), dispatchMaxDays: days.optional(), deliveryMinDays: days.optional(), deliveryMaxDays: days.optional() }).strict();
const rule = z.object({
  name: z.string().trim().min(1).max(120), enabled: z.boolean(), pinCode: pin.nullable().default(null), productId: uuid.nullable().default(null), categoryId: uuid.nullable().default(null),
  minWeightGrams: optionalNumber, maxWeightGrams: optionalNumber, minLengthMm: optionalNumber, maxLengthMm: optionalNumber, minWidthMm: optionalNumber, maxWidthMm: optionalNumber, minHeightMm: optionalNumber, maxHeightMm: optionalNumber,
  baseChargePaise: paise.nullable().default(null), fragileChargePaise: paise.nullable().default(null), bulkyChargePaise: paise.nullable().default(null), freeShippingThresholdPaise: paise.nullable().default(null), shippingIncluded: z.boolean().nullable().default(null), freeShipping: z.boolean().nullable().default(null),
  dispatchMinDays: days, dispatchMaxDays: days, deliveryMinDays: days, deliveryMaxDays: days,
}).strict();
const ruleSave = z.object({ version, rule }).strict();
const remove = z.object({ version }).strict();
const list = z.object({ search: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).default(1) }).strict();
const pinList = list.extend({ state: z.enum(['supported', 'restricted', 'disabled']).optional() }).strict();
const quote = z.object({ pinCode: pin, items: z.array(z.object({ productId: uuid, variantId: uuid, quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(50), code: z.string().trim().max(40).optional() }).strict();

@Roles('ADMIN') @Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}
  @Get('store') store() { return this.settings.store(); }
  @Patch('store') updateStore(@Body() body: unknown) { return this.settings.updateStore(parse(store, body)); }
  @Get('shipping') shipping() { return this.settings.shipping(); }
  @Patch('shipping') updateShipping(@Body() body: unknown) { return this.settings.updateShipping(parse(shipping, body)); }
  @Get('shipping/pins') pins(@Query() query: unknown) { return this.settings.pins(parse(pinList, query)); }
  @Post('shipping/pins') savePins(@Body() body: unknown) { return this.settings.savePins(parse(pinBatch, body)); }
  @Delete('shipping/pins/:pinCode') removePin(@Param('pinCode') value: string, @Body() body: unknown) { return this.settings.removePin(parse(pin, value), parse(remove, body).version); }
  @Get('shipping/rules') rules(@Query() query: unknown) { return this.settings.rules(parse(list, query)); }
  @Post('shipping/rules') createRule(@Body() body: unknown) { return this.settings.saveRule(parse(ruleSave, body)); }
  @Patch('shipping/rules/:id') updateRule(@Param('id') id: string, @Body() body: unknown) { return this.settings.saveRule(parse(ruleSave, body), parse(uuid, id)); }
  @Delete('shipping/rules/:id') removeRule(@Param('id') id: string, @Body() body: unknown) { return this.settings.removeRule(parse(uuid, id), parse(remove, body).version); }
  @Post('shipping/quote') quote(@Body() body: unknown) { return this.settings.quote(parse(quote, body)); }
  @Get('gifting') gifting() { return this.settings.gifting(); }
  @Patch('gifting') updateGifting(@Body() body: unknown) { return this.settings.updateGifting(parse(gifting, body)); }
}

@Public() @Controller('store/config')
export class PublicStoreConfigController {
  constructor(private readonly settings: AdminSettingsService) {}
  @Get() get() { return this.settings.publicConfig(); }
}
