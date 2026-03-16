import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../user/user.module';
import { VerificationsModule } from '../verifications';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { CustomThrottlerGuard } from './guards/custom-throttler.guard';
import { SessionSerializer } from './session.serializer';
import { LocalStrategy } from './strategies';

@Module({
  imports: [
    PassportModule.register({ session: true }),
    UserModule,
    VerificationsModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    SessionSerializer,
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
  exports: [AuthService],
})
export class AuthModule { }
