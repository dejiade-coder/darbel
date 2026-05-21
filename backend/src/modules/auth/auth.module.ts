import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { MfaService } from './mfa.service';
import { TokenService } from './token.service';
import { AppConfigService } from '../../config/app-config.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const alg = config.get('JWT_ALGORITHM');
        if (alg === 'RS256') {
          return {
            privateKey: config.get('JWT_PRIVATE_KEY')!,
            publicKey: config.get('JWT_PUBLIC_KEY')!,
            signOptions: { algorithm: 'RS256' },
          };
        }
        return {
          secret: config.get('JWT_SECRET')!,
          signOptions: { algorithm: 'HS256' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, MfaService, TokenService],
  // Re-export JwtModule so guards in other modules can use JwtService.
  exports: [JwtModule, TokenService, PasswordService, MfaService],
})
export class AuthModule {}
