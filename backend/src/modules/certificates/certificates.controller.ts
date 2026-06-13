import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, Public, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { CertificatesService } from './certificates.service';

@Controller()
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Get('certificates')
  @Permissions('certificate.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query('q') q: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.list(toContext(actor, req), q?.trim());
  }

  @Public()
  @Get('verify/:uid')
  verify(@Param('uid') uid: string) {
    return this.certificates.verify(uid.toUpperCase());
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
