import { HttpException, HttpExceptionOptions, HttpStatus } from '@nestjs/common';

export class HandledException extends HttpException {
  static throw(message: string, code: HttpStatus = 400, options?: HttpExceptionOptions): never {
    throw new HandledException(message, code, options);
  }
}
