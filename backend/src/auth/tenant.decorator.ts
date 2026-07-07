import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { Tenant as TenantType } from './auth.types';

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantType => {
    const request = ctx.switchToHttp().getRequest();

    return request.tenant;
  },
);
