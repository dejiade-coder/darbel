import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import type { ListAuditQueryDto } from './audit.dto';

export interface AuditEntryDto {
  id: string; // bigint serialized
  occurredAt: string;
  tenantId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  tableName: string;
  recordId: string;
  changedFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  // Note: beforeState/afterState are omitted from the list response by
  // default to keep responses light and to avoid leaking redacted noise.
  // A dedicated detail endpoint returns them.
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    ctx: ActorContext,
    query: ListAuditQueryDto,
  ): Promise<{ items: AuditEntryDto[]; nextCursor: string | null }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.AuditLogWhereInput = {};
      if (query.actorUserId) where.actorUserId = query.actorUserId;
      if (query.tableName) where.tableName = query.tableName;
      if (query.action) where.action = query.action;
      if (query.fromDate || query.toDate) {
        const dateFilter: { gte?: Date; lte?: Date } = {};
        if (query.fromDate) dateFilter.gte = query.fromDate;
        if (query.toDate) dateFilter.lte = query.toDate;
        where.occurredAt = dateFilter;
      }
      // RLS already restricts by tenant; no need to add tenantId filter here.

      const take = query.limit + 1;
      const cursorObj = query.cursor ? { id: BigInt(query.cursor) } : undefined;

      const rows = await tx.auditLog.findMany({
        where,
        orderBy: { id: 'desc' },
        take,
        ...(cursorObj ? { cursor: cursorObj, skip: 1 } : {}),
      });

      const hasMore = rows.length > query.limit;
      const sliced = hasMore ? rows.slice(0, query.limit) : rows;
      return {
        items: sliced.map((r: AuditLogRow) => ({
          id: r.id.toString(),
          occurredAt: r.occurredAt.toISOString(),
          tenantId: r.tenantId,
          actorUserId: r.actorUserId,
          actorEmail: r.actorEmail,
          action: r.action,
          tableName: r.tableName,
          recordId: r.recordId,
          changedFields: r.changedFields,
          ipAddress: r.ipAddress,
          userAgent: r.userAgent,
          requestId: r.requestId,
        })),
        nextCursor: hasMore ? sliced[sliced.length - 1]!.id.toString() : null,
      };
    });
  }

  async findOne(
    ctx: ActorContext,
    id: string,
  ): Promise<
    | (AuditEntryDto & {
        beforeState: unknown;
        afterState: unknown;
      })
    | null
  > {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const r = await tx.auditLog.findUnique({ where: { id: BigInt(id) } });
      if (!r) return null;
      return {
        id: r.id.toString(),
        occurredAt: r.occurredAt.toISOString(),
        tenantId: r.tenantId,
        actorUserId: r.actorUserId,
        actorEmail: r.actorEmail,
        action: r.action,
        tableName: r.tableName,
        recordId: r.recordId,
        changedFields: r.changedFields,
        ipAddress: r.ipAddress,
        userAgent: r.userAgent,
        requestId: r.requestId,
        beforeState: r.beforeState,
        afterState: r.afterState,
      };
    });
  }
}

// Local row shape used to annotate map callbacks. This keeps the file type-safe
// regardless of whether the Prisma client was generated with its native engine
// (which produces fully typed models) or in a network-restricted environment
// where the generator falls back to a stub. In production the generated types
// will be a strict superset of this shape.
type AuditLogRow = {
  id: bigint;
  occurredAt: Date;
  tenantId: string | null;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  tableName: string;
  recordId: string;
  beforeState: unknown;
  afterState: unknown;
  changedFields: string[];
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
};
