import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../../generated/prisma/client';
import type { SafeUser } from '../users/users.service';
import { AuthService } from './auth.service';
export const Public = () => SetMetadata('public', true);
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
export type AuthRequest = Request & { user: SafeUser };
export const sessionCookie = (req: Request) => {
  const name = process.env.NODE_ENV === 'production' ? '__Secure-hl_refresh' : 'hl_refresh';
  return req.headers.cookie?.split(';').map(s => s.trim()).find(s => s.startsWith(name + '='))?.slice(name.length + 1);
};
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets)) return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.user = await this.auth.resolve(req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined);
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', targets);
    if (!roles?.includes(req.user.role)) throw new ForbiddenException('Access denied.');
    return true;
  }
}
