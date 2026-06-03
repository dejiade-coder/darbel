import { z } from 'zod';

export const PaymentMethodDto = z.enum(['CASH', 'BANK_TRANSFER', 'POS', 'ONLINE']);
export const PaymentStatusDto = z.enum(['RECORDED', 'APPROVED', 'VOIDED', 'REFUNDED']);

export const RecordPaymentDto = z.object({
  handlerRegistrationId: z.string().uuid(),
  amount: z.coerce.number().positive().max(999_999_999_999.99),
  currency: z.string().trim().length(3).optional().default('NGN'),
  method: PaymentMethodDto,
  reference: z.string().trim().max(120).optional().or(z.literal('')),
  receiptNumber: z.string().trim().max(120).optional().or(z.literal('')),
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type RecordPaymentDto = z.infer<typeof RecordPaymentDto>;

export const ListPaymentsQueryDto = z.object({
  q: z.string().trim().optional(),
  status: PaymentStatusDto.optional(),
  handlerRegistrationId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: z.string().uuid().optional(),
});
export type ListPaymentsQueryDto = z.infer<typeof ListPaymentsQueryDto>;
