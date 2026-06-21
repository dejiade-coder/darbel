import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CurrentUser,
  Permissions,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';
import { RolesService } from './roles.service';
import { CreateRoleDto, ListRolesQueryDto } from './roles.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @Permissions('role.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListRolesQueryDto)) query: ListRolesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.roles.list(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      query,
    );
  }

  @Get('permissions')
  @Permissions('role.view')
  listPermissions(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.roles.listPermissions({
      userId: actor.userId,
      tenantId: actor.tenantId,
      userEmail: actor.email,
      requestId: req.requestId!,
      clientIp: req.ip,
      userAgent: req.header('user-agent'),
    });
  }

  @Post()
  @Permissions('role.manage')
  create(@CurrentUser() actor: AuthenticatedActor, @Body(new ZodValidationPipe(CreateRoleDto)) dto: CreateRoleDto, @Req() req: AuthenticatedRequest) {
    return this.roles.create({ userId: actor.userId, tenantId: actor.tenantId, userEmail: actor.email, requestId: req.requestId!, clientIp: req.ip, userAgent: req.header('user-agent') }, dto);
  }
}
