import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import {
  CurrentUser,
  Permissions,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';
import { TradeCategoriesService } from './trade-categories.service';
import {
  ListTradeCategoriesQueryDto,
  SetTradeCategoryFeeDto,
} from './trade-categories.dto';

@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('trade-categories')
export class TradeCategoriesController {
  constructor(private readonly tradeCategories: TradeCategoriesService) {}

  /**
   * GET /trade-categories
   *
   * Lists categories visible to the caller's tenant. RLS handles
   * jurisdiction-matching. Use ?withFeeOnly=true for the Registrar
   * view (categories must have a fee set to be bookable).
   *
   * Open to any authenticated user with the trade.set_fee permission,
   * which is what TENANT_ADMIN gets. Registrars rely on a separate
   * read path that filters by withFeeOnly=true (and they will need
   * a 'category.view' permission in a future slice; for now,
   * trade.set_fee is the gate since Slice 1 is TENANT_ADMIN focused).
   */
  @Get()
  @Permissions('trade.set_fee')
  list(
    @CurrentUser() actor: AuthenticatedActor,
    @Query(new ZodValidationPipe(ListTradeCategoriesQueryDto))
    query: ListTradeCategoriesQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tradeCategories.list(
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

  /**
   * PUT /trade-categories/:id/fee
   *
   * Sets or updates the fee for a category in the caller's tenant.
   * Requires trade.set_fee (granted to TENANT_ADMIN).
   */
  @Put(':id/fee')
  @Permissions('trade.set_fee')
  setFee(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(SetTradeCategoryFeeDto))
    body: SetTradeCategoryFeeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tradeCategories.setFee(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      id,
      body,
    );
  }

  /**
   * DELETE /trade-categories/:id/fee
   *
   * Removes the fee row for a category in the caller's tenant.
   * Category becomes unbookable until a new fee is set.
   * Returns 204 No Content on success.
   */
  @Delete(':id/fee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions('trade.set_fee')
  deleteFee(
    @CurrentUser() actor: AuthenticatedActor,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tradeCategories.deleteFee(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      id,
    );
  }
}
