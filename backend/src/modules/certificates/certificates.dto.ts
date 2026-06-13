import { z } from 'zod';

export const RecordCertificateDeliveryDto = z.object({
  channel: z.enum(['PRINT', 'EMAIL', 'WHATSAPP']),
  recipient: z.string().trim().max(254).optional().or(z.literal('')),
  deliveryUrl: z.string().trim().max(1000).optional().or(z.literal('')),
  messagePreview: z.string().trim().max(2000).optional().or(z.literal('')),
});

export type RecordCertificateDeliveryDto = z.infer<typeof RecordCertificateDeliveryDto>;

export const RevokeCertificateDto = z.object({
  reason: z.string().trim().min(3).max(1000),
});

export type RevokeCertificateDto = z.infer<typeof RevokeCertificateDto>;
