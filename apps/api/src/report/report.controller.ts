import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { ReportService } from './report.service';
import { CreateReportDto, ReportQueryDto, ResolveReportDto } from './dto/report.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Post()
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateReportDto) {
    return this.reportService.create(userId, dto);
  }

  @Roles(UserRole.MODERATOR)
  @Get()
  findAll(@Query() query: ReportQueryDto) {
    return this.reportService.findAll(query);
  }

  @Roles(UserRole.MODERATOR)
  @Patch(':id/resolve')
  resolve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser('sub') resolverId: string,
    @CurrentUser('role') resolverRole: UserRole,
    @Body() dto: ResolveReportDto,
  ) {
    return this.reportService.resolve(id, resolverId, resolverRole, dto);
  }
}
