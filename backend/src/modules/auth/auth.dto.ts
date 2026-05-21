import { z } from 'zod';

export const LoginDto = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});
export type LoginDto = z.infer<typeof LoginDto>;

export const MfaVerifyDto = z.object({
  challengeToken: z.string().min(20).max(2048),
  code: z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});
export type MfaVerifyDto = z.infer<typeof MfaVerifyDto>;

export const RefreshDto = z.object({
  refreshToken: z.string().min(10).max(512),
});
export type RefreshDto = z.infer<typeof RefreshDto>;

export const LogoutDto = z.object({
  refreshToken: z.string().min(10).max(512),
});
export type LogoutDto = z.infer<typeof LogoutDto>;

export const ChangePasswordDto = z.object({
  currentPassword: z.string().min(1).max(256),
  newPassword: z.string().min(12).max(256),
});
export type ChangePasswordDto = z.infer<typeof ChangePasswordDto>;

export const ForcedPasswordChangeDto = z.object({
  challengeToken: z.string().min(20).max(2048),
  newPassword: z.string().min(12).max(256),
});
export type ForcedPasswordChangeDto = z.infer<typeof ForcedPasswordChangeDto>;

export const EnrollMfaConfirmDto = z.object({
  code: z.string().regex(/^\d{6}$/, 'MFA code must be 6 digits'),
});
export type EnrollMfaConfirmDto = z.infer<typeof EnrollMfaConfirmDto>;
