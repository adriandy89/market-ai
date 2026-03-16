import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { DbService } from 'src/libs';
import { CryptoService } from '../crypto/crypto.service';
import { AnalysisService } from '../analysis/analysis.service';
import { MarketContextService } from '../market-context/market-context.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private readonly configService: ConfigService,
    private readonly dbService: DbService,
    private readonly cryptoService: CryptoService,
    private readonly analysisService: AnalysisService,
    private readonly marketContextService: MarketContextService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.configService.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  async generateReport(userId: string, symbol: string, timeframe: string = '4h', language: string = 'es') {
    // Check for fresh shared report (15min window, same language)
    const fresh = await this.findFreshReport(symbol, timeframe, 'full', language);
    if (fresh) {
      this.logger.log(`Reusing fresh report for ${symbol}/${timeframe}/${language} (${fresh.id})`);
      return this.cloneReportForUser(fresh, userId);
    }
    const langInstruction = language === 'es' ? 'Write the entire report in Spanish.' : 'Write the entire report in English.';

    // Gather all market context in parallel (all from Binance klines)
    const [price, indicators, patterns, levels] = await Promise.all([
      this.cryptoService.getCoinPrice(symbol),
      this.analysisService.getIndicators(symbol, timeframe),
      this.analysisService.getPatterns(symbol, timeframe),
      this.analysisService.getSupportResistance(symbol, timeframe),
    ]);

    const marketContext = JSON.stringify({ price, indicators, patterns, levels }, null, 2);

    let aiAnalysis: string;
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: `You are an expert crypto market analyst. Analyze the provided market data and generate a professional report in Markdown format.

Use this exact structure:

## Executive Summary
(2-3 sentences summarizing the current state and key takeaway)

## Technical Analysis
### Trend
(Direction, strength, key moving averages)
### Momentum
(RSI, Stochastic, MACD interpretation)
### Volatility
(Bollinger Bands position, ADX)

## Signals
| Type | Indicator | Detail |
|------|-----------|--------|
(Table with bullish/bearish/neutral signals)

## Risk Assessment
**Level:** (Low/Medium/High)
(Explanation of risk factors)

## Outlook
(1-7 day forecast with key price levels to watch)

${langInstruction}`,
        messages: [
          {
            role: 'user',
            content: `Analyze ${symbol} on the ${timeframe} timeframe. Here is the current market data:\n\n${marketContext}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      aiAnalysis = textBlock?.text?.trim() || '';
    } catch (error) {
      this.logger.error(`Anthropic API error for ${symbol}:`, error);
      aiAnalysis = `## Executive Summary\nAnalysis for ${symbol} could not be generated due to an API error.`;
    }

    const aiSummary = this.extractSummary(aiAnalysis);

    const reportContent = {
      symbol,
      timeframe,
      price,
      indicators: indicators?.indicators || null,
      patterns: patterns?.patterns || [],
      levels,
      aiAnalysis,
      aiSummary,
      language,
      generatedAt: new Date().toISOString(),
    };

    const report = await this.dbService.analysisReport.create({
      data: {
        user_id: userId,
        symbol,
        timeframe,
        report_type: 'full',
        content: reportContent,
      },
    });

    return report;
  }

  async generateComprehensiveReport(userId: string, symbol: string, language: string = 'es') {
    // Check for fresh shared report (15min window, same language)
    const fresh = await this.findFreshReport(symbol, 'multi', 'comprehensive', language);
    if (fresh) {
      this.logger.log(`Reusing fresh comprehensive report for ${symbol}/${language} (${fresh.id})`);
      return this.cloneReportForUser(fresh, userId);
    }
    const langInstruction = language === 'es' ? 'Write the entire report in Spanish.' : 'Write the entire report in English.';

    // Gather all data in parallel
    const [price, multiTf, marketContext] = await Promise.allSettled([
      this.cryptoService.getCoinPrice(symbol),
      this.analysisService.getMultiTimeframeAnalysis(symbol),
      this.marketContextService.getFullContext(symbol),
    ]);

    const priceData = price.status === 'fulfilled' ? price.value : null;
    const multiTfData = multiTf.status === 'fulfilled' ? multiTf.value : null;
    const contextData = marketContext.status === 'fulfilled' ? marketContext.value : null;

    // Build the comprehensive prompt context
    const promptSections: string[] = [`Analyze ${symbol} comprehensively. Here is the full market context:`];

    // Price section
    if (priceData) {
      promptSections.push(`\n## CURRENT PRICE\nPrice: $${priceData.price}\n24h Change: ${priceData.change24h?.toFixed(2)}%\nVolume 24h: $${priceData.volume24h}\nMarket Cap: $${priceData.marketCap}`);
    }

    // Multi-timeframe technical analysis
    if (multiTfData?.timeframes) {
      for (const tf of ['4h', '1d', '1w'] as const) {
        const tfData = multiTfData.timeframes[tf];
        if (!tfData) continue;

        const ind = tfData.indicators?.indicators;
        promptSections.push(`\n## TECHNICAL ANALYSIS — ${tf.toUpperCase()}`);

        if (ind) {
          const lines: string[] = [];
          if (ind.rsi) lines.push(`RSI(14): ${ind.rsi.value?.toFixed(1)} [${ind.rsi.signal}]`);
          if (ind.macd) lines.push(`MACD: histogram=${ind.macd.histogram?.toFixed(4)} [${ind.macd.trend}]`);
          if (ind.stochastic) lines.push(`Stochastic: K=${ind.stochastic.k?.toFixed(1)} D=${ind.stochastic.d?.toFixed(1)} [${ind.stochastic.signal}]`);
          if (ind.adx) lines.push(`ADX: ${ind.adx.adx?.toFixed(1)} [${ind.adx.trendStrength}]`);
          if (ind.bollingerBands) lines.push(`Bollinger: position=${ind.bollingerBands.position}`);
          if (ind.ema) lines.push(`EMA: 9=${ind.ema.ema9?.toFixed(2)} 21=${ind.ema.ema21?.toFixed(2)} 50=${ind.ema.ema50?.toFixed(2) || 'N/A'} 200=${ind.ema.ema200?.toFixed(2) || 'N/A'}`);
          if (ind.sma) lines.push(`SMA: 20=${ind.sma.sma20?.toFixed(2)} 50=${ind.sma.sma50?.toFixed(2) || 'N/A'} 200=${ind.sma.sma200?.toFixed(2) || 'N/A'}`);
          promptSections.push(lines.join('\n'));
        }

        if (tfData.patterns?.patterns?.length > 0) {
          promptSections.push(`Patterns: ${tfData.patterns.patterns.map((p: any) => `${p.name}(${p.type})`).join(', ')}`);
        }

        if (tfData.levels?.pivot) {
          const l = tfData.levels;
          promptSections.push(`Pivot: $${l.pivot?.toFixed(2)} | R1=$${l.resistance?.[0]?.price?.toFixed(2)} R2=$${l.resistance?.[1]?.price?.toFixed(2)} | S1=$${l.support?.[0]?.price?.toFixed(2)} S2=$${l.support?.[1]?.price?.toFixed(2)}`);
        }
      }
    }

    // Confluence
    if (multiTfData?.confluence) {
      const c = multiTfData.confluence;
      promptSections.push(`\n## CONFLUENCE ANALYSIS\nTrend Alignment: ${c.trendAlignment} (strength: ${c.strength})\nBias: 4h=${c.biasPerTimeframe?.['4h']} 1d=${c.biasPerTimeframe?.['1d']} 1w=${c.biasPerTimeframe?.['1w']}`);
      if (c.keyObservations?.length > 0) {
        promptSections.push(`Key Observations:\n${c.keyObservations.map((o: string) => `- ${o}`).join('\n')}`);
      }
    }

    // News
    if (contextData?.news?.items?.length) {
      promptSections.push(`\n## NEWS & EVENTS (recent)\nOverall News Sentiment: ${contextData.news.overallSentiment}`);
      const newsLines = contextData.news.items.slice(0, 8).map(
        (n) => `- [${n.sentiment}] ${n.title} (${n.source})`,
      );
      promptSections.push(newsLines.join('\n'));
    }

    // Sentiment
    if (contextData?.sentiment) {
      const s = contextData.sentiment;
      promptSections.push(`\n## MARKET SENTIMENT\nFear & Greed Index: ${s.fearGreedIndex.value} (${s.fearGreedIndex.classification})`);
      if (s.fearGreedIndex.trend?.length > 1) {
        const trend7d = s.fearGreedIndex.trend.map((t) => t.value);
        const avg = trend7d.reduce((a, b) => a + b, 0) / trend7d.length;
        promptSections.push(`7-day F&G Average: ${avg.toFixed(0)} | Current vs avg: ${s.fearGreedIndex.value > avg ? 'improving' : 'declining'}`);
      }
      const gm = s.globalMarket;
      if (gm.totalMarketCap) {
        promptSections.push(`Global Market Cap: $${(gm.totalMarketCap / 1e12).toFixed(2)}T (${gm.marketCapChange24h?.toFixed(2)}% 24h)\nBTC Dominance: ${gm.btcDominance?.toFixed(1)}%\nGlobal Volume 24h: $${(gm.totalVolume24h / 1e9).toFixed(1)}B`);
      }
    }

    // Macro context
    if (contextData?.macro) {
      const m = contextData.macro;
      promptSections.push(`\n## MACRO & GEOPOLITICAL CONTEXT\nMarket Regime: ${m.marketRegime}`);
      if (m.regulatoryNews?.length > 0) {
        promptSections.push(`Regulatory News:\n${m.regulatoryNews.slice(0, 3).map((n) => `- ${n.title}`).join('\n')}`);
      }
      if (m.macroEvents?.length > 0) {
        promptSections.push(`Macro Events:\n${m.macroEvents.slice(0, 3).map((n) => `- ${n.title}`).join('\n')}`);
      }
    }

    const userMessage = promptSections.join('\n');

    let aiAnalysis: string;
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: `You are an institutional-grade crypto market analyst. Synthesize ALL provided data into a comprehensive report in Markdown format.

Use this exact structure:

## Executive Summary
(3-4 sentences synthesizing technical, sentiment, and macro factors)

## Multi-Timeframe Analysis
### 4H — Short Term
**Bias:** (Bullish/Bearish/Neutral)
(Trend direction, key signals)
### 1D — Medium Term
**Bias:** (Bullish/Bearish/Neutral)
(Trend direction, key signals)
### 1W — Long Term
**Bias:** (Bullish/Bearish/Neutral)
(Trend direction, key signals)

## Confluence
**Alignment:** (description) | **Strength:** (Strong/Moderate/Weak)
(Details on cross-timeframe agreement/divergence)

## Signals
| Type | Source | Indicator | Detail | Weight |
|------|--------|-----------|--------|--------|
(Comprehensive signal table)

## Sentiment Analysis
- **Fear & Greed:** (value and interpretation)
- **News Impact:** (assessment)
- **Overall:** (summary)

## Risk Assessment
**Level:** (Low/Medium/High/Extreme)
**Factors:**
- (factor 1)
- (factor 2)
**Key Risks:**
- (risk 1)
- (risk 2)

## Trading Scenarios
### Bull Case
**Trigger:** (what needs to happen)
**Targets:** (price levels)
**Probability:** (assessment)
### Bear Case
**Trigger:** (what needs to happen)
**Targets:** (price levels)
**Probability:** (assessment)

## Outlook
**Short Term:** (1-3 days)
**Medium Term:** (1-2 weeks)
**Key Levels:** (list of important price levels)

${langInstruction}`,
        messages: [{ role: 'user', content: userMessage }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      aiAnalysis = textBlock?.text?.trim() || '';
    } catch (error) {
      this.logger.error(`Anthropic API error for comprehensive ${symbol}:`, error);
      aiAnalysis = `## Executive Summary\nComprehensive analysis for ${symbol} could not be generated due to an API error.`;
    }

    const aiSummary = this.extractSummary(aiAnalysis);

    const reportContent = {
      symbol,
      timeframes: ['4h', '1d', '1w'],
      price: priceData,
      multiTimeframeData: multiTfData?.timeframes || null,
      confluence: multiTfData?.confluence || null,
      marketContext: {
        news: contextData?.news || null,
        sentiment: contextData?.sentiment || null,
        macro: contextData?.macro || null,
      },
      aiAnalysis,
      aiSummary,
      language,
      generatedAt: new Date().toISOString(),
    };

    const report = await this.dbService.analysisReport.create({
      data: {
        user_id: userId,
        symbol,
        timeframe: 'multi',
        report_type: 'comprehensive',
        content: reportContent as any,
      },
    });

    return report;
  }

  private extractSummary(markdown: string): string {
    // Match first ## section content (any language: Executive Summary, Resumen Ejecutivo, etc.)
    const match = markdown.match(/^##\s+.+\n+([\s\S]*?)(?=\n##|$)/m);
    if (match?.[1]?.trim()) {
      return match[1].trim().slice(0, 200);
    }
    // Fallback: first non-empty paragraph
    const lines = markdown.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    return lines[0]?.trim().slice(0, 200) || '';
  }

  private async findFreshReport(symbol: string, timeframe: string, reportType: string, language: string = 'es') {
    const freshThreshold = new Date(Date.now() - 15 * 60 * 1000);
    const reports = await this.dbService.analysisReport.findMany({
      where: {
        symbol,
        timeframe,
        report_type: reportType,
        created_at: { gte: freshThreshold },
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    });
    // Filter by language stored in content
    return reports.find((r: any) => (r.content as any)?.language === language) || null;
  }

  private async cloneReportForUser(source: { id: string; user_id: string; symbol: string; timeframe: string; report_type: string; content: any }, userId: string) {
    if (source.user_id === userId) return source;

    return this.dbService.analysisReport.create({
      data: {
        user_id: userId,
        symbol: source.symbol,
        timeframe: source.timeframe,
        report_type: source.report_type,
        content: source.content as any,
      },
    });
  }

  async getUserReports(userId: string, page: number = 1, limit: number = 10, symbol?: string) {
    const skip = (page - 1) * limit;
    const where: { user_id: string; symbol?: string } = { user_id: userId };
    if (symbol) where.symbol = symbol;

    const [itemCount, reports] = await this.dbService.$transaction([
      this.dbService.analysisReport.count({ where }),
      this.dbService.analysisReport.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { data: reports, meta: { itemCount, page, limit } };
  }

  async getReport(reportId: string, userId: string) {
    return this.dbService.analysisReport.findFirst({
      where: { id: reportId, user_id: userId },
    });
  }
}
