import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import { ResourceConflictException, ResourceNotFoundException } from '../../common/errors/domain.exceptions';
import type {
  AppealCertificateDto,
  RecordCertificateDeliveryDto,
  RenewCertificateDto,
  RevokeCertificateDto,
  ReviewCertificateAppealDto,
} from './certificates.dto';

const NOTIFICATION_PROVIDERS_KEY = 'notification_providers';
const MESSAGE_TEMPLATES_KEY = 'message_templates';

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
  revokedAt: string | null;
  revokeReason: string | null;
  latestDelivery: CertificateDeliveryPublicDto | null;
  latestAppeal: CertificateAppealPublicDto | null;
}

export interface CertificateDeliveryPublicDto {
  id: string;
  channel: string;
  deliveryStatus: string;
  recipient: string | null;
  messagePreview: string | null;
  performedAt: string;
}

export interface VerificationDto {
  uid: string;
  handlerName: string;
  tradeCategory: string | null;
  issuedAt: string;
  expiresAt: string;
  status: string;
}

export interface CertificateAppealPublicDto {
  channel: string;
  status: string;
  notes: string | null;
  performedAt: string;
}

@Injectable()
export class CertificatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(ctx: ActorContext, q?: string, status?: string): Promise<{ items: CertificatePublicDto[] }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const where: Prisma.CertificateWhereInput = {};
      if (status === 'EXPIRED') {
        where.status = { not: 'REVOKED' };
        where.expiresAt = { lt: new Date() };
      } else if (status === 'VALID') {
        where.status = 'VALID';
        where.expiresAt = { gte: new Date() };
      } else if (status === 'UNDER_APPEAL') {
        where.status = 'UNDER_APPEAL';
      } else if (status) {
        where.status = status;
      }
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
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 10,
          },
        },
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

  async recordDelivery(
    ctx: ActorContext,
    certificateId: string,
    dto: RecordCertificateDeliveryDto,
  ): Promise<CertificateDeliveryPublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: { handlerRegistration: true },
      });
      if (!certificate) throw new ResourceNotFoundException('Certificate', certificateId);
      const [providersSetting, templatesSetting] = await Promise.all([
        tx.tenantSetting.findUnique({
          where: {
            tenantId_settingKey: {
              tenantId: certificate.tenantId,
              settingKey: NOTIFICATION_PROVIDERS_KEY,
            },
          },
        }),
        tx.tenantSetting.findUnique({
          where: {
            tenantId_settingKey: {
              tenantId: certificate.tenantId,
              settingKey: MESSAGE_TEMPLATES_KEY,
            },
          },
        }),
      ]);
      const recipient = emptyToNull(dto.recipient);
      const providers = normalizeNotificationProviders(providersSetting?.settingValue);
      const templates = normalizeMessageTemplates(templatesSetting?.settingValue);
      const handlerName =
        [certificate.handlerRegistration.firstName, certificate.handlerRegistration.lastName]
          .filter(Boolean)
          .join(' ') || 'Unnamed handler';
      const verificationUrl = emptyToNull(dto.verificationUrl);
      const rendered = renderCertificateReadyTemplate(templates.certificateReady, {
        handlerName,
        uid: certificate.uid,
        verificationUrl: verificationUrl ?? '',
      });
      const notification = buildNotificationMetadata(dto.channel, recipient, providers, rendered, verificationUrl);

      const delivery = await tx.certificateDelivery.create({
        data: {
          tenantId: certificate.tenantId,
          certificateId: certificate.id,
          channel: dto.channel,
          deliveryStatus: notification.status,
          recipient,
          deliveryUrl: emptyToNull(dto.deliveryUrl),
          messagePreview: emptyToNull(dto.messagePreview) ?? notification.preview,
          performedBy: ctx.userId,
          metadata: notification.metadata,
        },
      });

      return toDeliveryPublic(delivery);
    });
  }

  async revoke(
    ctx: ActorContext,
    certificateId: string,
    dto: RevokeCertificateDto,
  ): Promise<CertificatePublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!certificate) throw new ResourceNotFoundException('Certificate', certificateId);
      if (certificate.status === 'REVOKED') {
        throw new ResourceConflictException('This certificate has already been revoked');
      }

      const revoked = await tx.certificate.update({
        where: { id: certificateId },
        data: {
          status: 'REVOKED',
          revokedBy: ctx.userId,
          revokedAt: new Date(),
          revokeReason: dto.reason,
        },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 1,
          },
        },
      });

      return toPublic(revoked);
    });
  }

  async renew(
    ctx: ActorContext,
    certificateId: string,
    dto: RenewCertificateDto,
  ): Promise<CertificatePublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!certificate) throw new ResourceNotFoundException('Certificate', certificateId);
      if (certificate.status === 'REVOKED' || certificate.status === 'UNDER_APPEAL') {
        throw new ResourceConflictException('Revoked certificates cannot be renewed');
      }

      const renewed = await tx.certificate.update({
        where: { id: certificateId },
        data: {
          status: 'VALID',
          expiresAt: addDays(new Date(), dto.validityDays),
        },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 1,
          },
        },
      });

      return toPublic(renewed);
    });
  }

  async appeal(
    ctx: ActorContext,
    certificateId: string,
    dto: AppealCertificateDto,
  ): Promise<CertificatePublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 10,
          },
        },
      });
      if (!certificate) throw new ResourceNotFoundException('Certificate', certificateId);
      if (certificate.status !== 'REVOKED') {
        throw new ResourceConflictException('Only revoked certificates can be submitted for appeal');
      }

      await tx.certificateDelivery.create({
        data: {
          tenantId: certificate.tenantId,
          certificateId: certificate.id,
          channel: 'APPEAL',
          deliveryStatus: 'SUBMITTED',
          recipient: null,
          messagePreview: dto.reason,
          performedBy: ctx.userId,
          metadata: {
            appeal: {
              status: 'SUBMITTED',
              reason: dto.reason,
              submittedAt: new Date().toISOString(),
            },
          },
        },
      });

      const appealed = await tx.certificate.update({
        where: { id: certificateId },
        data: { status: 'UNDER_APPEAL' },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 10,
          },
        },
      });

      return toPublic(appealed);
    });
  }

  async reviewAppeal(
    ctx: ActorContext,
    certificateId: string,
    dto: ReviewCertificateAppealDto,
  ): Promise<CertificatePublicDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const certificate = await tx.certificate.findUnique({
        where: { id: certificateId },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 10,
          },
        },
      });
      if (!certificate) throw new ResourceNotFoundException('Certificate', certificateId);
      if (certificate.status !== 'UNDER_APPEAL') {
        throw new ResourceConflictException('Only certificates under appeal can be reviewed');
      }

      const approved = dto.decision === 'APPROVE';
      await tx.certificateDelivery.create({
        data: {
          tenantId: certificate.tenantId,
          certificateId: certificate.id,
          channel: approved ? 'APPEAL_APPROVED' : 'APPEAL_REJECTED',
          deliveryStatus: approved ? 'APPROVED' : 'REJECTED',
          recipient: null,
          messagePreview: dto.notes,
          performedBy: ctx.userId,
          metadata: {
            appeal: {
              status: approved ? 'APPROVED' : 'REJECTED',
              notes: dto.notes,
              validityDays: approved ? dto.validityDays : null,
              reviewedAt: new Date().toISOString(),
            },
          },
        },
      });

      const reviewed = await tx.certificate.update({
        where: { id: certificateId },
        data: approved
          ? {
              status: 'VALID',
              expiresAt: addDays(new Date(), dto.validityDays),
              revokedBy: null,
              revokedAt: null,
              revokeReason: null,
            }
          : { status: 'REVOKED' },
        include: {
          handlerRegistration: true,
          deliveries: {
            orderBy: { performedAt: 'desc' },
            take: 10,
          },
        },
      });

      return toPublic(reviewed);
    });
  }
}

