import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformResponseInterceptor<T> implements NestInterceptor<T, unknown> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((payload: unknown) => {
        if (payload === undefined || payload === null) {
          return { success: true, data: null };
        }
        if (typeof payload === 'object' && payload !== null) {
          const obj = payload as Record<string, unknown>;
          if ('success' in obj) {
            return obj;
          }
          if ('data' in obj && 'meta' in obj) {
            return { success: true, data: obj.data, meta: obj.meta };
          }
        }
        return { success: true, data: payload };
      }),
    );
  }
}
