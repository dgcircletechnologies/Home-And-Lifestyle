import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
export const canonicalEmail = (email: string) => email.trim().toLowerCase();
export const emailSchema = z.string().trim().max(254).pipe(z.email());
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(256) }).strict();
export const registerSchema = loginSchema.extend({ name: z.string().trim().min(1).max(100), password: z.string().max(256).refine(value => Array.from(value).length >= 8 && Array.from(value).length <= 128, 'Use 8–128 characters.') });
export const emailBody = z.object({ email: emailSchema }).strict();
export const tokenBody = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
export function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Please check the submitted fields.', fields: z.flattenError(result.error).fieldErrors });
  return result.data;
}
