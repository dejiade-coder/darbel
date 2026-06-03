import { z } from 'zod';

export const RegistrationStatusDto = z.enum(['DRAFT', 'SUBMITTED_FOR_REVIEW', 'CANCELLED']);
export type RegistrationStatusDto = z.infer<typeof RegistrationStatusDto>;

const UpsertRegistrationStatusDto = z.enum(['DRAFT', 'SUBMITTED_FOR_REVIEW']);

export const UpsertRegistrationDto = z.object({
  registrationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'registrationDate must be YYYY-MM-DD',
  }),
  firstName: z.string().trim().max(100).optional().or(z.literal('')),
  lastName: z.string().trim().max(100).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  gender: z.string().trim().max(40).optional().or(z.literal('')),
  tradeCategory: z.string().trim().max(120).optional().or(z.literal('')),
  businessName: z.string().trim().max(200).optional().or(z.literal('')),
  businessAddress: z.string().trim().max(1000).optional().or(z.literal('')),
  passportPhotoReceived: z.boolean().optional().default(false),
  status: UpsertRegistrationStatusDto.optional().default('DRAFT'),
}).superRefine((value, ctx) => {
  if (value.status !== 'SUBMITTED_FOR_REVIEW') return;
  const required: Array<[keyof typeof value, string]> = [
    ['firstName', 'firstName is required when submitting'],
    ['lastName', 'lastName is required when submitting'],
    ['phone', 'phone is required when submitting'],
    ['tradeCategory', 'tradeCategory is required when submitting'],
    ['businessAddress', 'businessAddress is required when submitting'],
  ];
  for (const [key, message] of required) {
    if (!String(value[key] ?? '').trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message });
    }
  }
});
export type UpsertRegistrationDto = z.infer<typeof UpsertRegistrationDto>;

export const ListRegistrationsQueryDto = z.object({
  q: z.string().trim().optional(),
  status: RegistrationStatusDto.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().uuid().optional(),
});
export type ListRegistrationsQueryDto = z.infer<typeof ListRegistrationsQueryDto>;
