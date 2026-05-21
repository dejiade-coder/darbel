import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CurrentUser,
  Permissions,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AuditService } from './audit.service';
import { ListAuditQueryDto } from './audit.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Permissions('audit.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListAuditQueryDto)) query: ListAuditQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.audit.list(toContext(actor, req), query);
  }

  @Get(':id')
  @Permissions('audit.view')
  async findOne(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!/^\d+$/.test(id)) throw new NotFoundException();
    const entry = await this.audit.findOne(toContext(actor, req), id);
    if (!entry) throw new NotFoundException();
    return entry;
  }
}

function toContext(actor: AuthenticatedActor, req: AuthenticatedRequest) {
  return {
    userId: actor.userId,
    tenantId: actor.tenantId,
    userEmail: actor.email,
    requestId: req.requestId!,
    clientIp: req.ip,
    userAgent: req.header('user-agent'),
  };
}
