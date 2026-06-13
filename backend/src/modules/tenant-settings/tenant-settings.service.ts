import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import { ResourceConflictException, ResourceNotFoundException } from '../../common/errors/domain.exceptions';
import type { UpdateMessageTemplatesDto, UpdateNotificationProvidersDto } from './tenant-settings.dto';

const TEMPLATE_KEY = 'certificate_template';
const NOTIFICATION_PROVIDERS_KEY = 'notification_providers';
const MESSAGE_TEMPLATES_KEY = 'message_templates';
const MAX_TEMPLATE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TEMPLATE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export interface UploadedTemplateFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

export interface CertificateTemplateDto {
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  sha256Hash: string;
  uploadedAt: string;
  approvedAt: string;
  isApproved: boolean;
  layout: CertificateTemplateLayout;
  fileUrl: string;
}

type StoredTemplate = Omit<CertificateTemplateDto, 'fileUrl'> & {
  storageKey: string;
};

export interface CertificateTemplateLayout {
  nameLeftPercent: number;
  nameTopPercent: number;
  nameWidthPercent: number;
  detailLeftPercent: number;
  detailTopPercent: number;
  detailWidthPercent: number;
  detailBottomPercent: number;
  detailInsetPercent: number;
  nameScale: number;
  detailScale: number;
  showVerification: boolean;
}

export interface NotificationProvidersDto {
  emailEnabled: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPasswordConfigured: boolean;
  emailFromName: string | null;
  emailFromAddress: string | null;
  whatsAppEnabled: boolean;
  whatsAppPhoneNumberId: string | null;
  whatsAppBusinessAccountId: string | null;
  whatsAppAccessTokenConfigured: boolean;
  whatsAppDefaultCountryCode: string;
  updatedAt: string | null;
}

type StoredNotificationProviders = Omit<
  NotificationProvidersDto,
  'smtpPasswordConfigured' | 'whatsAppAccessTokenConfigured'
> & {
  smtpPassword?: string | null;
  whatsAppAccessToken?: string | null;
};

export interface MessageTemplateDto {
  subject: string;
  body: string;
  whatsApp: string;
}

export interface MessageTemplatesDto {
  paymentConfirmed: MessageTemplateDto;
  uidIssued: MessageTemplateDto;
  medicalScreeningReady: MessageTemplateDto;
  certificateReady: MessageTemplateDto;
  updatedAt: string | null;
}

type StoredMessageTemplates = MessageTemplatesDto;

