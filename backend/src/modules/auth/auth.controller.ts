import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { MfaService } from './mfa.service';
import { PrismaService } from '../../database/prisma.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ChangePasswordDto,
  EnrollMfaConfirmDto,
  ForcedPasswordChangeDto,
  LoginDto,
  LogoutDto,
  MfaVerifyDto,
  RefreshDto,
} from './auth.dto';
import {
  CurrentUser,
  Public,
  type AuthenticatedActor,
  type AuthenticatedRequest,
} from '../../common/decorators/auth.decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  AccountInactiveException,
  InvalidCredentialsException,
  ResourceNotFoundException,
} from '../../common/errors/domain.exceptions';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly mfaService: MfaService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body(new ZodValidationPipe(LoginDto)) dto: LoginDto,
    @Req() req: AuthenticatedRequest,
  ): ReturnType<AuthService['login']> {
    return this.authService.login({
      email: dto.email,
      password: dto.password,
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
      requestId: req.requestId!,
    });
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async verifyMfa(
    @Body(new ZodValidationPipe(MfaVerifyDto)) dto: MfaVerifyDto,
    @Req() req: AuthenticatedRequest,
  ): ReturnType<AuthService['verifyMfa']> {
    return this.authService.verifyMfa({
      challengeToken: dto.challengeToken,
      code: dto.code,
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
      requestId: req.requestId!,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(RefreshDto)) dto: RefreshDto,
    @Req() req: AuthenticatedRequest,
  ): ReturnType<AuthService['refresh']> {
    return this.authService.refresh(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
      requestId: req.requestId!,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body(new ZodValidationPipe(LogoutDto)) dto: LogoutDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.logout(dto.refreshToken, { requestId: req.requestId! });
  }

  /**
   * Forced password change after first login. Caller provides the challenge
   * token issued by /login; no access token is required here.
   */
  @Public()
  @Post('password/first-change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async firstPasswordChange(
    @Body(new ZodValidationPipe(ForcedPasswordChangeDto)) dto: ForcedPasswordChangeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    const challenge = await this.tokenService
      .verifyChallengeToken(dto.challengeToken, 'password_change_required')
      .catch(() => {
        throw new InvalidCredentialsException();
      });
    await this.authService.changePassword({
      userId: challenge.userId,
      tenantId: challenge.tenantId,
      newPassword: dto.newPassword,
      requestId: req.requestId!,
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
    });
  }

  /**
   * Self-initiated password change (authenticated).
   */
  @UseGuards(JwtAuthGuard)
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(ChangePasswordDto)) dto: ChangePasswordDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.authService.changePassword({
      userId: actor.userId,
      tenantId: actor.tenantId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      requestId: req.requestId!,
      ipAddress: req.ip,
      userAgent: req.header('user-agent'),
    });
  }

  // -----------------------------------------------------------------------
  // MFA enrollment (authenticated)
  // -----------------------------------------------------------------------

  /**
   * Begin MFA enrollment: returns a secret and otpauth URL. The secret is
   * stored encrypted with mfa_enabled = FALSE until the user confirms with
   * a valid TOTP code via /mfa/enroll/confirm.
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/enroll/start')
  @HttpCode(HttpStatus.OK)
  async startMfaEnrollment(
    @CurrentUser() actor: AuthenticatedActor,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ secret: string; otpauthUrl: string }> {
    const enrollment = this.mfaService.generateEnrollment(actor.email);
    const enc = this.mfaService.encryptSecret(enrollment.secret);
    await this.prisma.runWithContext(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      async (tx) => {
        await tx.user.update({
          where: { id: actor.userId },
          data: { mfaSecretEnc: enc, mfaEnabled: false },
        });
      },
    );
    // Return secret in plaintext one time so the user can type it into an
    // authenticator app if they cannot scan the QR code.
    return { secret: enrollment.secret, otpauthUrl: enrollment.otpauthUrl };
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enroll/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async confirmMfaEnrollment(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(EnrollMfaConfirmDto)) dto: EnrollMfaConfirmDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.prisma.runWithContext(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: actor.userId } });
        if (!user) throw new ResourceNotFoundException('User');
        if (!user.isActive) throw new AccountInactiveException();
        if (!user.mfaSecretEnc) throw new InvalidCredentialsException();
        const secret = this.mfaService.decryptSecret(user.mfaSecretEnc);
        if (!this.mfaService.verify(dto.code, secret)) {
          throw new InvalidCredentialsException();
        }
        await tx.user.update({
          where: { id: actor.userId },
          data: { mfaEnabled: true },
        });
      },
    );
  }

  /**
   * Disable MFA. Requires the user to verify a current TOTP code.
   * Protected behavior: tenant admins (and platform admin) cannot disable
   * other users' MFA — only their own. To force-reset another user's MFA,
   * a separate admin endpoint will be added (Phase 2).
   */
  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableMfa(
    @CurrentUser() actor: AuthenticatedActor,
    @Body(new ZodValidationPipe(EnrollMfaConfirmDto)) dto: EnrollMfaConfirmDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    await this.prisma.runWithContext(
      {
        userId: actor.userId,
        tenantId: actor.tenantId,
        userEmail: actor.email,
        requestId: req.requestId!,
        clientIp: req.ip,
        userAgent: req.header('user-agent'),
      },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: actor.userId } });
        if (!user || !user.mfaEnabled || !user.mfaSecretEnc) {
          throw new InvalidCredentialsException();
        }
        const secret = this.mfaService.decryptSecret(user.mfaSecretEnc);
        if (!this.mfaService.verify(dto.code, secret)) {
          throw new InvalidCredentialsException();
        }
        await tx.user.update({
          where: { id: actor.userId },
          data: { mfaEnabled: false, mfaSecretEnc: null },
        });
      },
    );
  }
}
