import { ArgumentsHost, Catch, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

import { HandledException } from '../error/http.error';

@Catch()
export class HttpExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    if (!(exception instanceof HandledException)) {
      this.logger.error('Unhandled exception', exception.stack);
    }
    super.catch(exception, host);
  }
}