@Injectable()
export class TenantSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotificationProviders(ctx: ActorContext): Promise<NotificationProvidersDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: NOTIFICATION_PROVIDERS_KEY } },
      });
      return toNotificationProvidersDto(normalizeNotificationProviders(setting?.settingValue));
    });
  }

  async updateNotificationProviders(
    ctx: ActorContext,
    dto: UpdateNotificationProvidersDto,
  ): Promise<NotificationProvidersDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: NOTIFICATION_PROVIDERS_KEY } },
      });
      const current = normalizeNotificationProviders(setting?.settingValue);
      const next: StoredNotificationProviders = {
        ...current,
        emailEnabled: dto.emailEnabled ?? false,
        smtpHost: emptyToNull(dto.smtpHost),
        smtpPort: dto.smtpPort ?? null,
        smtpSecure: dto.smtpSecure ?? false,
        smtpUsername: emptyToNull(dto.smtpUsername),
        smtpPassword: emptyToNull(dto.smtpPassword) ?? current.smtpPassword ?? null,
        emailFromName: emptyToNull(dto.emailFromName),
        emailFromAddress: emptyToNull(dto.emailFromAddress),
        whatsAppEnabled: dto.whatsAppEnabled ?? false,
        whatsAppPhoneNumberId: emptyToNull(dto.whatsAppPhoneNumberId),
        whatsAppBusinessAccountId: emptyToNull(dto.whatsAppBusinessAccountId),
        whatsAppAccessToken: emptyToNull(dto.whatsAppAccessToken) ?? current.whatsAppAccessToken ?? null,
        whatsAppDefaultCountryCode: emptyToNull(dto.whatsAppDefaultCountryCode) ?? '234',
        updatedAt: new Date().toISOString(),
      };

      await tx.tenantSetting.upsert({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: NOTIFICATION_PROVIDERS_KEY } },
        create: {
          tenantId: ctx.tenantId,
          settingKey: NOTIFICATION_PROVIDERS_KEY,
          settingValue: next as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
        update: {
          settingValue: next as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
      });

      return toNotificationProvidersDto(next);
    });
  }

  async getMessageTemplates(ctx: ActorContext): Promise<MessageTemplatesDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: MESSAGE_TEMPLATES_KEY } },
      });
      return normalizeMessageTemplates(setting?.settingValue);
    });
  }

  async updateMessageTemplates(
    ctx: ActorContext,
    dto: UpdateMessageTemplatesDto,
  ): Promise<MessageTemplatesDto> {
    const next: StoredMessageTemplates = {
      paymentConfirmed: normalizeMessageTemplate(dto.paymentConfirmed, DEFAULT_MESSAGE_TEMPLATES.paymentConfirmed),
      uidIssued: normalizeMessageTemplate(dto.uidIssued, DEFAULT_MESSAGE_TEMPLATES.uidIssued),
      medicalScreeningReady: normalizeMessageTemplate(dto.medicalScreeningReady, DEFAULT_MESSAGE_TEMPLATES.medicalScreeningReady),
      certificateReady: normalizeMessageTemplate(dto.certificateReady, DEFAULT_MESSAGE_TEMPLATES.certificateReady),
      updatedAt: new Date().toISOString(),
    };

    return this.prisma.runWithContext(ctx, async (tx) => {
      await tx.tenantSetting.upsert({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: MESSAGE_TEMPLATES_KEY } },
        create: {
          tenantId: ctx.tenantId,
          settingKey: MESSAGE_TEMPLATES_KEY,
          settingValue: next as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
        update: {
          settingValue: next as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
      });
      return next;
    });
  }

  async getCertificateTemplate(ctx: ActorContext): Promise<CertificateTemplateDto | null> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: TEMPLATE_KEY } },
      });
      if (!setting) return null;
      const value = setting.settingValue as unknown as StoredTemplate;
      return {
        ...value,
        approvedAt: value.approvedAt ?? value.uploadedAt,
        isApproved: true,
        layout: normalizeLayout(value.layout),
        fileUrl: '/api/v1/tenant-settings/certificate-template/file',
      };
    });
  }

  async updateCertificateTemplateLayout(
    ctx: ActorContext,
    layout: Partial<CertificateTemplateLayout>,
  ): Promise<CertificateTemplateDto> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: TEMPLATE_KEY } },
      });
      if (!setting) throw new ResourceNotFoundException('Certificate template', ctx.tenantId);

      const value = setting.settingValue as unknown as StoredTemplate;
      const next: StoredTemplate = {
        ...value,
        approvedAt: value.approvedAt ?? value.uploadedAt,
        isApproved: true,
        layout: normalizeLayout({ ...normalizeLayout(value.layout), ...layout }),
      };

      await tx.tenantSetting.update({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: TEMPLATE_KEY } },
        data: {
          settingValue: next as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
      });

      return {
        ...next,
        fileUrl: '/api/v1/tenant-settings/certificate-template/file',
      };
    });
  }

  async uploadCertificateTemplate(
    ctx: ActorContext,
    file: UploadedTemplateFile | undefined,
  ): Promise<CertificateTemplateDto> {
    if (!file?.buffer?.length) throw new ResourceConflictException('Choose a certificate template to upload');
    if (!file.mimetype || !ALLOWED_TEMPLATE_MIME_TYPES.has(file.mimetype)) {
      throw new ResourceConflictException('Only PNG, JPEG, and PDF certificate templates are allowed');
    }
    if (!file.size || file.size > MAX_TEMPLATE_SIZE) {
      throw new ResourceConflictException('Certificate template must be 8 MB or smaller');
    }

    const storageKey = buildStorageKey(ctx.tenantId, file.originalname);
    const fullPath = join(process.cwd(), 'storage', storageKey);
    await mkdir(join(process.cwd(), 'storage', 'certificate-templates', ctx.tenantId), { recursive: true });
    await writeFile(fullPath, file.buffer);

    const stored: StoredTemplate = {
      storageKey,
      originalFilename: file.originalname ?? null,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      sha256Hash: createHash('sha256').update(file.buffer).digest('hex'),
      uploadedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      isApproved: true,
      layout: DEFAULT_LAYOUT,
    };

    return this.prisma.runWithContext(ctx, async (tx) => {
      await tx.tenantSetting.upsert({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: TEMPLATE_KEY } },
        create: {
          tenantId: ctx.tenantId,
          settingKey: TEMPLATE_KEY,
          settingValue: stored as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
        update: {
          settingValue: stored as unknown as Prisma.InputJsonValue,
          updatedBy: ctx.userId,
        },
      });
      return { ...stored, fileUrl: '/api/v1/tenant-settings/certificate-template/file' };
    });
  }

  async openCertificateTemplateFile(ctx: ActorContext): Promise<{
    stream: NodeJS.ReadableStream;
    mimeType: string;
    filename: string;
  }> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const setting = await tx.tenantSetting.findUnique({
        where: { tenantId_settingKey: { tenantId: ctx.tenantId, settingKey: TEMPLATE_KEY } },
      });
      if (!setting) throw new ResourceNotFoundException('Certificate template', ctx.tenantId);
      const value = setting.settingValue as unknown as StoredTemplate;
      return {
        stream: createReadStream(join(process.cwd(), 'storage', value.storageKey)),
        mimeType: value.mimeType,
        filename: value.originalFilename ?? 'certificate-template',
      };
    });
  }
}

