import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRequest, Public, Roles, sessionCookie } from './access';
import { authConfig } from './config';
import { PrismaService } from '../prisma.service';
import { emailBody, loginSchema, parse, profileSchema, registerSchema, tokenBody } from './contracts';
import { ProfilePhotoService } from '../users/profile-photo.service';
import { CategoryImageService } from '../categories/category-image.service';
import { safeUser } from '../users/users.service';
export function cookieSettings() {
  const { production } = authConfig();
  return { name: production ? '__Secure-hl_refresh' : 'hl_refresh', options: { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/api/auth' } };
}
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') @HttpCode(202)
  register(@Body() body: unknown) { return this.auth.register(parse(registerSchema, body)); }
  @Public() @Post('verify-email') @HttpCode(200)
  verify(@Body() body: unknown) { return this.auth.verifyEmail(parse(tokenBody, body).token); }
  @Public() @Post('resend-activation') @HttpCode(202)
  resend(@Body() body: unknown) { return this.auth.resend(parse(emailBody, body).email); }
  @Public() @Post('login') @HttpCode(200)
  async login(@Body() body: unknown, @Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const input = parse(loginSchema, body);
    const result = await this.auth.login(input.email, input.password);
    await this.auth.logout(sessionCookie(req));
    const cookie = cookieSettings();
    res.cookie(cookie.name, result.token, { ...cookie.options, expires: result.expiresAt });
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }
  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.refresh(sessionCookie(req));
    const cookie = cookieSettings();
    res.cookie(cookie.name, result.token, { ...cookie.options, expires: result.expiresAt });
    return { user: result.user, accessToken: result.accessToken, expiresIn: result.expiresIn };
  }
  @Roles('CUSTOMER', 'ADMIN') @Get('me')
  me(@Req() req: AuthRequest) { return req.user; }
  @Public() @Post('logout') @HttpCode(204)
  async logout(@Req() req: AuthRequest, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(sessionCookie(req), req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    const cookie = cookieSettings();
    res.clearCookie(cookie.name, cookie.options);
    // Clear obsolete foundation cookies during the transition.
    res.clearCookie(authConfig().production ? '__Host-hl_session' : 'hl_session', { ...cookie.options, path: '/' });
  }
}
@Controller('account')
export class AccountController {
  constructor(private readonly photos: ProfilePhotoService, private readonly images: CategoryImageService, private readonly db: PrismaService) {}
  @Roles('CUSTOMER') @Get() account(@Req() req: AuthRequest) { return req.user; }
  @Roles('CUSTOMER') @Patch('profile')
  async updateProfile(@Req() req: AuthRequest, @Body() body: unknown) {
    const { name } = parse(profileSchema, body);
    return safeUser(await this.db.user.update({ where: { id: req.user.id }, data: { name } }));
  }
  @Roles('CUSTOMER', 'ADMIN') @Get('photo/config') photoConfig() { return { maxBytes: this.images.maxBytes(), formats: ['JPEG', 'PNG', 'WebP'], minDimension: 32, maxDimension: 8192, maxPixels: 16000000 }; }
  @Roles('CUSTOMER', 'ADMIN') @Post('photo') @UseInterceptors(FileInterceptor('image', { limits: { files: 1, fileSize: Number(process.env.CATEGORY_IMAGE_MAX_BYTES ?? 5242880) } }))
  photo(@Req() req: AuthRequest, @UploadedFile() file: Express.Multer.File) { return this.photos.upload(req.user.id, file); }
  @Roles('CUSTOMER', 'ADMIN') @Delete('photo') removePhoto(@Req() req: AuthRequest) { return this.photos.remove(req.user.id); }
}
@Controller('admin')
export class AdminController {
  constructor(private readonly db: PrismaService) {}
  @Roles('ADMIN') @Get() admin(@Req() req: AuthRequest) { return req.user; }
  @Roles('ADMIN') @Get('dashboard')
  async dashboard() {
    const [products, categories, customers, recentProducts] = await Promise.all([
      this.db.product.count(), this.db.category.count(), this.db.customer.count(),
      this.db.product.findMany({ take: 5, orderBy: { updatedAt: 'desc' }, select: { id: true, name: true, status: true, updatedAt: true, variants: { select: { stockQuantity: true }, take: 1 } } }),
    ]);
    return { products, categories, customers, orders: { value: null, label: 'Not seeded' }, recentProducts: recentProducts.map(product => ({ id: product.id, name: product.name, status: product.status, stock: product.variants[0]?.stockQuantity ?? 0, updatedAt: product.updatedAt })) };
  }
}
