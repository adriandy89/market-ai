import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VerificationsService } from './verifications.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [VerificationsService],
  exports: [VerificationsService],
})
export class VerificationsModule { }
