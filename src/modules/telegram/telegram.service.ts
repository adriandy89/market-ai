import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService, DbService } from 'src/libs';
const TelegramBot = require('node-telegram-bot-api');

@Injectable()
export class TelegramService implements OnModuleInit {
  private bot: typeof TelegramBot;
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly webhookUrl: string;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly dbService: DbService,
    private readonly cacheService: CacheService,
  ) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.webhookUrl = this.config.get<string>('TELEGRAM_WEBHOOK_URL', '');
    this.webhookSecret = this.config.get<string>('TELEGRAM_WEBHOOK_SECRET', '');
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN is not configured. Telegram bot disabled.');
      return;
    }
    try {
      this.bot = new TelegramBot(this.botToken, { polling: false });

      if (this.webhookUrl) {
        await this.setupWebhook();
      } else {
        this.logger.warn('TELEGRAM_WEBHOOK_URL not configured. Webhook not set.');
      }

      this.logger.log('Telegram bot initialized successfully');
    } catch (error: any) {
      this.logger.error(`Error initializing Telegram bot: ${error.message}`, error.stack);
    }
  }

  private async setupWebhook() {
    try {
      await this.bot.setWebHook(this.webhookUrl, {
        secret_token: this.webhookSecret,
      });
      this.logger.log(`Webhook configured at: ${this.webhookUrl}`);
    } catch (error: any) {
      this.logger.error(`Error configuring webhook: ${error.message}`, error.stack);
    }
  }

  getBotLink(): string {
    return this.config.get<string>('TELEGRAM_BOT_LINK', '');
  }

  async generateVerificationCode(userId: string): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSeconds = 600;

    const existingCodeKey = `telegram:user:${userId}:code`;
    const existingCode = await this.cacheService.get<string>(existingCodeKey);

    if (existingCode) {
      await this.cacheService.del(`telegram:code:${existingCode}:user`);
    }

    await this.cacheService.set(`telegram:code:${code}:user`, userId, ttlSeconds);
    await this.cacheService.set(existingCodeKey, code, ttlSeconds);

    return code;
  }

  async verifyAndLinkAccount(chatId: string, code: string): Promise<boolean> {
    const userId = await this.cacheService.get<string>(`telegram:code:${code}:user`);

    if (!userId) {
      await this.bot.sendMessage(
        chatId,
        '❌ <b>Código inválido o expirado</b>\n\nGenera un nuevo código desde tu perfil en <b>Market AI</b>.',
        { parse_mode: 'HTML' },
      );
      return false;
    }

    try {
      await this.dbService.user.update({
        where: { id: userId },
        data: { telegram_chat_id: chatId },
      });

      await this.cacheService.del(`telegram:code:${code}:user`);
      await this.cacheService.del(`telegram:user:${userId}:code`);

      await this.bot.sendMessage(
        chatId,
        '✅ <b>Cuenta vinculada exitosamente!</b>\n\nRecibirás notificaciones de alertas de precio de <b>Market AI</b> en este chat. 📈\n\n<i>Puedes gestionar tus alertas desde la plataforma.</i>',
        { parse_mode: 'HTML' },
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Error linking account: ${error.message}`, error.stack);
      await this.bot.sendMessage(
        chatId,
        '⚠️ <b>Error al vincular cuenta</b>\n\nAlgo salió mal. Intenta nuevamente más tarde.',
        { parse_mode: 'HTML' },
      );
      return false;
    }
  }

  async sendMessage(chatId: string, message: string, useMarkdown = false): Promise<boolean> {
    if (!this.bot) {
      this.logger.warn('Telegram bot not initialized. Cannot send message.');
      return false;
    }

    try {
      const MAX_LENGTH = 4000;
      const messageOptions: any = {
        parse_mode: useMarkdown ? 'Markdown' : 'HTML',
        disable_web_page_preview: true,
      };

      if (message.length <= MAX_LENGTH) {
        await this.bot.sendMessage(chatId, message, messageOptions);
      } else {
        const chunks: string[] = [];
        for (let i = 0; i < message.length; i += MAX_LENGTH) {
          chunks.push(message.substring(i, i + MAX_LENGTH));
        }

        for (let i = 0; i < chunks.length; i++) {
          const prefix =
            chunks.length > 1
              ? useMarkdown
                ? `*Parte ${i + 1}/${chunks.length}:*\n\n`
                : `<b>Parte ${i + 1}/${chunks.length}:</b>\n\n`
              : '';
          await this.bot.sendMessage(chatId, prefix + chunks[i], messageOptions);

          if (i < chunks.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      return true;
    } catch (error: any) {
      if (error.response?.statusCode === 403) {
        this.logger.warn(`User blocked the bot (chatId: ${chatId}). Unlinking...`);
        await this.dbService.user.updateMany({
          where: { telegram_chat_id: chatId },
          data: { telegram_chat_id: null },
        });
      } else {
        this.logger.error(`Error sending Telegram message to chatId ${chatId}: ${error.message}`, error.stack);
      }
      return false;
    }
  }

  async processWebhookUpdate(update: any, secretToken: string) {
    try {
      if (!this.webhookSecret || !secretToken) {
        this.logger.warn('Webhook secret not configured or missing.');
        return { success: false, error: 'Webhook not set' };
      }

      if (secretToken !== this.webhookSecret) {
        this.logger.warn('Invalid webhook secret token');
        return { success: false, error: 'Invalid secret token' };
      }

      if (update.message) {
        await this.handleMessage(update.message);
      }
    } catch (error: any) {
      this.logger.error(`Error processing update: ${error.message}`, error.stack);
    }
  }

  private async handleMessage(message: any) {
    const chatId = message.chat.id;
    const text = message.text;

    if (text === '/start') {
      await this.bot.sendMessage(
        chatId,
        '👋 <b>Bienvenido a Market AI!</b>\n\nPara vincular tu cuenta y recibir alertas de precio:\n\n1️⃣ Ve a tu <b>Perfil</b> en Market AI\n2️⃣ Haz clic en <b>Vincular Telegram</b>\n3️⃣ Copia el código de verificación y envíalo aquí con el comando /verify',
        { parse_mode: 'HTML' },
      );
    } else if (text?.startsWith('/verify ')) {
      const code = text.substring(8);
      await this.verifyAndLinkAccount(chatId.toString(), code);
    }
  }

  async unlinkAccount(userId: string): Promise<void> {
    await this.dbService.user.update({
      where: { id: userId },
      data: { telegram_chat_id: null },
    });
  }

  async isLinked(userId: string): Promise<boolean> {
    const user = await this.dbService.user.findUnique({
      where: { id: userId },
      select: { telegram_chat_id: true },
    });
    return !!user?.telegram_chat_id;
  }
}
