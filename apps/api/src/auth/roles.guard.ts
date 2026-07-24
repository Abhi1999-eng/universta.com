import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from './auth.types';
import { ROLES_KEY } from './auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    // The access-token guard runs on protected catalog controllers. Let it
    // produce the correct 401 for a missing bearer token before role checks.
    if (!request.user) {
      return true;
    }
    return Boolean(
      request.user &&
      requiredRoles.some((role) => request.user?.roles.includes(role)),
    );
  }
}
