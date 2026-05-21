import { z } from 'zod';

export const CreateUserDto = z.object({
  email: z.string().email().max(254),
  fullName: z.string().min(2).max(200),
  phone: z.string().max(20).optional(),
  initialPassword: z.string().min(12).max(256),
  mustChangePassword: z.boolean().default(true),
  roleCodes: z.array(z.string().min(1).max(40)).min(1),
});
export type CreateUserDto = z.infer<typeof CreateUserDto>;

export const UpdateUserDto = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().max(20).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserDto>;

export const AssignRolesDto = z.object({
  roleCodes: z.array(z.string().min(1).max(40)).min(0),
});
export type AssignRolesDto = z.infer<typeof AssignRolesDto>;

export const ListUsersQueryDto = z.object({
  q: z.string().max(100).optional(),
  isActive: z.coerce.boolean().optional(),
  roleCode: z.string().max(40).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListUsersQueryDto = z.infer<typeof ListUsersQueryDto>;
