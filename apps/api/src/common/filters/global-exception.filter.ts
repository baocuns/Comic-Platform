import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response, Request } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() !== 'http') return;
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Lỗi hệ thống nội bộ';
    let code = 'INTERNAL_ERROR';
    let details: Array<{ field: string; message: string }> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        if (Array.isArray(obj.message)) {
          message = obj.message[0] || 'Dữ liệu đầu vào không hợp lệ';
          details = obj.message.map((m) => ({
            field: typeof m === 'string' ? m.split(' ')[0] : 'field',
            message: String(m),
          }));
        } else {
          message = (obj.message as string) || exception.message;
        }
        code = (obj.code as string) || (obj.error as string) || `HTTP_${status}`;
      } else {
        message = String(res || exception.message);
        code = `HTTP_${status}`;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_ENTRY';
        message = 'Dữ liệu đã tồn tại trong hệ thống';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Không tìm thấy bản ghi yêu cầu';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_REFERENCE';
        message = 'Tham chiếu dữ liệu không hợp lệ';
      } else if (exception.code === 'P2023') {
        status = HttpStatus.BAD_REQUEST;
        code = 'INVALID_ID';
        message = 'Định dạng mã định danh không hợp lệ';
      } else {
        this.logger.error(`Prisma error ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception on ${request.method} ${request.url}: ${exception.message}`, exception.stack);
      if (process.env.NODE_ENV !== 'production') {
        message = exception.message;
      }
    }

    response.status(status).json({
      success: false,
      error: {
        code: code.toUpperCase().replace(/\s+/g, '_'),
        message,
        statusCode: status,
        ...(details && { details }),
        path: request.url,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
