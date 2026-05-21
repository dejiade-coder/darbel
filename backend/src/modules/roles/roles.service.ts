import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import type { ListRolesQueryDto } from './roles.dto';

export interface RolePublicDto {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  tenantId: string | null;
  permissions: Array<{ code: string; module: string; isSensitive: boolean }>;
}

export interface PermissionPublicDto {
  code: string;
  module: string;
  description: string;
  isSensitive: boolean;
}

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: ActorContext, query: ListRolesQueryDto): Promise<RolePublicDto[]> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.RoleWhereInput = {
        OR: [
          ...(query.includeSystem ? [{ tenantId: null }] : []),
          { tenantId: ctx.tenantId },
        ],
      };
      const roles = await tx.role.findMany({
        where,
        include: {
          permissions: { include: { permission: true } },
        },
        orderBy: [{ isSystemRole: 'desc' }, { code: 'asc' }],
      });
      return roles.map((r: RoleWithPermissions) => ({
        id: r.id,
        code: r.code,
        displayName: r.displayName,
        description: r.description,
        isSystemRole: r.isSystemRole,
        tenantId: r.tenantId,
        permissions: r.permissions.map((rp: RolePermissionWithPermission) => ({
          code: rp.permission.code,
          module: rp.permission.module,
          isSensitive: rp.permission.isSensitive,
        })),
      }));
    });
  }

  async listPermissions(ctx: ActorContext): Promise<PermissionPublicDto[]> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const perms = await tx.permission.findMany({
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
      });
      return perms.map((p: PermissionRow) => ({
        code: p.code,
        module: p.module,
        description: p.description,
        isSensitive: p.isSensitive,
      }));
    });
  }
}

// Local types — see audit.service.ts for rationale.
type PermissionRow = {
  code: string;
  module: string;
  description: string;
  isSensitive: boolean;
};
type RolePermissionWithPermission = {
  permission: PermissionRow;
};
type RoleWithPermissions = {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  isSystemRole: boolean;
  tenantId: string | null;
  permissions: RolePermissionWithPermission[];
};
