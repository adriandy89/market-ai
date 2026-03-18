import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { CacheService, DbService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';
import { PriceAlertsService } from '../price-alerts/price-alerts.service';
import { TelegramService } from './telegram.service';

interface FlowState {
  step: 'select_coin' | 'select_direction' | 'select_percent';
  symbol?: string;
  direction?: 'UP' | 'DOWN';
  page?: number;
}

@Injectable()
export class TelegramBotHandler {
  private readonly logger = new Logger(TelegramBotHandler.name);

  private readonly COIN_GRID = [
    'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA',
    'DOGE', 'DOT', 'AVAX', 'LINK', 'LTC', 'UNI',
    'ATOM', 'SHIB', 'MATIC', 'NEAR', 'ARB', 'OP',
    'SUI', 'PEPE', 'TON', 'TRX', 'FET', 'INJ',
  ];
  private readonly COINS_PER_PAGE = 16;
  private readonly PERCENTAGES = [1, 2, 5, 10, 20, 25, 50, 100];

  constructor(
    @Inject(forwardRef(() => TelegramService))
    private readonly telegram: TelegramService,
    private readonly priceAlerts: PriceAlertsService,
    private readonly crypto: CryptoService,
    private readonly cache: CacheService,
    private readonly db: DbService,
  ) {}

  async handleAlertasCommand(chatId: string) {
    const user = await this.getUserByChatId(chatId);
    if (!user) {
      await this.telegram.sendMessage(chatId, '⚠️ Cuenta no vinculada. Usa /start para vincular tu cuenta.');
      return;
    }
    await this.clearState(chatId);
    await this.showMainMenu(chatId, null, user.id);
  }

  async handleCallbackQuery(query: any) {
    const chatId = query.message?.chat?.id?.toString();
    const messageId = query.message?.message_id;
    const data = query.data as string;

    if (!chatId || !data) return;

    await this.telegram.answerCallbackQuery(query.id);

    if (!data.startsWith('alert:')) return;

    const user = await this.getUserByChatId(chatId);
    if (!user) {
      await this.telegram.sendMessage(chatId, '⚠️ Cuenta no vinculada. Usa /start para vincular tu cuenta.');
      return;
    }

    try {
      if (data === 'alert:menu' || data === 'alert:refresh') {
        await this.clearState(chatId);
        await this.showMainMenu(chatId, messageId, user.id);
      } else if (data === 'alert:create') {
        await this.showCoinGrid(chatId, messageId, 0);
      } else if (data.startsWith('alert:coin:')) {
        const symbol = data.substring(11);
        await this.showDirectionPicker(chatId, messageId, symbol);
      } else if (data.startsWith('alert:coinpage:')) {
        const page = parseInt(data.substring(15));
        await this.showCoinGrid(chatId, messageId, page);
      } else if (data.startsWith('alert:dir:')) {
        const direction = data.substring(10) as 'UP' | 'DOWN';
        const state = await this.getState(chatId);
        if (!state?.symbol) {
          await this.showMainMenu(chatId, messageId, user.id);
          return;
        }
        await this.showPercentagePicker(chatId, messageId, state.symbol, direction);
      } else if (data.startsWith('alert:pct:')) {
        const pct = parseInt(data.substring(10));
        await this.handleCreateAlert(chatId, messageId, user.id, pct);
      } else if (data === 'alert:dellist') {
        await this.showDeleteList(chatId, messageId, user.id);
      } else if (data.startsWith('alert:del:')) {
        const alertId = data.substring(10);
        await this.handleDeleteAlert(chatId, messageId, user.id, alertId);
      } else if (data === 'alert:help') {
        await this.showHelp(chatId, messageId);
      } else if (data === 'alert:back') {
        await this.handleBack(chatId, messageId, user.id);
      }
    } catch (error: any) {
      this.logger.error(`Error handling callback ${data}: ${error.message}`, error.stack);
    }
  }

  private async showMainMenu(chatId: string, messageId: number | null, userId: string) {
    const alerts = await this.priceAlerts.findAllByUser(userId, undefined, true);

    let text = '📊 <b>Alertas de Precio</b>\n\n';

    if (alerts.length === 0) {
      text += '<i>No tienes alertas activas.</i>\n\nUsa <b>➕ Crear</b> para configurar una nueva alerta.';
    } else {
      const symbols = [...new Set(alerts.map((a) => a.symbol))];
      const prices = new Map<string, number>();

      await Promise.allSettled(
        symbols.map(async (sym) => {
          const price = await this.crypto.getBinancePrice(sym);
          if (price) prices.set(sym, price);
        }),
      );

      text += '🔔 <b>Alertas activas</b>\n';
      const displayAlerts = alerts.slice(0, 10);
      for (const alert of displayAlerts) {
        const dirEmoji = alert.direction === 'UP' ? '📈' : alert.direction === 'DOWN' ? '📉' : '↕️';
        const threshold = alert.threshold_percent
          ? `${alert.threshold_percent}%`
          : `$${this.formatPrice(alert.threshold_price!)}`;

        let targetPrice = '';
        if (alert.threshold_percent && alert.base_price) {
          const mult = alert.direction === 'DOWN' ? -1 : 1;
          const target = alert.base_price * (1 + (mult * alert.threshold_percent) / 100);
          targetPrice = ` → $${this.formatPrice(target)}`;
        } else if (alert.threshold_price) {
          targetPrice = ` → $${this.formatPrice(alert.threshold_price)}`;
        }

        text += `${alert.symbol} ${dirEmoji} ${threshold}${targetPrice}`;
        if (alert.is_recurring) text += ' 🔄';
        text += '\n';
      }
      if (alerts.length > 10) {
        text += `<i>...y ${alerts.length - 10} más</i>\n`;
      }

      if (prices.size > 0) {
        text += '\n💰 <b>Precios actuales</b>\n';
        for (const [sym, price] of prices) {
          text += `${sym}  $${this.formatPrice(price)}\n`;
        }
      }
    }

    const keyboard = [
      [
        { text: '🗑 Eliminar', callback_data: 'alert:dellist' },
        { text: '➕ Crear', callback_data: 'alert:create' },
      ],
      [{ text: '🔄 Refrescar', callback_data: 'alert:refresh' }],
      [{ text: '❓ Ayuda', callback_data: 'alert:help' }],
    ];

    if (messageId) {
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
    } else {
      await this.telegram.sendMessageWithKeyboard(chatId, text, keyboard);
    }
  }

  private async showCoinGrid(chatId: string, messageId: number, page: number) {
    const start = page * this.COINS_PER_PAGE;
    const end = start + this.COINS_PER_PAGE;
    const coins = this.COIN_GRID.slice(start, end);
    const totalPages = Math.ceil(this.COIN_GRID.length / this.COINS_PER_PAGE);

    await this.setState(chatId, { step: 'select_coin', page });

    const text = '🪙 <b>Selecciona una moneda ...</b>';

    const rows: any[][] = [];
    for (let i = 0; i < coins.length; i += 4) {
      rows.push(
        coins.slice(i, i + 4).map((c) => ({
          text: c,
          callback_data: `alert:coin:${c}`,
        })),
      );
    }

    const navRow: any[] = [];
    if (page > 0) {
      navRow.push({ text: '⬅️ Anterior', callback_data: `alert:coinpage:${page - 1}` });
    }
    if (end < this.COIN_GRID.length) {
      navRow.push({ text: '➡️ Siguiente', callback_data: `alert:coinpage:${page + 1}` });
    }
    if (navRow.length) rows.push(navRow);

    rows.push([{ text: '💠 Volver', callback_data: 'alert:menu' }]);

    await this.telegram.editMessageWithKeyboard(chatId, messageId, text, rows);
  }

  private async showDirectionPicker(chatId: string, messageId: number, symbol: string) {
    await this.setState(chatId, { step: 'select_direction', symbol });

    let text = `🎯 <b>${symbol}</b>\n`;

    const price = await this.crypto.getBinancePrice(symbol);
    if (price) {
      text += `Precio actual: <b>$${this.formatPrice(price)}</b>\n`;
    }
    text += '\nCrear alerta cuando ...';

    const keyboard = [
      [
        { text: '📉 Baje', callback_data: 'alert:dir:DOWN' },
        { text: '📈 Suba', callback_data: 'alert:dir:UP' },
      ],
      [{ text: '💠 Volver', callback_data: 'alert:back' }],
    ];

    await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
  }

  private async showPercentagePicker(chatId: string, messageId: number, symbol: string, direction: 'UP' | 'DOWN') {
    await this.setState(chatId, { step: 'select_percent', symbol, direction });

    const dirText = direction === 'UP' ? 'suba' : 'baje';
    const dirEmoji = direction === 'UP' ? '📈' : '📉';

    let text = `${dirEmoji} <b>${symbol}</b>\n`;

    const price = await this.crypto.getBinancePrice(symbol);
    if (price) {
      text += `Precio actual: <b>$${this.formatPrice(price)}</b>\n`;
    }
    text += `Crear alerta cuando ${dirText} ...\n`;

    const rows: any[][] = [];
    for (let i = 0; i < this.PERCENTAGES.length; i += 4) {
      rows.push(
        this.PERCENTAGES.slice(i, i + 4).map((p) => ({
          text: `${p}%`,
          callback_data: `alert:pct:${p}`,
        })),
      );
    }
    rows.push([{ text: '💠 Volver', callback_data: 'alert:back' }]);

    await this.telegram.editMessageWithKeyboard(chatId, messageId, text, rows);
  }

  private async handleCreateAlert(chatId: string, messageId: number, userId: string, pct: number) {
    const state = await this.getState(chatId);
    if (!state?.symbol || !state?.direction) {
      await this.showMainMenu(chatId, messageId, userId);
      return;
    }

    try {
      await this.priceAlerts.create(userId, {
        symbol: state.symbol,
        name: state.symbol,
        alertType: 'PERCENTAGE_CHANGE_FROM_PRICE' as any,
        direction: state.direction as any,
        thresholdPercent: pct,
        isRecurring: true,
      });

      await this.clearState(chatId);

      const dirEmoji = state.direction === 'UP' ? '📈' : '📉';
      const dirText = state.direction === 'UP' ? 'suba' : 'baje';
      const text = `✅ <b>Alerta creada</b>\n\n${dirEmoji} ${state.symbol} — cuando ${dirText} ${pct}%\n🔄 Recurrente`;

      const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
    } catch (error: any) {
      this.logger.error(`Error creating alert: ${error.message}`, error.stack);
      const text = '⚠️ <b>Error al crear alerta</b>\n\nIntenta nuevamente.';
      const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
    }
  }

  private async showDeleteList(chatId: string, messageId: number, userId: string) {
    const alerts = await this.priceAlerts.findAllByUser(userId, undefined, true);

    if (alerts.length === 0) {
      const text = '📭 <b>No tienes alertas activas para eliminar.</b>';
      const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
      return;
    }

    const text = '🗑 <b>Selecciona la alerta a eliminar:</b>';
    const rows: any[][] = alerts.slice(0, 10).map((alert) => {
      const dirEmoji = alert.direction === 'UP' ? '📈' : alert.direction === 'DOWN' ? '📉' : '↕️';
      const threshold = alert.threshold_percent
        ? `${alert.threshold_percent}%`
        : `$${this.formatPrice(alert.threshold_price!)}`;
      return [
        {
          text: `${dirEmoji} ${alert.symbol} ${threshold}`,
          callback_data: `alert:del:${alert.id}`,
        },
      ];
    });

    rows.push([{ text: '💠 Volver', callback_data: 'alert:menu' }]);

    await this.telegram.editMessageWithKeyboard(chatId, messageId, text, rows);
  }

  private async handleDeleteAlert(chatId: string, messageId: number, userId: string, alertId: string) {
    try {
      const alert = await this.priceAlerts.findOne(alertId, userId);
      await this.priceAlerts.remove(alertId, userId);

      const text = `🗑 <b>Alerta eliminada</b>\n\n${alert.symbol} — ${alert.threshold_percent ? alert.threshold_percent + '%' : '$' + this.formatPrice(alert.threshold_price!)}`;
      const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
    } catch (error: any) {
      this.logger.error(`Error deleting alert: ${error.message}`, error.stack);
      const text = '⚠️ <b>Error al eliminar alerta</b>\n\nPuede que ya haya sido eliminada.';
      const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
      await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
    }
  }

  private async showHelp(chatId: string, messageId: number) {
    const text = [
      '❓ <b>Ayuda — Alertas de Precio</b>',
      '',
      '📈 <b>Crear alerta:</b> Selecciona moneda → dirección (sube/baja) → porcentaje.',
      'Se crea una alerta recurrente que te notifica cada vez que el precio cambia el % indicado.',
      '',
      '🗑 <b>Eliminar:</b> Selecciona la alerta que deseas eliminar.',
      '',
      '🔄 <b>Refrescar:</b> Actualiza precios y estado de alertas.',
      '',
      '💡 Las alertas se evalúan cada 60 segundos.',
      '',
      '🌐 Para más opciones (precio fijo, ventana de tiempo), usa la plataforma web.',
    ].join('\n');

    const keyboard = [[{ text: '📊 Volver al menú', callback_data: 'alert:menu' }]];
    await this.telegram.editMessageWithKeyboard(chatId, messageId, text, keyboard);
  }

  private async handleBack(chatId: string, messageId: number, userId: string) {
    const state = await this.getState(chatId);

    if (!state) {
      await this.showMainMenu(chatId, messageId, userId);
      return;
    }

    switch (state.step) {
      case 'select_percent':
        if (state.symbol) {
          await this.showDirectionPicker(chatId, messageId, state.symbol);
        } else {
          await this.showCoinGrid(chatId, messageId, 0);
        }
        break;
      case 'select_direction':
        await this.showCoinGrid(chatId, messageId, state.page ?? 0);
        break;
      case 'select_coin':
      default:
        await this.clearState(chatId);
        await this.showMainMenu(chatId, messageId, userId);
        break;
    }
  }

  private async getUserByChatId(chatId: string) {
    return this.db.user.findFirst({
      where: { telegram_chat_id: chatId },
      select: { id: true, language: true },
    });
  }

  private async getState(chatId: string): Promise<FlowState | null> {
    return this.cache.get<FlowState>(`telegram:flow:${chatId}`);
  }

  private async setState(chatId: string, state: FlowState): Promise<void> {
    await this.cache.set(`telegram:flow:${chatId}`, state, 300);
  }

  private async clearState(chatId: string): Promise<void> {
    await this.cache.del(`telegram:flow:${chatId}`);
  }

  private formatPrice(price: number): string {
    if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return price.toPrecision(4);
  }
}
