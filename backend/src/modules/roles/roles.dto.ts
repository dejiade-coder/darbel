import { z } from 'zod';

export const ListRolesQueryDto = z.object({
  includeSystem: z.coerce.boolean().default(true),
});
export type ListRolesQueryDto = z.infer<typeof ListRolesQueryDto>;

export const CreateRoleDto = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,40}$/),
  displayName: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  permissionCodes: z.array(z.string().min(1).max(80)).min(1),
});
export type CreateRoleDto = z.infer<typeof CreateRoleDto>;
