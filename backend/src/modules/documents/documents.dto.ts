import { z } from 'zod';

export const DocumentTypeDto = z.enum([
  'PHOTOGRAPH',
  'GOVERNMENT_ID',
  'PRIOR_CERTIFICATE',
]);
export type DocumentTypeDto = z.infer<typeof DocumentTypeDto>;
