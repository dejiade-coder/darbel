import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';
import type {
  ListRegistrationsQueryDto,
  UpsertRegistrationDto,
} from './registrations.dto';

export interface RegistrationPublicDto {
  id: string;
  tenantId: string;
  registrarUserId: string;
  registrarName: string;
  registrarEmail: string;
  registrarPhone: string | null;
  registrationDate: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  tradeCategory: string | null;
  businessName: string | null;
  businessAddress: string | null;
  passportPhotoReceived: boolean;
  uid: string | null;
  uidIssuedAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
}

@Injectable()
export class RegistrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: ActorContext,
    query: ListRegistrationsQueryDto,
  ): Promise<{ items: RegistrationPublicDto[]; nextCursor: string | null }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.HandlerRegistrationWhereInput = {};
      if (query.status) where.status = query.status;
      if (query.q) {
        where.AND = buildRegistrationSearchClauses(query.q);
      }

      const take = query.limit + 1;
      const items = await tx.handlerRegistration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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

  async findById(ctx: ActorContext, id: string): Promise<RegistrationPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registration = await tx.handlerRegistration.findUnique({ where: { id } });
      if (!registration) throw new ResourceNotFoundException('Registration', id);
      return toPublic(registration);
    });
  }

  async create(ctx: ActorContext, dto: UpsertRegistrationDto): Promise<RegistrationPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registrar = await tx.user.findUnique({ where: { id: ctx.userId } });
      if (!registrar || !registrar.isActive || registrar.deletedAt) {
        throw new ResourceNotFoundException('Active registrar user', ctx.userId);
      }

      const created = await tx.handlerRegistration.create({
        data: {
          ...toWriteData(dto),
          tenantId: ctx.tenantId,
          registrarUserId: ctx.userId,
          registrarName: registrar.fullName,
          registrarEmail: registrar.email,
          registrarPhone: registrar.phone,
          submittedAt: dto.status === 'SUBMITTED_FOR_REVIEW' ? new Date() : null,
          createdBy: ctx.userId,
          updatedBy: ctx.userId,
        },
      });
      return toPublic(created);
    });
  }

  async update(
    ctx: ActorContext,
    id: string,
    dto: UpsertRegistrationDto,
  ): Promise<RegistrationPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.handlerRegistration.findUnique({ where: { id } });
      if (!existing) throw new ResourceNotFoundException('Registration', id);

      const updated = await tx.handlerRegistration.update({
        where: { id },
        data: {
          ...toWriteData(dto),
          submittedAt:
            dto.status === 'SUBMITTED_FOR_REVIEW'
              ? existing.submittedAt ?? new Date()
              : existing.submittedAt,
          updatedBy: ctx.userId,
        },
      });
      return toPublic(updated);
    });
  }

  async cancel(ctx: ActorContext, id: string): Promise<RegistrationPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.handlerRegistration.findUnique({ where: { id } });
      if (!existing) throw new ResourceNotFoundException('Registration', id);
      if (existing.status !== 'DRAFT') {
        throw new ResourceConflictException('Only draft registrations can be cancelled');
      }

      const updated = await tx.handlerRegistration.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          updatedBy: ctx.userId,
        },
      });
      return toPublic(updated);
    });
  }
}

function toWriteData(dto: UpsertRegistrationDto) {
  return {
    registrationDate: new Date(`${dto.registrationDate}T00:00:00.000Z`),
    firstName: emptyToNull(dto.firstName),
    lastName: emptyToNull(dto.lastName),
    phone: emptyToNull(dto.phone),
    email: emptyToNull(dto.email),
    gender: emptyToNull(dto.gender),
    tradeCategory: emptyToNull(dto.tradeCategory),
    businessName: emptyToNull(dto.businessName),
    businessAddress: emptyToNull(dto.businessAddress),
    passportPhotoReceived: dto.passportPhotoReceived,
    status: dto.status,
  };
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPublic(row: HandlerRegistrationRow): RegistrationPublicDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    registrarUserId: row.registrarUserId,
    registrarName: row.registrarName,
    registrarEmail: row.registrarEmail,
    registrarPhone: row.registrarPhone,
    registrationDate: row.registrationDate.toISOString().slice(0, 10),
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    tradeCategory: row.tradeCategory,
    businessName: row.businessName,
    businessAddress: row.businessAddress,
    passportPhotoReceived: row.passportPhotoReceived,
    uid: row.uid,
    uidIssuedAt: row.uidIssuedAt?.toISOString() ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submittedAt: row.submittedAt?.toISOString() ?? null,
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
  const normalizedUid = token.trim().toUpperCase();
  const or: Prisma.HandlerRegistrationWhereInput[] = [
    { uid: { contains: normalizedUid, mode: 'insensitive' } },
    { firstName: { contains: token, mode: 'insensitive' } },
    { lastName: { contains: token, mode: 'insensitive' } },
    { phone: { contains: token, mode: 'insensitive' } },
    { tradeCategory: { contains: token, mode: 'insensitive' } },
    { businessName: { contains: token, mode: 'insensitive' } },
  ];

  if (isUuid(token)) {
    or.push({ id: { equals: token } });
  }

  return {
    OR: or,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

type HandlerRegistrationRow = {
  id: string;
  tenantId: string;
  registrarUserId: string;
  registrarName: string;
  registrarEmail: string;
  registrarPhone: string | null;
  registrationDate: Date;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  tradeCategory: string | null;
  businessName: string | null;
  businessAddress: string | null;
  passportPhotoReceived: boolean;
  uid: string | null;
  uidIssuedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  submittedAt: Date | null;
};
