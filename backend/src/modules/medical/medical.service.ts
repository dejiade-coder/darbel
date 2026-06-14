import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';
import type {
  CreateScreeningDto,
  EnterResultDto,
  ListScreeningsQueryDto,
  ReviewScreeningDto,
} from './medical.dto';

export interface MedicalScreeningPublicDto {
  id: string;
  handlerRegistrationId: string;
  handlerName: string;
  uid: string | null;
  tradeCategory: string | null;
  status: string;
  fitnessStatus: string | null;
  labResultSummary: string | null;
  mantouxResult: string | null;
  mantouxIndurationMm: number | null;
  hepatitisBResult: string | null;
  hivResult: string | null;
  widalResult: string | null;
  medicalOfficerNotes: string | null;
  sampleCollectedAt: string | null;
  enteredAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export interface MedicalReadyRegistrationDto {
  id: string;
  uid: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  tradeCategory: string | null;
  approvedPaymentAt: string | null;
}

@Injectable()
export class MedicalService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: ActorContext,
    query: ListScreeningsQueryDto,
  ): Promise<{ items: MedicalScreeningPublicDto[] }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.MedicalScreeningWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.q) {
        where.handlerRegistration = {
          AND: buildRegistrationSearchClauses(query.q),
        };
      }
      const items = await tx.medicalScreening.findMany({
        where,
        include: { handlerRegistration: true },
        orderBy: { createdAt: 'desc' },
        take: query.limit,
      });
      return { items: items.map(toPublic) };
    });
  }

  async readyQueue(
    ctx: ActorContext,
    q?: string,
  ): Promise<{ items: MedicalReadyRegistrationDto[] }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.HandlerRegistrationWhereInput = {
        uid: { not: null },
        payments: { some: { status: 'APPROVED' } },
        medicalScreening: { is: null },
        status: { not: 'CANCELLED' },
      };
      if (q) {
        where.AND = buildRegistrationSearchClauses(q);
      }

      const items = await tx.handlerRegistration.findMany({
        where,
        include: {
          payments: {
            where: { status: 'APPROVED' },
            orderBy: { approvedAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      });

      return {
        items: items.map((item) => ({
          id: item.id,
          uid: item.uid,
          firstName: item.firstName,
          lastName: item.lastName,
          phone: item.phone,
          tradeCategory: item.tradeCategory,
          approvedPaymentAt: item.payments[0]?.approvedAt?.toISOString() ?? null,
        })),
      };
    });
  }

  async create(ctx: ActorContext, dto: CreateScreeningDto): Promise<MedicalScreeningPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registration = await tx.handlerRegistration.findUnique({
        where: { id: dto.handlerRegistrationId },
      });
      if (!registration) throw new ResourceNotFoundException('Registration', dto.handlerRegistrationId);
      const approvedPayment = await tx.payment.findFirst({
        where: {
          handlerRegistrationId: dto.handlerRegistrationId,
          status: 'APPROVED',
        },
      });
      if (!approvedPayment || !registration.uid) {
        throw new ResourceConflictException('Registration must have an approved payment and UID before screening');
      }

      const screening = await tx.medicalScreening.create({
        data: {
          tenantId: ctx.tenantId,
          handlerRegistrationId: dto.handlerRegistrationId,
          sampleCollectedBy: ctx.userId,
          sampleCollectedAt: new Date(),
        },
        include: { handlerRegistration: true },
      });
      return toPublic(screening);
    });
  }

  async enterResult(
    ctx: ActorContext,
    id: string,
    dto: EnterResultDto,
  ): Promise<MedicalScreeningPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const screening = await tx.medicalScreening.findUnique({ where: { id } });
      if (!screening) throw new ResourceNotFoundException('Medical screening', id);
      if (!['SAMPLE_COLLECTED', 'RESULT_ENTERED'].includes(screening.status)) {
        throw new ResourceConflictException('This screening is already reviewed');
      }
      const updated = await tx.medicalScreening.update({
        where: { id },
        data: {
          status: 'RESULT_ENTERED',
          labResultSummary: emptyToNull(dto.labResultSummary),
          mantouxResult: dto.mantouxResult,
          mantouxIndurationMm: dto.mantouxIndurationMm ?? null,
          hepatitisBResult: dto.hepatitisBResult,
          hivResult: dto.hivResult,
          widalResult: dto.widalResult,
          medicalOfficerNotes: emptyToNull(dto.medicalOfficerNotes),
          fitnessStatus: dto.fitnessStatus,
          enteredBy: ctx.userId,
          enteredAt: new Date(),
        },
        include: { handlerRegistration: true },
      });
      return toPublic(updated);
    });
  }

  async review(
    ctx: ActorContext,
    id: string,
    dto: ReviewScreeningDto,
  ): Promise<MedicalScreeningPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const screening = await tx.medicalScreening.findUnique({
        where: { id },
        include: { handlerRegistration: true },
      });
      if (!screening) throw new ResourceNotFoundException('Medical screening', id);
      if (screening.status !== 'RESULT_ENTERED') {
        throw new ResourceConflictException('Enter lab results before review');
      }
      if (dto.approved && screening.fitnessStatus !== 'FIT') {
        throw new ResourceConflictException('Only FIT results can be approved for certification');
      }

      const reviewed = await tx.medicalScreening.update({
        where: { id },
        data: {
          status: dto.approved ? 'APPROVED' : 'REJECTED',
          reviewedBy: ctx.userId,
          reviewedAt: new Date(),
          reviewNotes: emptyToNull(dto.reviewNotes),
        },
        include: { handlerRegistration: true },
      });

      if (dto.approved) {
        const existing = await tx.certificate.findFirst({
          where: { handlerRegistrationId: screening.handlerRegistrationId, status: 'VALID' },
        });
        if (!existing && screening.handlerRegistration.uid) {
          await tx.certificate.create({
            data: {
              tenantId: screening.tenantId,
              handlerRegistrationId: screening.handlerRegistrationId,
              medicalScreeningId: id,
              uid: screening.handlerRegistration.uid,
              issuedBy: ctx.userId,
              expiresAt: addDays(new Date(), 365),
            },
          });
        }
      }

      return toPublic(reviewed);
    });
  }
}

