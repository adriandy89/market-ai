import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { PriceAlertsChecker } from './price-alerts.checker';
import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';

@Module({
  imports: [CryptoModule],
  controllers: [PriceAlertsController],
  providers: [PriceAlertsService, PriceAlertsChecker],
  exports: [PriceAlertsService],
})
export class PriceAlertsModule {}
