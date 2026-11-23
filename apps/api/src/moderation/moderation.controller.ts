import {
  Controller,
  Get,
  Patch,
  Param,
  ParseUUIDPipe,
  ParseEnumPipe,
  Query,
  Body,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ModerationTargetType, UserRole } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { ModerationLogsQueryDto, PendingQueryDto, RejectDto, SetTrustDto } from './dto/moderation.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Moderation')
@ApiBearerAuth()
@Roles(UserRole.MODERATOR)
@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('pending')
  getPendingQueue(@Query() query: PendingQueryDto) {
    return this.moderationService.getPendingQueue(query);
  }

  @Patch(':targetType/:id/approve')
  approveItem(
    @CurrentUser('sub') moderatorId: string,
    @Param('targetType', new ParseEnumPipe(ModerationTargetType)) targetType: ModerationTargetType,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.moderationService.approveItem(moderatorId, targetType, id);
  }

  @Patch(':targetType/:id/reject')
  rejectItem(
    @CurrentUser('sub') moderatorId: string,
    @Param('targetType', new ParseEnumPipe(ModerationTargetType)) targetType: ModerationTargetType,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDto,
  ) {
    return this.moderationService.rejectItem(moderatorId, targetType, id, dto.reason);
  }

  @Get('logs')
  getLogs(@Query() query: ModerationLogsQueryDto) {
    return this.moderationService.getModerationLogs(query);
  }

  @Patch('users/:userId/trust')
  setUserTrust(
    @CurrentUser('sub') moderatorId: string,
    @CurrentUser('role') moderatorRole: UserRole,
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @Body() dto: SetTrustDto,
  ) {
    return this.moderationService.setUserTrust(
      moderatorId,
      moderatorRole,
      userId,
      dto.isTrusted,
      dto.reason,
    );
  }
}
