import { z } from 'zod';

/**
 * Query params for listing trade categories.
 * - `withFeeOnly=true` filters to only categories that have a fee set
 *   for the caller's tenant. Used by Registrar UI (blocked-when-no-fee).
 */
export const ListTradeCategoriesQueryDto = z.object({
  withFeeOnly: z.coerce.boolean().optional().default(false),
});
export type ListTradeCategoriesQueryDto = z.infer<typeof ListTradeCategoriesQueryDto>;

/**
 * Body for setting/updating a fee on a trade category.
 * Currency defaults to NGN. fee_amount must be >= 0 and reasonable.
 */
export const SetTradeCategoryFeeDto = z.object({
  feeAmount: z
    .union([z.string(), z.number()])
    .transform((v) => (typeof v === 'string' ? Number(v) : v))
    .refine((v) => Number.isFinite(v) && v >= 0 && v <= 999_999_999_999.99, {
      message: 'feeAmount must be a number between 0 and 999,999,999,999.99',
    }),
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .optional()
    .default('NGN'),
});
export type SetTradeCategoryFeeDto = z.infer<typeof SetTradeCategoryFeeDto>;
