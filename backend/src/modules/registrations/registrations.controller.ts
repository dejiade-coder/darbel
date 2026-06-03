import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { RegistrationsService } from './registrations.service';
import {
  ListRegistrationsQueryDto,
  UpsertRegistrationDto,
} from './registrations.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Get()
  @Permissions('handler.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListRegistrationsQueryDto))
    query: ListRegistrationsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrations.list(toContext(actor, req), query);
  }

  @Get(':id')
  @Permissions('handler.view')
  findOne(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrations.findById(toContext(actor, req), id);
  }

  @Post()
  @Permissions('handler.create')
  create(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(UpsertRegistrationDto))
    body: UpsertRegistrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrations.create(toContext(actor, req), body);
  }

  @Patch(':id')
  @Permissions('handler.update')
  update(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpsertRegistrationDto))
    body: UpsertRegistrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrations.update(toContext(actor, req), id, body);
  }

  @Delete(':id')
  @Permissions('handler.update')
  cancel(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.registrations.cancel(toContext(actor, req), id);
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
