import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { IUser } from '../consts/auth';

export const User = createParamDecorator((_: unknown, ctx: ExecutionContext): IUser => {
  const request = ctx.switchToHttp().getRequest();
  return request.user as IUser;
});
