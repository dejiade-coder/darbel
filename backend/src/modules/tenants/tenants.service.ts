import { Injectable } from '@nestjs/common';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import { PasswordService } from '../auth/password.service';
import { ResourceConflictException, ResourceNotFoundException } from '../../common/errors/domain.exceptions';
import type { CreateTenantDto, UpdateTenantStatusDto } from './tenants.dto';

export interface TenantPublicDto {
  id: string;
  code: string;
  legalName: string;
  displayName: string;
  contactEmail: string;
  contactPhone: string | null;
  isActive: boolean;
  createdAt: string;
  userCount: number;
}

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}

  async list(ctx: ActorContext): Promise<TenantPublicDto[]> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const tenants = await tx.tenant.findMany({
        orderBy: [{ isPlatformOperator: 'desc' }, { displayName: 'asc' }],
        include: { _count: { select: { users: true } } },
      });
      return tenants.map(toPublic);
    });
  }

  async create(ctx: ActorContext, dto: CreateTenantDto): Promise<TenantPublicDto> {
    this.passwords.enforcePolicy(dto.initialPassword, [dto.adminEmail, dto.adminName]);
    const passwordHash = await this.passwords.hash(dto.initialPassword);

    return this.prisma.runWithContext(ctx, async (tx) => {
      const existing = await tx.tenant.findUnique({ where: { code: dto.code } });
      if (existing) throw new ResourceConflictException('A tenant with this code already exists');

      const jurisdiction = await tx.jurisdiction.findFirst({ where: { isActive: true }, orderBy: { code: 'asc' } });
      if (!jurisdiction) throw new ResourceNotFoundException('Active jurisdiction');
      const adminRole = await tx.role.findFirst({ where: { code: 'TENANT_ADMIN', tenantId: null } });
      if (!adminRole) throw new ResourceNotFoundException('TENANT_ADMIN role');

      const tenant = await tx.tenant.create({
        data: {
          code: dto.code,
          legalName: dto.legalName,
          displayName: dto.displayName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone || null,
          jurisdictionId: jurisdiction.id,
        },
      });
      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.adminEmail,
          fullName: dto.adminName,
          phone: dto.adminPhone || null,
          passwordHash,
          mustChangePassword: true,
          createdBy: ctx.userId,
        },
      });
      await tx.userRole.create({ data: { userId: admin.id, roleId: adminRole.id, assignedBy: ctx.userId } });
      return toPublic({ ...tenant, _count: { users: 1 } });
    });
  }

  async updateStatus(ctx: ActorContext, id: string, dto: UpdateTenantStatusDto): Promise<TenantPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
      if (!tenant) throw new ResourceNotFoundException('Tenant', id);
      if (tenant.isPlatformOperator && !dto.isActive) throw new ResourceConflictException('The platform operator cannot be suspended');
      const updated = await tx.tenant.update({ where: { id }, data: { isActive: dto.isActive }, include: { _count: { select: { users: true } } } });
      return toPublic(updated);
    });
  }
}

function toPublic(tenant: {
  id: string; code: string; legalName: string; displayName: string; contactEmail: string;
  contactPhone: string | null; isActive: boolean; createdAt: Date; _count: { users: number };
}): TenantPublicDto {
  return { ...tenant, createdAt: tenant.createdAt.toISOString(), userCount: tenant._count.users };
}
