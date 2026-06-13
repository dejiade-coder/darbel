import { z } from 'zod';

const optionalText = z.string().trim().max(500).optional().or(z.literal(''));
const optionalSecret = z.string().trim().max(2000).optional().or(z.literal(''));

export const UpdateNotificationProvidersDto = z.object({
  emailEnabled: z.boolean().optional(),
  smtpHost: optionalText,
  smtpPort: z.coerce.number().int().min(1).max(65535).optional().nullable(),
  smtpSecure: z.boolean().optional(),
  smtpUsername: optionalText,
  smtpPassword: optionalSecret,
  emailFromName: optionalText,
  emailFromAddress: z.string().trim().email().optional().or(z.literal('')),
  whatsAppEnabled: z.boolean().optional(),
  whatsAppPhoneNumberId: optionalText,
  whatsAppBusinessAccountId: optionalText,
  whatsAppAccessToken: optionalSecret,
  whatsAppDefaultCountryCode: optionalText,
});

export type UpdateNotificationProvidersDto = z.infer<typeof UpdateNotificationProvidersDto>;

const templateSchema = z.object({
  subject: z.string().trim().max(160).optional().or(z.literal('')),
  body: z.string().trim().max(3000).optional().or(z.literal('')),
  whatsApp: z.string().trim().max(1200).optional().or(z.literal('')),
});

export const UpdateMessageTemplatesDto = z.object({
  paymentConfirmed: templateSchema,
  uidIssued: templateSchema,
  medicalScreeningReady: templateSchema,
  certificateReady: templateSchema,
});

export type UpdateMessageTemplatesDto = z.infer<typeof UpdateMessageTemplatesDto>;
