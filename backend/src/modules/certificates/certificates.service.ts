import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException } from '../../common/errors/domain.exceptions';

export interface CertificatePublicDto {
  id: string;
  uid: string;
  handlerRegistrationId: string;
  handlerName: string;
  handlerEmail: string | null;
  handlerPhone: string | null;
  tradeCategory: string | null;
  status: string;
  issuedAt: string;
  expiresAt: string;
}

export interface VerificationDto {
  uid: string;
  handlerName: string;
  tradeCategory: string | null;
  issuedAt: string;
  expiresAt: string;
  status: string;
}

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: ActorContext, q?: string): Promise<{ items: CertificatePublicDto[] }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.CertificateWhereInput = {};
      if (q) {
        where.OR = [
          { uid: { contains: q, mode: 'insensitive' } },
          { handlerRegistration: { firstName: { contains: q, mode: 'insensitive' } } },
          { handlerRegistration: { lastName: { contains: q, mode: 'insensitive' } } },
          { handlerRegistration: { phone: { contains: q, mode: 'insensitive' } } },
        ];
      }
      const items = await tx.certificate.findMany({
        where,
        include: { handlerRegistration: true },
        orderBy: { issuedAt: 'desc' },
        take: 100,
      });
      return { items: items.map(toPublic) };
    });
  }

  async verify(uid: string): Promise<VerificationDto> {
    const certificate = await this.prisma.auth.certificate.findUnique({
      where: { uid },
      include: { handlerRegistration: true },
    });
    if (!certificate) throw new ResourceNotFoundException('Certificate', uid);
    const now = new Date();
    const status =
      certificate.status === 'VALID' && certificate.expiresAt < now
        ? 'EXPIRED'
        : certificate.status;
    return {
      uid: certificate.uid,
      handlerName:
        [certificate.handlerRegistration.firstName, certificate.handlerRegistration.lastName]
          .filter(Boolean)
          .join(' ') || 'Unnamed handler',
      tradeCategory: certificate.handlerRegistration.tradeCategory,
      issuedAt: certificate.issuedAt.toISOString(),
      expiresAt: certificate.expiresAt.toISOString(),
      status,
    };
  }
}

function toPublic(row: CertificateRow): CertificatePublicDto {
  return {
    id: row.id,
    uid: row.uid,
    handlerRegistrationId: row.handlerRegistrationId,
    handlerName:
      [row.handlerRegistration.firstName, row.handlerRegistration.lastName]
        .filter(Boolean)
        .join(' ') || 'Unnamed handler',
    handlerEmail: row.handlerRegistration.email,
    handlerPhone: row.handlerRegistration.phone,
    tradeCategory: row.handlerRegistration.tradeCategory,
    status: row.status,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

type CertificateRow = {
  id: string;
  uid: string;
  handlerRegistrationId: string;
  status: string;
  issuedAt: Date;
  expiresAt: Date;
  handlerRegistration: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    tradeCategory: string | null;
  };
};