function toPublic(row: CertificateRow): CertificatePublicDto {
  const latestDelivery = row.deliveries.find((delivery) => isDeliveryChannel(delivery.channel)) ?? null;
  const latestAppeal = row.deliveries.find((delivery) => isAppealChannel(delivery.channel)) ?? null;
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
    revokedAt: row.revokedAt?.toISOString() ?? null,
    revokeReason: row.revokeReason,
    latestDelivery: latestDelivery ? toDeliveryPublic(latestDelivery) : null,
    latestAppeal: toAppealPublic(latestAppeal),
  };
}

function toDeliveryPublic(row: CertificateDeliveryRow): CertificateDeliveryPublicDto {
  return {
    id: row.id,
    channel: row.channel,
    deliveryStatus: row.deliveryStatus,
    recipient: row.recipient,
    messagePreview: row.messagePreview,
    performedAt: row.performedAt.toISOString(),
  };
}

function toAppealPublic(row: CertificateDeliveryRow | null): CertificateAppealPublicDto | null {
  if (!row) return null;
  return {
    channel: row.channel,
    status: row.deliveryStatus,
    notes: row.messagePreview,
    performedAt: row.performedAt.toISOString(),
  };
}

function isDeliveryChannel(channel: string): boolean {
  return channel === 'PRINT' || channel === 'EMAIL' || channel === 'WHATSAPP';
}

function isAppealChannel(channel: string): boolean {
  return channel === 'APPEAL' || channel === 'APPEAL_APPROVED' || channel === 'APPEAL_REJECTED';
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

type CertificateRow = {
  id: string;
  uid: string;
  handlerRegistrationId: string;
  status: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  deliveries: CertificateDeliveryRow[];
  handlerRegistration: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    tradeCategory: string | null;
  };
};

type CertificateDeliveryRow = {
  id: string;
  channel: string;
  deliveryStatus: string;
  recipient: string | null;
  messagePreview: string | null;
  performedAt: Date;
};

