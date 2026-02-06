import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { verify } from 'jsonwebtoken';

import { env } from '../config';
import { HandledException } from '../error/http.error';
import { IUser } from '../consts/auth';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      HandledException.throw('TOKEN_NOT_PROVIDED', 401);
    }

    const [bearer, token] = authHeader.split(' ');

    if (bearer !== 'Bearer' || !token) {
      HandledException.throw('INVALID_TOKEN_FORMAT', 401);
    }

    try {
      const payload = verify(token, env.ACCESS_TOKEN_SECRET) as IUser;
      req['user'] = payload;
      return true;
    } catch {
      HandledException.throw('INVALID_TOKEN', 401);
    }
  }
}
