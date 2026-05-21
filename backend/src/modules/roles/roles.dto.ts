import { z } from 'zod';

export const ListRolesQueryDto = z.object({
  includeSystem: z.coerce.boolean().default(true),
});
export type ListRolesQueryDto = z.infer<typeof ListRolesQueryDto>;
