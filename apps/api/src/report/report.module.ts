import { Module } from '@nestjs/common';
import { GenreModule } from '../genre/genre.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [GenreModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
