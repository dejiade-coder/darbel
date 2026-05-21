import { z } from 'zod';

export const ListAuditQueryDto = z.object({
  actorUserId: z.string().uuid().optional(),
  tableName: z.string().max(80).optional(),
  action: z.enum(['INSERT', 'UPDATE', 'DELETE']).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListAuditQueryDto = z.infer<typeof ListAuditQueryDto>;
