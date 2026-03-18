import { Global, Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module';
import { PriceAlertsModule } from '../price-alerts/price-alerts.module';
import { TelegramBotHandler } from './telegram-bot-handler.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Global()
@Module({
  imports: [CryptoModule, PriceAlertsModule],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramBotHandler],
  exports: [TelegramService],
})
export class TelegramModule {}
