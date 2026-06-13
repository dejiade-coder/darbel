import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { ActorContext, PrismaService } from '../../database/prisma.service';
import {
  ResourceConflictException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';
import type { DocumentTypeDto } from './documents.dto';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);

export interface DocumentPublicDto {
  id: string;
  handlerRegistrationId: string;
  documentType: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: string;
  sha256Hash: string;
  uploadedBy: string;
  uploadedAt: string;
  notes: string | null;
}

export interface UploadedDocumentFile {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

@Injectable()
export class DocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForRegistration(
    ctx: ActorContext,
    registrationId: string,
  ): Promise<DocumentPublicDto[]> {
    return this.prisma.runWithContext(ctx, async (tx) => {
      const registration = await tx.handlerRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true },
      });
      if (!registration) throw new ResourceNotFoundException('Registration', registrationId);

      const documents = await tx.handlerDocument.findMany({
        where: { handlerRegistrationId: registrationId },
        orderBy: { uploadedAt: 'desc' },
      });
      return documents.map(toPublic);
    });
  }

  async uploadForRegistration(
    ctx: ActorContext,
    registrationId: string,
    documentType: DocumentTypeDto,
    file: UploadedDocumentFile | undefined,
    notes?: string,
  ): Promise<DocumentPublicDto> {
    if (!file?.buffer?.length) {
      throw new ResourceConflictException('Choose a document file to upload');
    }
    if (!file.mimetype || !ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new ResourceConflictException('Only JPEG, PNG, and PDF documents are allowed');
    }
    if (!file.size || file.size > MAX_FILE_SIZE_BYTES) {
      throw new ResourceConflictException('Document must be 5 MB or smaller');
    }
    const buffer = file.buffer;
    const mimeType = file.mimetype;
    const size = file.size;

    return this.prisma.runWithContext(ctx, async (tx) => {
      const registration = await tx.handlerRegistration.findUnique({
        where: { id: registrationId },
        select: { id: true, tenantId: true },
      });
      if (!registration) throw new ResourceNotFoundException('Registration', registrationId);

      const storageKey = buildStorageKey(
        registration.tenantId,
        registration.id,
        documentType,
        file.originalname,
      );
      const fullPath = join(process.cwd(), 'storage', storageKey);
      await mkdir(join(process.cwd(), 'storage', 'documents', registration.tenantId, registration.id, documentType), {
        recursive: true,
      });
      await writeFile(fullPath, buffer);

      const document = await tx.handlerDocument.create({
        data: {
          tenantId: ctx.tenantId,
          handlerRegistrationId: registrationId,
          documentType,
          storageKey,
          originalFilename: file.originalname ?? null,
          mimeType,
          sizeBytes: BigInt(size),
          sha256Hash: createHash('sha256').update(buffer).digest('hex'),
          uploadedBy: ctx.userId,
          notes: emptyToNull(notes),
        },
      });
      return toPublic(document);
    });
  }
}

function buildStorageKey(
  tenantId: string,
  registrationId: string,
  documentType: string,
  originalName?: string,
): string {
  const rawExt = originalName ? extname(originalName).toLowerCase() : '';
  const ext = ['.jpg', '.jpeg', '.png', '.pdf'].includes(rawExt) ? rawExt : '.bin';
  return join('documents', tenantId, registrationId, documentType, `${randomUUID()}${ext}`);
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toPublic(row: HandlerDocumentRow): DocumentPublicDto {
  return {
    id: row.id,
    handlerRegistrationId: row.handlerRegistrationId,
    documentType: row.documentType,
    originalFilename: row.originalFilename,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes.toString(),
    sha256Hash: row.sha256Hash,
    uploadedBy: row.uploadedBy,
    uploadedAt: row.uploadedAt.toISOString(),
    notes: row.notes,
  };
}

type HandlerDocumentRow = {
  id: string;
  handlerRegistrationId: string;
  documentType: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: bigint;
  sha256Hash: string;
  uploadedBy: string;
  uploadedAt: Date;
  notes: string | null;
};
