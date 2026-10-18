import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { PendingQueryDto, RejectDto, ModerationLogsQueryDto, SetTrustDto } from './dto/moderation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole, ModerationTargetType } from '@prisma/client';

@Controller('admin/moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('pending')
  async getPendingQueue(@Query() query: PendingQueryDto) {
    const result = await this.moderationService.getPendingQueue(query);
    return { success: true, ...result };
  }

  @Get('logs')
  async getModerationLogs(@Query() query: ModerationLogsQueryDto) {
    const result = await this.moderationService.getModerationLogs(query);
    return { success: true, ...result };
  }

  @Post(':targetType/:targetId/approve')
  async approveItem(
    @CurrentUser('sub') moderatorId: string,
    @Param('targetType') targetType: ModerationTargetType,
    @Param('targetId') targetId: string,
  ) {
    const data = await this.moderationService.approveItem(moderatorId, targetType, targetId);
    return { success: true, data };
  }

  @Post(':targetType/:targetId/reject')
  async rejectItem(
    @CurrentUser('sub') moderatorId: string,
    @Param('targetType') targetType: ModerationTargetType,
    @Param('targetId') targetId: string,
    @Body() dto: RejectDto,
  ) {
    const data = await this.moderationService.rejectItem(moderatorId, targetType, targetId, dto.reason);
    return { success: true, data };
  }

  @Patch('users/:userId/trust')
  async setUserTrust(
    @CurrentUser('sub') moderatorId: string,
    @Param('userId') targetUserId: string,
    @Body() dto: SetTrustDto,
  ) {
    const data = await this.moderationService.setUserTrust(moderatorId, targetUserId, dto.isTrusted, dto.reason);
    return { success: true, data };
  }
}
