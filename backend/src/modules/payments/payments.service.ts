import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
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
  approvedBy: string | null;
  approvedAt: string | null;
  registrationUid: string | null;
  registrationHasApprovedPayment: boolean;
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
      const registrationIds = [...new Set(sliced.map((item) => item.handlerRegistrationId))];
      const approvedPayments = registrationIds.length
        ? await tx.payment.findMany({
            where: {
              handlerRegistrationId: { in: registrationIds },
              status: 'APPROVED',
            },
            select: { handlerRegistrationId: true },
          })
        : [];
      const approvedRegistrationIds = new Set(
        approvedPayments.map((payment) => payment.handlerRegistrationId),
      );
      return {
        items: sliced.map((payment) =>
          toPublic(payment, approvedRegistrationIds.has(payment.handlerRegistrationId)),
        ),
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

      const existingActivePayment = await tx.payment.findFirst({
        where: {
          handlerRegistrationId: dto.handlerRegistrationId,
          status: { in: ['RECORDED', 'APPROVED'] },
        },
      });
      if (existingActivePayment) {
        throw new ResourceConflictException(
          'This registration already has an active payment record',
        );
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

  async approve(ctx: ActorContext, id: string): Promise<PaymentPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id },
        include: { handlerRegistration: true },
      });
      if (!payment) throw new ResourceNotFoundException('Payment', id);
      if (payment.status !== 'RECORDED') {
        throw new ResourceConflictException('Only recorded payments can be approved');
      }

      const existingApprovedPayment = await tx.payment.findFirst({
        where: {
          handlerRegistrationId: payment.handlerRegistrationId,
          status: 'APPROVED',
          id: { not: id },
        },
      });
      if (existingApprovedPayment) {
        throw new ResourceConflictException(
          'This registration already has an approved payment',
        );
      }

      let registrationUid = payment.handlerRegistration.uid;
      if (!registrationUid) {
        const tenant = await tx.tenant.findUnique({
          where: { id: payment.tenantId },
          select: { code: true, isPlatformOperator: true },
        });
        if (!tenant) throw new ResourceNotFoundException('Tenant', payment.tenantId);
        registrationUid = await issueRegistrationUid(
          tx,
          payment.handlerRegistrationId,
          getTenantUidPrefix(tenant),
          ctx.userId,
        );
      }

      await tx.handlerRegistration.update({
        where: { id: payment.handlerRegistrationId },
        data: {
          status: 'READY_FOR_SCREENING',
          updatedBy: ctx.userId,
        },
      });

      const approved = await tx.payment.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: ctx.userId,
          approvedAt: new Date(),
        },
        include: { handlerRegistration: true },
      });

      return toPublic({
        ...approved,
        handlerRegistration: {
          ...approved.handlerRegistration,
          uid: registrationUid,
        },
      });
    });
  }
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPublic(row: PaymentRow, registrationHasApprovedPayment?: boolean): PaymentPublicDto {
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
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    registrationUid: row.handlerRegistration.uid,
    registrationHasApprovedPayment:
      registrationHasApprovedPayment ?? row.status === 'APPROVED',
    notes: row.notes,
  };
}

async function issueRegistrationUid(
  tx: Prisma.TransactionClient,
  registrationId: string,
  tenantPrefix: string,
  issuedBy: string,
): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const uid = generateUid(tenantPrefix);
    try {
      await tx.handlerRegistration.update({
        where: { id: registrationId },
        data: {
          uid,
          uidIssuedAt: new Date(),
          uidIssuedBy: issuedBy,
        },
      });
      return uid;
    } catch (error) {
      if (isUniqueConstraintError(error)) continue;
      throw error;
    }
  }

  throw new ResourceConflictException('Could not issue a unique registration UID');
}

function generateUid(tenantPrefix: string): string {
  const randomPart = randomBase32(6);
  const checksum = checksumBase32(`${tenantPrefix}${randomPart}`);
  return `${tenantPrefix}-${randomPart}-${checksum}`;
}

function getTenantUidPrefix(tenant: { code: string; isPlatformOperator: boolean }): string {
  if (tenant.isPlatformOperator) return 'BBH';
  const letters = tenant.code.toUpperCase().replace(/[^A-Z]/g, '');
  return (letters + 'XXX').slice(0, 3);
}

function randomBase32(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = randomBytes(length);
  let output = '';
  for (const byte of bytes) {
    output += alphabet[byte % alphabet.length];
  }
  return output;
}

function checksumBase32(value: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let sum = 0;
  for (const char of value) {
    sum = (sum * 31 + char.charCodeAt(0)) % alphabet.length;
  }
  return alphabet[sum];
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
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
  approvedBy: string | null;
  approvedAt: Date | null;
  notes: string | null;
  handlerRegistration: {
    firstName: string | null;
    lastName: string | null;
    tradeCategory: string | null;
    uid: string | null;
  };
};
