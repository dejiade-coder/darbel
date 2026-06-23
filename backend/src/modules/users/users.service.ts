import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService, ActorContext } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';
import type {
  AssignRolesDto,
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserDto,
} from './users.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(ctx: ActorContext, dto: CreateUserDto): Promise<UserPublicDto> {
    this.passwordService.enforcePolicy(dto.initialPassword, [dto.email, dto.fullName]);
    const passwordHash = await this.passwordService.hash(dto.initialPassword);

    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { tenantId: ctx.tenantId, email: dto.email, deletedAt: null },
      });
      if (existing) {
        throw new ResourceConflictException('A user with this email already exists');
      }

      // Resolve roles — system roles (tenant_id NULL) or tenant-owned roles.
      const roles = await tx.role.findMany({
        where: {
          code: { in: dto.roleCodes },
          OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
        },
      });
      const found = new Set(roles.map((r: RoleBasic) => r.code));
      const missing = dto.roleCodes.filter((c) => !found.has(c));
      if (missing.length > 0) {
        throw new ResourceNotFoundException(`Role(s): ${missing.join(', ')}`);
      }
      await assertPlatformRoleAssignment(tx, ctx.userId, roles);

      const created = await tx.user.create({
        data: {
          tenantId: ctx.tenantId,
          email: dto.email,
          phone: dto.phone,
          fullName: dto.fullName,
          passwordHash,
          mustChangePassword: dto.mustChangePassword,
          createdBy: ctx.userId,
          roles: {
            createMany: {
              data: roles.map((r: RoleBasic) => ({ roleId: r.id, assignedBy: ctx.userId })),
            },
          },
        },
        include: { roles: { include: { role: true } } },
      });

      return toPublic(created);
    });
  }

  async findById(ctx: ActorContext, id: string): Promise<UserPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const user = await tx.user.findFirst({
        where: { id, deletedAt: null },
        include: { roles: { include: { role: true } } },
      });
      if (!user) throw new ResourceNotFoundException('User', id);
      return toPublic(user);
    });
  }

  async list(
    ctx: ActorContext,
    query: ListUsersQueryDto,
  ): Promise<{ items: UserPublicDto[]; nextCursor: string | null }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.UserWhereInput = {
        deletedAt: null,
      };
      if (query.isActive !== undefined) where.isActive = query.isActive;
      if (query.q) {
        where.OR = [
          { email: { contains: query.q, mode: 'insensitive' } },
          { fullName: { contains: query.q, mode: 'insensitive' } },
        ];
      }
      if (query.roleCode) {
        where.roles = { some: { role: { code: query.roleCode } } };
      }

      const take = query.limit + 1;
      const items = await tx.user.findMany({
        where,
        include: { roles: { include: { role: true } } },
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

  async update(
    ctx: ActorContext,
    id: string,
    dto: UpdateUserDto,
  ): Promise<UserPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) throw new ResourceNotFoundException('User', id);
      const updated = await tx.user.update({
        where: { id },
        data: {
          fullName: dto.fullName ?? undefined,
          phone: dto.phone === undefined ? undefined : dto.phone,
          isActive: dto.isActive ?? undefined,
        },
        include: { roles: { include: { role: true } } },
      });
      return toPublic(updated);
    });
  }

  async softDelete(ctx: ActorContext, id: string): Promise<void> {
    await this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!existing) throw new ResourceNotFoundException('User', id);
      if (existing.id === ctx.userId) {
        throw new ResourceConflictException('You cannot delete your own account');
      }
      await tx.user.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
      });
      // Revoke active sessions
      await tx.session.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async assignRoles(
    ctx: ActorContext,
    id: string,
    dto: AssignRolesDto,
  ): Promise<UserPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new ResourceNotFoundException('User', id);

      const roles = await tx.role.findMany({
        where: {
          code: { in: dto.roleCodes },
          OR: [{ tenantId: null }, { tenantId: ctx.tenantId }],
        },
      });
      const found = new Set(roles.map((r: RoleBasic) => r.code));
      const missing = dto.roleCodes.filter((c) => !found.has(c));
      if (missing.length > 0) {
        throw new ResourceNotFoundException(`Role(s): ${missing.join(', ')}`);
      }
      await assertPlatformRoleAssignment(tx, ctx.userId, roles);

      // Replace role set atomically
      await tx.userRole.deleteMany({ where: { userId: id } });
      if (roles.length > 0) {
        await tx.userRole.createMany({
          data: roles.map((r: RoleBasic) => ({
            userId: id,
            roleId: r.id,
            assignedBy: ctx.userId,
          })),
        });
      }

      const refreshed = await tx.user.findUnique({
        where: { id },
        include: { roles: { include: { role: true } } },
      });
      return toPublic(refreshed!);
    });
  }

  async resetPassword(ctx: ActorContext, id: string, temporaryPassword: string): Promise<void> {
    await this.prisma.runWithContext(ctx, async (tx) => {
      const user = await tx.user.findFirst({ where: { id, deletedAt: null } });
      if (!user) throw new ResourceNotFoundException('User', id);
      this.passwordService.enforcePolicy(temporaryPassword, [user.email, user.fullName]);
      const passwordHash = await this.passwordService.hash(temporaryPassword);
      await tx.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, passwordChangedAt: new Date(), isLocked: false, lockedUntil: null, failedLoginCount: 0 } });
      await tx.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    });
  }
}

// ---------------------------------------------------------------------------
// Public projection — never exposes passwordHash, mfaSecret, etc.
// ---------------------------------------------------------------------------
export interface UserPublicDto {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roles: Array<{ code: string; displayName: string }>;
}

type UserWithRoles = {
  id: string;
  tenantId: string;
  email: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  isLocked: boolean;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  roles: Array<{ role: { code: string; displayName: string } }>;
};

function toPublic(u: UserWithRoles): UserPublicDto {
  return {
    id: u.id,
    tenantId: u.tenantId,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone,
    isActive: u.isActive,
    isLocked: u.isLocked,
    mustChangePassword: u.mustChangePassword,
    mfaEnabled: u.mfaEnabled,
    lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    roles: u.roles.map((ur) => ({
      code: ur.role.code,
      displayName: ur.role.displayName,
    })),
  };
}

// Minimal role row used to type role lookup map callbacks. Falls back gracefully
// when Prisma client types are stubbed (e.g. when the engine binary cannot be
// fetched during generation in restricted environments).
type RoleBasic = { id: string; code: string };

async function assertPlatformRoleAssignment(tx: Prisma.TransactionClient, actorId: string, roles: RoleBasic[]): Promise<void> {
  if (!roles.some((role) => role.code === 'SUPER_ADMIN')) return;
  const actor = await tx.user.findUnique({ where: { id: actorId }, include: { tenant: { select: { isPlatformOperator: true } } } });
  if (!actor?.tenant.isPlatformOperator) throw new ResourceConflictException('Tenant administrators cannot assign the Super Admin role');
}
