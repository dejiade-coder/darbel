import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, Public, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CertificatesService } from './certificates.service';
import { RecordCertificateDeliveryDto, RevokeCertificateDto } from './certificates.dto';

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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Post('certificates/:id/deliveries')
  @Permissions('certificate.deliver')
  recordDelivery(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RecordCertificateDeliveryDto)) dto: RecordCertificateDeliveryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.recordDelivery(toContext(actor, req), id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Patch('certificates/:id/revoke')
  @Permissions('certificate.revoke')
  revoke(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RevokeCertificateDto)) dto: RevokeCertificateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.revoke(toContext(actor, req), id, dto);
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