const DEFAULT_LAYOUT: CertificateTemplateLayout = {
  nameLeftPercent: 12,
  nameTopPercent: 34,
  nameWidthPercent: 76,
  detailLeftPercent: 10,
  detailTopPercent: 78,
  detailWidthPercent: 80,
  detailBottomPercent: 12,
  detailInsetPercent: 10,
  nameScale: 100,
  detailScale: 100,
  showVerification: true,
};

function normalizeLayout(layout: Partial<CertificateTemplateLayout> | undefined): CertificateTemplateLayout {
  const detailTopFromLegacyBottom =
    typeof layout?.detailTopPercent === 'number'
      ? layout.detailTopPercent
      : 100 - clampNumber(layout?.detailBottomPercent, 5, 28, DEFAULT_LAYOUT.detailBottomPercent) - 10;
  const detailLeftFromLegacyInset =
    typeof layout?.detailLeftPercent === 'number'
      ? layout.detailLeftPercent
      : clampNumber(layout?.detailInsetPercent, 5, 24, DEFAULT_LAYOUT.detailInsetPercent);
  const detailWidthFromLegacyInset =
    typeof layout?.detailWidthPercent === 'number'
      ? layout.detailWidthPercent
      : 100 - detailLeftFromLegacyInset * 2;

  const nameWidthPercent = clampNumber(layout?.nameWidthPercent, 35, 95, DEFAULT_LAYOUT.nameWidthPercent);
  const detailWidthPercent = clampNumber(detailWidthFromLegacyInset, 35, 95, DEFAULT_LAYOUT.detailWidthPercent);

  return {
    nameLeftPercent: clampNumber(layout?.nameLeftPercent, 0, 100 - nameWidthPercent, DEFAULT_LAYOUT.nameLeftPercent),
    nameTopPercent: clampNumber(layout?.nameTopPercent, 10, 70, DEFAULT_LAYOUT.nameTopPercent),
    nameWidthPercent,
    detailLeftPercent: clampNumber(detailLeftFromLegacyInset, 0, 100 - detailWidthPercent, DEFAULT_LAYOUT.detailLeftPercent),
    detailTopPercent: clampNumber(detailTopFromLegacyBottom, 48, 90, DEFAULT_LAYOUT.detailTopPercent),
    detailWidthPercent,
    detailBottomPercent: clampNumber(layout?.detailBottomPercent, 5, 28, DEFAULT_LAYOUT.detailBottomPercent),
    detailInsetPercent: clampNumber(layout?.detailInsetPercent, 5, 24, DEFAULT_LAYOUT.detailInsetPercent),
    nameScale: clampNumber(layout?.nameScale, 70, 125, DEFAULT_LAYOUT.nameScale),
    detailScale: clampNumber(layout?.detailScale, 80, 120, DEFAULT_LAYOUT.detailScale),
    showVerification: layout?.showVerification ?? DEFAULT_LAYOUT.showVerification,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function buildStorageKey(tenantId: string, originalName?: string): string {
  const rawExt = originalName ? extname(originalName).toLowerCase() : '';
  const ext = ['.jpg', '.jpeg', '.png', '.pdf'].includes(rawExt) ? rawExt : '.bin';
  return join('certificate-templates', tenantId, `${randomUUID()}${ext}`);
}

function normalizeNotificationProviders(value: unknown): StoredNotificationProviders {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<StoredNotificationProviders>;
  return {
    emailEnabled: raw.emailEnabled ?? false,
    smtpHost: raw.smtpHost ?? null,
    smtpPort: raw.smtpPort ?? null,
    smtpSecure: raw.smtpSecure ?? false,
    smtpUsername: raw.smtpUsername ?? null,
    smtpPassword: raw.smtpPassword ?? null,
    emailFromName: raw.emailFromName ?? null,
    emailFromAddress: raw.emailFromAddress ?? null,
    whatsAppEnabled: raw.whatsAppEnabled ?? false,
    whatsAppPhoneNumberId: raw.whatsAppPhoneNumberId ?? null,
    whatsAppBusinessAccountId: raw.whatsAppBusinessAccountId ?? null,
    whatsAppAccessToken: raw.whatsAppAccessToken ?? null,
    whatsAppDefaultCountryCode: raw.whatsAppDefaultCountryCode ?? '234',
    updatedAt: raw.updatedAt ?? null,
  };
}

function toNotificationProvidersDto(value: StoredNotificationProviders): NotificationProvidersDto {
  return {
    emailEnabled: value.emailEnabled,
    smtpHost: value.smtpHost,
    smtpPort: value.smtpPort,
    smtpSecure: value.smtpSecure,
    smtpUsername: value.smtpUsername,
    smtpPasswordConfigured: Boolean(value.smtpPassword),
    emailFromName: value.emailFromName,
    emailFromAddress: value.emailFromAddress,
    whatsAppEnabled: value.whatsAppEnabled,
    whatsAppPhoneNumberId: value.whatsAppPhoneNumberId,
    whatsAppBusinessAccountId: value.whatsAppBusinessAccountId,
    whatsAppAccessTokenConfigured: Boolean(value.whatsAppAccessToken),
    whatsAppDefaultCountryCode: value.whatsAppDefaultCountryCode,
    updatedAt: value.updatedAt,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

const DEFAULT_MESSAGE_TEMPLATES: MessageTemplatesDto = {
  paymentConfirmed: {
    subject: 'Darbel payment confirmed',
    body: 'Hello {{handlerName}}, your payment has been confirmed. Your registration UID is {{uid}}.',
    whatsApp: 'Darbel: Payment confirmed for {{handlerName}}. UID: {{uid}}.',
  },
  uidIssued: {
    subject: 'Your Darbel UID has been issued',
    body: 'Hello {{handlerName}}, your Darbel UID is {{uid}}. Please keep it for verification and screening.',
    whatsApp: 'Darbel UID issued: {{uid}} for {{handlerName}}.',
  },
  medicalScreeningReady: {
    subject: 'Medical screening required',
    body: 'Hello {{handlerName}}, please proceed for medical screening with UID {{uid}}.',
    whatsApp: 'Darbel: Medical screening is required for UID {{uid}}.',
  },
  certificateReady: {
    subject: 'Darbel certificate ready',
    body: 'Hello {{handlerName}}, your compliance certificate is ready. Verify it here: {{verificationUrl}}',
    whatsApp: 'Darbel certificate ready for {{handlerName}}. Verify: {{verificationUrl}}',
  },
  updatedAt: null,
};

function normalizeMessageTemplates(value: unknown): MessageTemplatesDto {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Partial<StoredMessageTemplates>;
  return {
    paymentConfirmed: normalizeMessageTemplate(raw.paymentConfirmed, DEFAULT_MESSAGE_TEMPLATES.paymentConfirmed),
    uidIssued: normalizeMessageTemplate(raw.uidIssued, DEFAULT_MESSAGE_TEMPLATES.uidIssued),
    medicalScreeningReady: normalizeMessageTemplate(raw.medicalScreeningReady, DEFAULT_MESSAGE_TEMPLATES.medicalScreeningReady),
    certificateReady: normalizeMessageTemplate(raw.certificateReady, DEFAULT_MESSAGE_TEMPLATES.certificateReady),
    updatedAt: raw.updatedAt ?? null,
  };
}

function normalizeMessageTemplate(
  value: Partial<MessageTemplateDto> | undefined,
  fallback: MessageTemplateDto,
): MessageTemplateDto {
  return {
    subject: value?.subject?.trim() || fallback.subject,
    body: value?.body?.trim() || fallback.body,
    whatsApp: value?.whatsApp?.trim() || fallback.whatsApp,
  };
}