function toPublic(row: ScreeningRow): MedicalScreeningPublicDto {
  const handlerName =
    [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
      .filter(Boolean)
      .join(' ') || 'Unnamed handler';
  return {
    id: row.id,
    handlerRegistrationId: row.handlerRegistrationId,
    handlerName,
    uid: row.handlerRegistration.uid,
    tradeCategory: row.handlerRegistration.tradeCategory,
    status: row.status,
    fitnessStatus: row.fitnessStatus,
    labResultSummary: row.labResultSummary,
    mantouxResult: row.mantouxResult,
    mantouxIndurationMm: row.mantouxIndurationMm,
    hepatitisBResult: row.hepatitisBResult,
    hivResult: row.hivResult,
    widalResult: row.widalResult,
    medicalOfficerNotes: row.medicalOfficerNotes,
    sampleCollectedAt: row.sampleCollectedAt?.toISOString() ?? null,
    enteredAt: row.enteredAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNotes: row.reviewNotes,
  };
}

function buildRegistrationSearchClauses(query: string): Prisma.HandlerRegistrationWhereInput[] {
  const tokens = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);

  if (tokens.length <= 1) {
    const value = tokens[0] ?? query.trim();
    return [buildRegistrationTokenSearch(value)];
  }

  return tokens.map(buildRegistrationTokenSearch);
}

function buildRegistrationTokenSearch(token: string): Prisma.HandlerRegistrationWhereInput {
  return {
    OR: [
      { uid: { contains: token, mode: 'insensitive' } },
      { firstName: { contains: token, mode: 'insensitive' } },
      { lastName: { contains: token, mode: 'insensitive' } },
      { phone: { contains: token, mode: 'insensitive' } },
      { tradeCategory: { contains: token, mode: 'insensitive' } },
      { businessName: { contains: token, mode: 'insensitive' } },
    ],
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

type ScreeningRow = {
  id: string;
  handlerRegistrationId: string;
  status: string;
  fitnessStatus: string | null;
  labResultSummary: string | null;
  mantouxResult: string | null;
  mantouxIndurationMm: number | null;
  hepatitisBResult: string | null;
  hivResult: string | null;
  widalResult: string | null;
  medicalOfficerNotes: string | null;
  sampleCollectedAt: Date | null;
  enteredAt: Date | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  handlerRegistration: {
    firstName: string | null;
    lastName: string | null;
    uid: string | null;
    tradeCategory: string | null;
  };
};
