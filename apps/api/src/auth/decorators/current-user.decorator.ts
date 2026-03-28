import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract the current user from the JWT payload.
 * Usage:
 *   @CurrentUser() user          → full payload { sub, role, sid }
 *   @CurrentUser('sub') userId   → just the user ID
 *   @CurrentUser('role') role    → just the role
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
