import { z } from 'zod';

export const ScreeningStatusDto = z.enum([
  'SAMPLE_COLLECTED',
  'RESULT_ENTERED',
  'APPROVED',
  'REJECTED',
]);

export const FitnessStatusDto = z.enum(['FIT', 'UNFIT', 'REQUIRES_REVIEW']);
export const MedicalTestResultDto = z.enum(['NEGATIVE', 'POSITIVE', 'INDETERMINATE', 'NOT_DONE']);

export const ListScreeningsQueryDto = z.object({
  status: ScreeningStatusDto.optional(),
  q: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListScreeningsQueryDto = z.infer<typeof ListScreeningsQueryDto>;

export const CreateScreeningDto = z.object({
  handlerRegistrationId: z.string().uuid(),
});
export type CreateScreeningDto = z.infer<typeof CreateScreeningDto>;

export const EnterResultDto = z.object({
  labResultSummary: z.string().trim().max(2000).optional().or(z.literal('')),
  mantouxResult: MedicalTestResultDto,
  mantouxIndurationMm: z.coerce.number().int().min(0).max(50).optional().nullable(),
  hepatitisBResult: MedicalTestResultDto,
  hivResult: MedicalTestResultDto,
  widalResult: MedicalTestResultDto,
  medicalOfficerNotes: z.string().trim().max(2000).optional().or(z.literal('')),
  fitnessStatus: FitnessStatusDto,
});
export type EnterResultDto = z.infer<typeof EnterResultDto>;

export const ReviewScreeningDto = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type ReviewScreeningDto = z.infer<typeof ReviewScreeningDto>;
