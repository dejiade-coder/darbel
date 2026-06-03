import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';
import type { ListPaymentsQueryDto, RecordPaymentDto } from './payments.dto';

export interface PaymentPublicDto {
  id: string;
  tenantId: string;
  handlerRegistrationId: string;
  handlerName: string;
  tradeCategory: string | null;
  amount: string;
  currency: string;
  method: string;
  reference: string | null;
  receiptNumber: string | null;
  status: string;
  paidAt: string;
  recordedBy: string | null;
  recordedAt: string;
  notes: string | null;
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: ActorContext,
    query: ListPaymentsQueryDto,
  ): Promise<{ items: PaymentPublicDto[]; nextCursor: string | null }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.PaymentWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.handlerRegistrationId) where.handlerRegistrationId = query.handlerRegistrationId;
      if (query.q) {
        where.OR = [
          { reference: { contains: query.q, mode: 'insensitive' } },
          { receiptNumber: { contains: query.q, mode: 'insensitive' } },
          {
            handlerRegistration: {
              OR: [
                { firstName: { contains: query.q, mode: 'insensitive' } },
                { lastName: { contains: query.q, mode: 'insensitive' } },
                { phone: { contains: query.q, mode: 'insensitive' } },
                { tradeCategory: { contains: query.q, mode: 'insensitive' } },
              ],
            },
          },
        ];
      }

      const take = query.limit + 1;
      const items = await tx.payment.findMany({
        where,
        include: { handlerRegistration: true },
        orderBy: { paidAt: 'desc' },
        take,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasMore = items.length > query.limit;
      const sliced = hasMore ? items.slice(0, query.limit) : items;
      return {
        items: sliced.map(toPublic),
        nextCursor: hasMore ? sliced[sliced.length - 1]!.id : null,
      };
    });
  }

  async record(ctx: ActorContext, dto: RecordPaymentDto): Promise<PaymentPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registration = await tx.handlerRegistration.findUnique({
        where: { id: dto.handlerRegistrationId },
      });
      if (!registration) {
        throw new ResourceNotFoundException('Registration', dto.handlerRegistrationId);
      }
      if (registration.status === 'DRAFT') {
        throw new ResourceConflictException('Submit the registration before recording payment');
      }
      if (registration.status === 'CANCELLED') {
        throw new ResourceConflictException('Cancelled registrations cannot receive payments');
      }

      const payment = await tx.payment.create({
        data: {
          tenantId: ctx.tenantId,
          handlerRegistrationId: dto.handlerRegistrationId,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency.toUpperCase(),
          method: dto.method,
          reference: emptyToNull(dto.reference),
          receiptNumber: emptyToNull(dto.receiptNumber),
          paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
          recordedBy: ctx.userId,
          notes: emptyToNull(dto.notes),
        },
        include: { handlerRegistration: true },
      });

      return toPublic(payment);
    });
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPublic(row: PaymentRow): PaymentPublicDto {
  const handlerName =
    [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
      .filter(Boolean)
      .join(' ') || 'Unnamed handler';

  return {
    id: row.id,
    tenantId: row.tenantId,
    handlerRegistrationId: row.handlerRegistrationId,
    handlerName,
    tradeCategory: row.handlerRegistration.tradeCategory,
    amount: row.amount.toString(),
    currency: row.currency,
    method: row.method,
    reference: row.reference,
    receiptNumber: row.receiptNumber,
    status: row.status,
    paidAt: row.paidAt.toISOString(),
    recordedBy: row.recordedBy,
    recordedAt: row.recordedAt.toISOString(),
    notes: row.notes,
  };
}

type PaymentRow = {
  id: string;
  tenantId: string;
  handlerRegistrationId: string;
  amount: { toString: () => string };
  currency: string;
  method: string;
  reference: string | null;
  receiptNumber: string | null;
  status: string;
  paidAt: Date;
  recordedBy: string | null;
  recordedAt: Date;
  notes: string | null;
  handlerRegistration: {
    firstName: string | null;
    lastName: string | null;
    tradeCategory: string | null;
  };
};
