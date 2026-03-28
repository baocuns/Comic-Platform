import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restrict access to users with specific roles.
 * Uses role hierarchy, so @Roles(UserRole.AUTHOR)
 * also allows MODERATOR and ADMIN.
 *
 * Usage: @Roles(UserRole.AUTHOR)
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
