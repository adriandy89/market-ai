import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Logger, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GetUserInfo } from '../auth/decorators';
import { SessionGuard } from '../auth/guards';
import { TelegramService } from './telegram.service';

@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(private readonly telegramService: TelegramService) {}

  @Post('webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() update: any,
    @Headers('x-telegram-bot-api-secret-token') secretToken: string,
  ) {
    this.logger.log('Received Telegram webhook update');
    try {
      setImmediate(async () => {
        try {
          await this.telegramService.processWebhookUpdate(update, secretToken);
        } catch (error: any) {
          this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
        }
      });
      return { success: true };
    } catch (error: any) {
      this.logger.error(`Error handling webhook: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  @Post('generate-code')
  @UseGuards(SessionGuard)
  async generateCode(@GetUserInfo() user: any) {
    try {
      const code = await this.telegramService.generateVerificationCode(user.id);
      return {
        success: true,
        code,
        botLink: this.telegramService.getBotLink(),
        instructions: 'Abre el bot en Telegram y envía el comando /verify seguido de este código.',
      };
    } catch (error: any) {
      this.logger.error(`Error generating Telegram code: ${error.message}`, error.stack);
      return { success: false, error: 'No se pudo generar el código de verificación' };
    }
  }

  @Delete('unlink')
  @UseGuards(SessionGuard)
  async unlink(@GetUserInfo() user: any) {
    await this.telegramService.unlinkAccount(user.id);
    return { success: true };
  }

  @Get('status')
  @UseGuards(SessionGuard)
  async getStatus(@GetUserInfo() user: any) {
    const linked = await this.telegramService.isLinked(user.id);
    return { linked };
  }
}
