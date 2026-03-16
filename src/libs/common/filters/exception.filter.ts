import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
    } else if (typeof exception.code === 'number') {
      status = exception.code;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
    }

    const msg =
      exception instanceof HttpException
        ? (exception.getResponse()['message'] ?? exception.getResponse())
        : (exception.message ?? exception);

    response.status(status).json({
      statusCode: status,
      timestamp: Date.now(),
      path: request.url,
      error: msg,
    });
  }
}
