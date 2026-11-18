import { PasswordPolicy } from './auth/password-policy';
import { MailService } from './auth/mail.service';
import { AccessTokens } from './auth/jwt.service';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaService } from './prisma.service';
import { UsersService } from './users/users.service';
import { AuthService } from './auth/auth.service';
import { AccessGuard } from './auth/access';
import { AuthController, AccountController, AdminController } from './auth/auth.controller';
import { HealthController } from './health/health.controller';
import { AdminCustomersController } from './customers/admin-customers.controller';
import { AdminCustomersService } from './customers/admin-customers.service';
import { AdminCategoriesController } from './categories/admin-categories.controller';
import { AdminCategoriesService } from './categories/admin-categories.service';
import { CategoryImageService } from './categories/category-image.service';
import { AdminProductsController } from './products/admin-products.controller';
import { AdminProductsService } from './products/admin-products.service';
import { AdminOrdersController, AdminPaymentsController } from './orders/admin-orders.controller';
import { AdminOrdersService } from './orders/admin-orders.service';
import { AdminPromotionsController } from './promotions/admin-promotions.controller';
import { AdminPromotionsService } from './promotions/admin-promotions.service';
import { AdminReviewsController } from './reviews/admin-reviews.controller';
import { AdminReviewsService } from './reviews/admin-reviews.service';
import { ProfilePhotoService } from './users/profile-photo.service';
@Module({ controllers: [HealthController, AuthController, AccountController, AdminController, AdminCustomersController, AdminCategoriesController, AdminProductsController, AdminOrdersController, AdminPaymentsController, AdminPromotionsController, AdminReviewsController], providers: [PasswordPolicy, MailService, AccessTokens, PrismaService, UsersService, AuthService, AdminCustomersService, AdminCategoriesService, CategoryImageService, AdminProductsService, AdminOrdersService, AdminPromotionsService, AdminReviewsService, ProfilePhotoService, { provide: APP_GUARD, useClass: AccessGuard }] })
export class AppModule {}