type StoredNotificationProviders = {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPassword?: string | null;
  emailFromAddress: string | null;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumberId: string | null;
  whatsAppAccessToken?: string | null;
};

type MessageTemplate = {
  subject: string;
  body: string;
  whatsApp: string;
};

type StoredMessageTemplates = {
  certificateReady: MessageTemplate;
};

type RenderedTemplate = {
  subject: string;
  body: string;
  whatsApp: string;
};

function normalizeNotificationProviders(value: unknown): StoredNotificationProviders {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<StoredNotificationProviders>;
  return {
    emailEnabled: raw.emailEnabled ?? false,
    smtpHost: raw.smtpHost ?? null,
    smtpPassword: raw.smtpPassword ?? null,
    emailFromAddress: raw.emailFromAddress ?? null,
    whatsAppEnabled: raw.whatsAppEnabled ?? false,
    whatsAppPhoneNumberId: raw.whatsAppPhoneNumberId ?? null,
    whatsAppAccessToken: raw.whatsAppAccessToken ?? null,
  };
}

function normalizeMessageTemplates(value: unknown): StoredMessageTemplates {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<StoredMessageTemplates>;
  return {
    certificateReady: normalizeMessageTemplate(raw.certificateReady, DEFAULT_CERTIFICATE_READY_TEMPLATE),
  };
}

function normalizeMessageTemplate(value: Partial<MessageTemplate> | undefined, fallback: MessageTemplate): MessageTemplate {
  return {
    subject: value?.subject?.trim() || fallback.subject,
    body: value?.body?.trim() || fallback.body,
    whatsApp: value?.whatsApp?.trim() || fallback.whatsApp,
  };
}

function renderCertificateReadyTemplate(
  template: MessageTemplate,
  tokens: { handlerName: string; uid: string; verificationUrl: string },
): RenderedTemplate {
  return {
    subject: renderTokens(template.subject, tokens),
    body: renderTokens(template.body, tokens),
    whatsApp: renderTokens(template.whatsApp, tokens),
  };
}

function renderTokens(value: string, tokens: { handlerName: string; uid: string; verificationUrl: string }): string {
  return value
    .replaceAll('{{handlerName}}', tokens.handlerName)
    .replaceAll('{{uid}}', tokens.uid)
    .replaceAll('{{verificationUrl}}', tokens.verificationUrl);
}

function buildNotificationMetadata(
  channel: string,
  recipient: string | null,
  providers: StoredNotificationProviders,
  rendered: RenderedTemplate,
  verificationUrl: string | null,
): { status: string; preview: string; metadata: Prisma.InputJsonObject } {
  if (channel === 'PRINT') {
    return {
      status: 'RECORDED',
      preview: rendered.body,
      metadata: {
        notification: {
          status: 'RECORDED',
          reason: 'Printed certificate delivery recorded.',
          verificationUrl,
          renderedAt: new Date().toISOString(),
        },
      },
    };
  }

  if (!recipient) {
    return notificationResult('MISSING_RECIPIENT', 'Applicant recipient is missing.', channel, rendered, verificationUrl);
  }

  if (channel === 'EMAIL') {
    const configured = Boolean(
      providers.emailEnabled &&
        providers.smtpHost &&
        providers.emailFromAddress &&
        providers.smtpPassword,
    );
    return notificationResult(
      configured ? 'QUEUED' : 'NEEDS_PROVIDER',
      configured ? 'Email provider is configured; ready for SMTP delivery.' : 'Email provider settings are incomplete.',
      channel,
      rendered,
      verificationUrl,
    );
  }

  const configured = Boolean(
    providers.whatsAppEnabled &&
      providers.whatsAppPhoneNumberId &&
      providers.whatsAppAccessToken,
  );
  return notificationResult(
    configured ? 'QUEUED' : 'NEEDS_PROVIDER',
    configured ? 'WhatsApp provider is configured; ready for Business API delivery.' : 'WhatsApp provider settings are incomplete.',
    channel,
    rendered,
    verificationUrl,
  );
}

function notificationResult(
  status: string,
  reason: string,
  channel: string,
  rendered: RenderedTemplate,
  verificationUrl: string | null,
): { status: string; preview: string; metadata: Prisma.InputJsonObject } {
  return {
    status,
    preview: channel === 'WHATSAPP' ? rendered.whatsApp : rendered.body,
    metadata: {
      notification: {
        status,
        reason,
        subject: rendered.subject,
        body: rendered.body,
        whatsApp: rendered.whatsApp,
        verificationUrl,
        renderedAt: new Date().toISOString(),
      },
    },
  };
}

const DEFAULT_CERTIFICATE_READY_TEMPLATE: MessageTemplate = {
  subject: 'Darbel certificate ready',
  body: 'Hello {{handlerName}}, your compliance certificate is ready. Certificate UID: {{uid}}. Authorized officers can scan the barcode on the printed certificate to view handler details.',
  whatsApp: 'Darbel certificate ready for {{handlerName}}. UID: {{uid}}. Officer barcode scan is required to reveal handler details.',
};
