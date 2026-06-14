import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CertificatesService } from './certificates.service';
import {
  AppealCertificateDto,
  RecordCertificateDeliveryDto,
  RenewCertificateDto,
  RevokeCertificateDto,
  ReviewCertificateAppealDto,
} from './certificates.dto';

@Controller()
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Get('certificates')
  @Permissions('certificate.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query('q') q: string | undefined,
    @Query('status') status: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.list(toContext(actor, req), q?.trim(), status?.trim());
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Get('verify/:uid')
  @Permissions('certificate.view')
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

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Patch('certificates/:id/renew')
  @Permissions('certificate.issue')
  renew(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RenewCertificateDto)) dto: RenewCertificateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.renew(toContext(actor, req), id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Patch('certificates/:id/appeal')
  @Permissions('certificate.revoke')
  appeal(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AppealCertificateDto)) dto: AppealCertificateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.appeal(toContext(actor, req), id, dto);
  }

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @Patch('certificates/:id/appeal-review')
  @Permissions('certificate.issue')
  reviewAppeal(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewCertificateAppealDto)) dto: ReviewCertificateAppealDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.certificates.reviewAppeal(toContext(actor, req), id, dto);
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
