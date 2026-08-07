import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationQueryDto } from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getAll(
    @CurrentUser('sub') userId: string,
    @Query() query: NotificationQueryDto,
  ) {
    const result = await this.notificationService.getAll(userId, query);
    return { success: true, ...result };
  }

  @Get('unread-count')
  async getUnreadCount(@CurrentUser('sub') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { success: true, data: { count } };
  }

  @Patch(':id/read')
  async markAsRead(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationService.markAsRead(userId, id);
    return { success: true, data: { message: 'Notification marked as read' } };
  }

  @Patch('read-all')
  async markAllAsRead(@CurrentUser('sub') userId: string) {
    await this.notificationService.markAllAsRead(userId);
    return { success: true, data: { message: 'All notifications marked as read' } };
  }

  @Delete(':id')
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.notificationService.deleteNotification(userId, id);
    return { success: true, data: { message: 'Notification deleted' } };
  }
}
