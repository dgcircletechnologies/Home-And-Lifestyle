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
@Module({ controllers: [HealthController, AuthController, AccountController, AdminController, AdminCustomersController, AdminCategoriesController, AdminProductsController], providers: [PasswordPolicy, MailService, AccessTokens, PrismaService, UsersService, AuthService, AdminCustomersService, AdminCategoriesService, CategoryImageService, AdminProductsService, { provide: APP_GUARD, useClass: AccessGuard }] })
export class AppModule {}
