import { z } from 'zod';

export const CreateTenantDto = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,20}$/, 'Use 2-20 letters or numbers for the tenant code'),
  legalName: z.string().trim().min(2).max(200),
  displayName: z.string().trim().min(2).max(120),
  contactEmail: z.string().email().max(254),
  contactPhone: z.string().trim().max(20).optional(),
  adminName: z.string().trim().min(2).max(200),
  adminEmail: z.string().email().max(254),
  adminPhone: z.string().trim().max(20).optional(),
  initialPassword: z.string().min(12).max(256),
});

export type CreateTenantDto = z.infer<typeof CreateTenantDto>;

export const UpdateTenantStatusDto = z.object({
  isActive: z.boolean(),
});

export type UpdateTenantStatusDto = z.infer<typeof UpdateTenantStatusDto>;
