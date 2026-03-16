import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

@Injectable()
export class SessionGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.isAuthenticated()) return false;
    const user = request.user;
    return user && user.role;
  }
}
