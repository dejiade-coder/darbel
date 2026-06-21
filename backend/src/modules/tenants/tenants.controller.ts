import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ParseUUIDPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateTenantDto, UpdateTenantStatusDto } from './tenants.dto';
import { TenantsService } from './tenants.service';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get()
  @Permissions('platform.manage')
  list(@CurrentUser() actor: AuthenticatedActor, @Req() req: AuthenticatedRequest) {
    return this.tenants.list(context(actor, req));
  }

  @Post()
  @Permissions('platform.manage')
  create(@CurrentUser() actor: AuthenticatedActor, @Body(new ZodValidationPipe(CreateTenantDto)) dto: CreateTenantDto, @Req() req: AuthenticatedRequest) {
    return this.tenants.create(context(actor, req), dto);
  }

  @Patch(':id/status')
  @Permissions('platform.manage')
  updateStatus(@CurrentUser() actor: AuthenticatedActor, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodValidationPipe(UpdateTenantStatusDto)) dto: UpdateTenantStatusDto, @Req() req: AuthenticatedRequest) {
    return this.tenants.updateStatus(context(actor, req), id, dto);
  }
}

function context(actor: AuthenticatedActor, req: AuthenticatedRequest) {
  return { userId: actor.userId, tenantId: actor.tenantId, userEmail: actor.email, requestId: req.requestId!, clientIp: req.ip, userAgent: req.header('user-agent') };
}
