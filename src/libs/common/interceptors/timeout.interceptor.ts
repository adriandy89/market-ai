import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<{ headers?: { accept?: string } }>();
    const isSse = request?.headers?.accept === 'text/event-stream';
    if (isSse) return next.handle();
    return next.handle().pipe(timeout(80_000));
  }
}
