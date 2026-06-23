import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import type { ListRolesQueryDto } from './roles.dto';
import type { CreateRoleDto } from './roles.dto';
import { ResourceConflictException, ResourceNotFoundException } from '../../common/errors/domain.exceptions';

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
      const actor = await tx.user.findUnique({ where: { id: ctx.userId }, include: { tenant: { select: { isPlatformOperator: true } } } });
      const where: Prisma.RoleWhereInput = {
        OR: [
          ...(query.includeSystem ? [{ tenantId: null, ...(actor?.tenant.isPlatformOperator ? {} : { code: { not: 'SUPER_ADMIN' } }) }] : []),
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
      const actor = await tx.user.findUnique({ where: { id: ctx.userId }, include: { tenant: { select: { isPlatformOperator: true } } } });
      const perms = await tx.permission.findMany({
        where: actor?.tenant.isPlatformOperator ? undefined : { code: { not: 'platform.manage' } },
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

  async create(ctx: ActorContext, dto: CreateRoleDto): Promise<RolePublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      if (dto.permissionCodes.includes('platform.manage')) {
        throw new ResourceNotFoundException('Permission', 'platform.manage');
      }
      const existing = await tx.role.findFirst({ where: { code: dto.code, tenantId: ctx.tenantId } });
      if (existing) throw new ResourceConflictException('A tenant role with this code already exists');
      const permissions = await tx.permission.findMany({ where: { code: { in: dto.permissionCodes } } });
      if (permissions.length !== new Set(dto.permissionCodes).size) {
        throw new ResourceNotFoundException('One or more permissions');
      }
      const role = await tx.role.create({
        data: {
          code: dto.code,
          displayName: dto.displayName,
          description: dto.description || null,
          tenantId: ctx.tenantId,
          permissions: { createMany: { data: permissions.map((permission) => ({ permissionId: permission.id, grantedBy: ctx.userId })) } },
        },
        include: { permissions: { include: { permission: true } } },
      });
      return {
        id: role.id, code: role.code, displayName: role.displayName, description: role.description,
        isSystemRole: role.isSystemRole, tenantId: role.tenantId,
        permissions: role.permissions.map((rp) => ({ code: rp.permission.code, module: rp.permission.module, isSensitive: rp.permission.isSensitive })),
      };
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
