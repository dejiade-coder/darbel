import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CurrentUser,
  Permissions,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DocumentsService, type UploadedDocumentFile } from './documents.service';
import { DocumentTypeDto } from './documents.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('registrations/:registrationId/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @Permissions('handler.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documents.listForRegistration(toContext(actor, req), registrationId);
  }

  @Post()
  @Permissions('handler.update')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('registrationId', new ParseUUIDPipe()) registrationId: string,
    @Body('documentType', new ZodValidationPipe(DocumentTypeDto)) documentType: DocumentTypeDto,
    @Body('notes') notes: string | undefined,
    @UploadedFile() file: UploadedDocumentFile,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.documents.uploadForRegistration(
      toContext(actor, req),
      registrationId,
      documentType,
      file,
      notes,
    );
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
