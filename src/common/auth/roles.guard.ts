import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, Roles } from '../consts/auth';
import { HandledException } from '../error/http.error';

export const RolesMetadata = (...roles: Roles[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RoleAuthorizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Roles[]>(ROLES_KEY, context.getHandler());

    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      HandledException.throw('UNAUTHORIZED', 401);
    }

    const hasRole = requiredRoles.includes(user.role);

    if (!hasRole) {
      HandledException.throw('FORBIDDEN', 403);
    }

    return true;
  }
}
