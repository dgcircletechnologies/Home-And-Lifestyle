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
@Module({ controllers: [HealthController, AuthController, AccountController, AdminController], providers: [PasswordPolicy, MailService, AccessTokens, PrismaService, UsersService, AuthService, { provide: APP_GUARD, useClass: AccessGuard }] })
export class AppModule {}
