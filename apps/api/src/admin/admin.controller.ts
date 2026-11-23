import { Controller, Get, Patch, Param, ParseUUIDPipe, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import {
  AdminUserQueryDto,
  AuthorApplicationQueryDto,
  BanUserDto,
  ReviewAuthorApplicationDto,
  UpdateUserRoleDto,
} from './dto/admin.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin & Studio')
@ApiBearerAuth()
@Controller()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(UserRole.AUTHOR)
  @Get('studio/overview')
  getStudioOverview(@CurrentUser('sub') userId: string) {
    return this.adminService.getStudioOverview(userId);
  }

  @Roles(UserRole.MODERATOR)
  @Get('admin/overview')
  getAdminOverview() {
    return this.adminService.getAdminOverview();
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/users')
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/users/:id/role')
  updateUserRole(
    @CurrentUser('sub') actorId: string,
    @Param('id', new ParseUUIDPipe()) targetId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(actorId, targetId, dto.role);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/users/:id/ban')
  banUser(
    @CurrentUser('sub') actorId: string,
    @Param('id', new ParseUUIDPipe()) targetId: string,
    @Body() dto: BanUserDto,
  ) {
    return this.adminService.banUser(actorId, targetId, dto.isBanned, dto.reason, dto.banDurationDays);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/author-applications')
  listAuthorApplications(@Query() query: AuthorApplicationQueryDto) {
    return this.adminService.listAuthorApplications(query.status, query.page, query.limit);
  }

  @Roles(UserRole.ADMIN)
  @Patch('admin/author-applications/:id/review')
  reviewAuthorApplication(
    @CurrentUser('sub') adminId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ReviewAuthorApplicationDto,
  ) {
    return this.adminService.reviewAuthorApplication(adminId, id, dto);
  }
}
