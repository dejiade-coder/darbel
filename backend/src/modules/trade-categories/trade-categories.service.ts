import { Injectable, NotFoundException } from '@nestjs/common';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import type {
  ListTradeCategoriesQueryDto,
  SetTradeCategoryFeeDto,
} from './trade-categories.dto';

/**
 * Public-shape representation of a trade category, optionally with the
 * caller's tenant's fee attached.
 */
export interface TradeCategoryPublicDto {
  id: string;
  code: string;
  displayName: string;
  sector: string;
  description: string | null;
  validityPeriodDays: number;
  isActive: boolean;
  fee: {
    amount: string;        // NUMERIC serializes as string in JS
    currency: string;
    updatedAt: string;     // ISO-8601
  } | null;
}

export interface SetFeeResultDto {
  tradeCategoryId: string;
  feeAmount: string;
  currency: string;
  effectiveFrom: string;
  updatedAt: string;
}

@Injectable()
export class TradeCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List trade categories visible to the caller's tenant.
   *
   * - RLS handles jurisdiction-matching: tenants only see categories
   *   from their own jurisdiction. Platform admins see all.
   * - For each category, the caller's tenant's fee (if set) is attached.
   * - withFeeOnly=true filters to categories where a fee has been set.
   *   This is the Registrar view (cannot book a category without a fee).
   */
  async list(
    ctx: ActorContext,
    query: ListTradeCategoriesQueryDto,
  ): Promise<TradeCategoryPublicDto[]> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const categories = await tx.tradeCategory.findMany({
        where: { isActive: true },
        include: {
          fees: {
            where: { tenantId: ctx.tenantId },
            take: 1,
          },
        },
        orderBy: [{ sector: 'asc' }, { code: 'asc' }],
      });

      const result: TradeCategoryPublicDto[] = categories.map((tc: TradeCategoryWithFees) => {
        const fee = tc.fees[0];
        return {
          id: tc.id,
          code: tc.code,
          displayName: tc.displayName,
          sector: tc.sector,
          description: tc.description,
          validityPeriodDays: tc.validityPeriodDays,
          isActive: tc.isActive,
          fee: fee
            ? {
                amount: fee.feeAmount.toString(),
                currency: fee.currency,
                updatedAt: fee.updatedAt.toISOString(),
              }
            : null,
        };
      });

      return query.withFeeOnly ? result.filter((c) => c.fee !== null) : result;
    });
  }

  /**
   * Set or update the fee for a trade category in the caller's tenant.
   *
   * - The PrimaryKey is (tenant_id, trade_category_id), so upsert is
   *   the right operation. RLS enforces tenant_id = current_app_tenant_id().
   * - Validates the category exists and is active before upserting.
   */
  async setFee(
    ctx: ActorContext,
    tradeCategoryId: string,
    body: SetTradeCategoryFeeDto,
  ): Promise<SetFeeResultDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const tc = await tx.tradeCategory.findUnique({
        where: { id: tradeCategoryId },
      });
      if (!tc) {
        throw new NotFoundException(`Trade category ${tradeCategoryId} not found`);
      }
      if (!tc.isActive) {
        throw new NotFoundException(`Trade category ${tradeCategoryId} is inactive`);
      }

      const fee = await tx.tradeCategoryFee.upsert({
        where: {
          tenantId_tradeCategoryId: {
            tenantId: ctx.tenantId,
            tradeCategoryId,
          },
        },
        create: {
          tenantId: ctx.tenantId,
          tradeCategoryId,
          feeAmount: body.feeAmount,
          currency: body.currency,
          updatedBy: ctx.userId,
        },
        update: {
          feeAmount: body.feeAmount,
          currency: body.currency,
          updatedBy: ctx.userId,
          updatedAt: new Date(),
        },
      });

      return {
        tradeCategoryId: fee.tradeCategoryId,
        feeAmount: fee.feeAmount.toString(),
        currency: fee.currency,
        effectiveFrom: fee.effectiveFrom.toISOString(),
        updatedAt: fee.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Delete the fee for a trade category in the caller's tenant.
   * Returns void; throws NotFoundException if no fee row exists.
   */
  async deleteFee(ctx: ActorContext, tradeCategoryId: string): Promise<void> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.tradeCategoryFee.findUnique({
        where: {
          tenantId_tradeCategoryId: {
            tenantId: ctx.tenantId,
            tradeCategoryId,
          },
        },
      });
      if (!existing) {
        throw new NotFoundException(
          `No fee set for trade category ${tradeCategoryId} in this tenant`,
        );
      }
      await tx.tradeCategoryFee.delete({
        where: {
          tenantId_tradeCategoryId: {
            tenantId: ctx.tenantId,
            tradeCategoryId,
          },
        },
      });
    });
  }
}

// Local types — Prisma's generated types are awkward to import directly.
// We define minimal shapes matching the include() result in `list()`.
type TradeCategoryFeeRow = {
  feeAmount: { toString: () => string };
  currency: string;
  updatedAt: Date;
};
type TradeCategoryWithFees = {
  id: string;
  code: string;
  displayName: string;
  sector: string;
  description: string | null;
  validityPeriodDays: number;
  isActive: boolean;
  fees: TradeCategoryFeeRow[];
};
