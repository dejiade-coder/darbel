import {
  Body,
  Controller,
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
import { PaymentsService } from './payments.service';
import { ListPaymentsQueryDto, RecordPaymentDto } from './payments.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Permissions('payment.view')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListPaymentsQueryDto))
    query: ListPaymentsQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.list(toContext(actor, req), query);
  }

  @Post()
  @Permissions('payment.record')
  record(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(RecordPaymentDto))
    body: RecordPaymentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.record(toContext(actor, req), body);
  }

  @Patch(':id/approve')
  @Permissions('payment.approve')
  approve(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.approve(toContext(actor, req), id);
  }

  @Patch(':id/registrar-approve')
  @Permissions('payment.record')
  registrarApprove(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.payments.approve(toContext(actor, req), id);
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
