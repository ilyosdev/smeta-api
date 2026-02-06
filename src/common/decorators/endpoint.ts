import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/jwt.guard';
import { RoleAuthorizationGuard, RolesMetadata } from '../auth/roles.guard';
import { Roles } from '../consts/auth';

export function Endpoint(summary: string, authRequired = false, roles?: Roles[]) {
  const decorators = [ApiOperation({ summary })];

  if (authRequired && roles?.length) {
    decorators.push(
      ApiBearerAuth('access-token'),
      RolesMetadata(...roles),
      UseGuards(JwtAuthGuard, RoleAuthorizationGuard),
    );
  } else if (authRequired) {
    decorators.push(ApiBearerAuth('access-token'), UseGuards(JwtAuthGuard));
  }

  return applyDecorators(...decorators);
}
