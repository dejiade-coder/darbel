import { Body, Controller, Get, Patch, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser, Permissions, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TenantSettingsService, type CertificateTemplateLayout, type UploadedTemplateFile } from './tenant-settings.service';
import { UpdateNotificationProvidersDto } from './tenant-settings.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('tenant-settings')
export class TenantSettingsController {
  constructor(private readonly settings: TenantSettingsService) {}

  @Get('notification-providers')
  @Permissions('tenant.view')
  getNotificationProviders(@CurrentUser() actor: AuthenticatedActor, @Req() req: AuthenticatedRequest) {
    return this.settings.getNotificationProviders(toContext(actor, req));
  }

  @Patch('notification-providers')
  @Permissions('tenant.update_own')
  updateNotificationProviders(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(UpdateNotificationProvidersDto)) body: UpdateNotificationProvidersDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.updateNotificationProviders(toContext(actor, req), body);
  }

  @Get('certificate-template')
  @Permissions('tenant.view')
  getTemplate(@CurrentUser() actor: AuthenticatedActor, @Req() req: AuthenticatedRequest) {
    return this.settings.getCertificateTemplate(toContext(actor, req));
  }

  @Post('certificate-template')
  @Permissions('tenant.update_own')
  @UseInterceptors(FileInterceptor('file'))
  uploadTemplate(
    @CurrentUser() actor: AuthenticatedActor,
    @UploadedFile() file: UploadedTemplateFile,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.uploadCertificateTemplate(toContext(actor, req), file);
  }

  @Patch('certificate-template')
  @Permissions('tenant.update_own')
  updateTemplateLayout(
    @CurrentUser() actor: AuthenticatedActor,
    @Body() body: Partial<CertificateTemplateLayout>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settings.updateCertificateTemplateLayout(toContext(actor, req), body);
  }

  @Get('certificate-template/file')
  @Permissions('tenant.view')
  async getTemplateFile(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
  ) {
    const file = await this.settings.openCertificateTemplateFile(toContext(actor, req));
    res.setHeader('content-type', file.mimeType);
    res.setHeader('content-disposition', `inline; filename="${file.filename}"`);
    file.stream.pipe(res);
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
