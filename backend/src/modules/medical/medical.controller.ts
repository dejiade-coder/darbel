import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Permissions, type AuthenticatedActor, type AuthenticatedRequest } from '../../common/decorators/auth.decorators';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MedicalService } from './medical.service';
import { CreateScreeningDto, EnterResultDto, ListScreeningsQueryDto, ReviewScreeningDto } from './medical.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('medical-screenings')
export class MedicalController {
  constructor(private readonly medical: MedicalService) {}

  @Get()
  @Permissions('medical.view_results')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListScreeningsQueryDto)) query: ListScreeningsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medical.list(toContext(actor, req), query);
  }

  @Get('ready')
  @Permissions('medical.view_results')
  readyQueue(
    @CurrentUser() actor: AuthenticatedActor,
    @Query('q') q: string | undefined,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medical.readyQueue(toContext(actor, req), q?.trim());
  }

  @Post()
  @Permissions('medical.record_sample')
  create(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(CreateScreeningDto)) body: CreateScreeningDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medical.create(toContext(actor, req), body);
  }

  @Patch(':id/result')
  @Permissions('medical.enter_result')
  enterResult(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(EnterResultDto)) body: EnterResultDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medical.enterResult(toContext(actor, req), id, body);
  }

  @Patch(':id/review')
  @Permissions('medical.approve_result')
  review(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ReviewScreeningDto)) body: ReviewScreeningDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.medical.review(toContext(actor, req), id, body);
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
