import { NextRequest, NextResponse } from 'next/server';
import { calculateTotalScore } from '@/app/services/scoreCalculator';
import { BacktestResult, MetricValues } from '@/app/types/scoring';

// PolyBackTest API configuration
const API_KEY = process.env.POLYBACKTEST_API_KEY;
const API_URL = process.env.POLYBACKTEST_API_URL || 'https://api.polybacktest.com/v1';

export async function POST(request: NextRequest) {
  try {
    // Check API key
    if (!API_KEY) {
      return NextResponse.json(
        { error: 'PolyBackTest API key not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { strategy, timeframe = '1h', period = 90, market = 'BTC' } = body;

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy description is required' },
        { status: 400 }
      );
    }

    // Step 1: Parse strategy (convert NL to params)
    const strategyParams = parseStrategy(strategy);
    const isPolymarket = strategyParams.isPolymarket || false;

    // Step 2: Fetch historical data from PolyBackTest
    const historicalData = await fetchHistoricalData(market, timeframe, period, isPolymarket);

    // Step 3: Run backtest simulation
    const backtestResult = runBacktest(historicalData, strategyParams);

    // Step 4: Calculate scores
    const metrics: MetricValues = {
      profitFactor: backtestResult.profitFactor,
      maxDrawdown: backtestResult.maxDrawdown,
      sharpeRatio: backtestResult.sharpeRatio,
      cagr: backtestResult.cagr,
      winRate: backtestResult.winRate,
    };

    const scoreResult = calculateTotalScore(metrics);

    // Return combined result
    return NextResponse.json({
      success: true,
      strategy: {
        description: strategy,
        parsed: strategyParams,
        recognizedPatterns: strategyParams.recognizedPatterns,
        unrecognizedPatterns: strategyParams.unrecognized,
      },
      backtest: {
        market,
        timeframe,
        period,
        trades: backtestResult.totalTrades,
        startDate: backtestResult.startDate,
        endDate: backtestResult.endDate,
        initialCapital: backtestResult.initialCapital,
        finalCapital: backtestResult.finalCapital,
        totalReturn: backtestResult.totalReturn,
      },
      metrics,
      score: scoreResult,
      warnings: backtestResult.warnings || [],
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Backtest API Error:', error);
    return NextResponse.json(
      { error: 'Failed to run backtest', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Parse natural language strategy
function parseStrategy(description: string) {
  const lower = description.toLowerCase();
  const params: any = {
    indicators: [],
    entryConditions: [],
    exitConditions: [],
    stopLoss: null,
    takeProfit: null,
    recognizedPatterns: [],
    unrecognized: [],
    isPolymarket: false,
    polymarketParams: null,
  };

  // ==========================================
  // POLYMARKET-SPECIFIC PATTERNS
  // ==========================================

  // Check if this is a Polymarket strategy (mentions polymarket, 15m market, binary, yes/no, up/down)
  const isPolymarket = lower.match(/polymarket|15m|15\s*min|binary|yes\s*no|up\s*side|down\s*side|long|short/i);
  
  if (isPolymarket) {
    params.isPolymarket = true;
    params.recognizedPatterns.push('Polymarket_Strategy');
    
    // Extract market type (BTC, ETH, etc)
    const marketMatch = lower.match(/\b(btc|eth|sol|ada|xrp|doge|crypto|market)\b/i);
    if (marketMatch) {
      params.polymarketParams = { market: marketMatch[1].toUpperCase() };
    }

    // TIME-WINDOW Pattern: "Last 15 Seconds" or "son 15 saniye" or "last X seconds/minutes"
    const timeWindowMatch = lower.match(/(?:last|son)\s*(\d+)\s*(?:sec|saniye|second|seconds|s\b)/i);
    if (timeWindowMatch) {
      const seconds = parseInt(timeWindowMatch[1]);
      params.entryConditions.push({ 
        type: 'TIME_WINDOW', 
        condition: 'LAST_N_SECONDS',
        value: seconds,
        description: `Enter in last ${seconds} seconds of market expiry`
      });
      params.recognizedPatterns.push(`Time_Window_Last_${seconds}s`);
    }

    // PRICE THRESHOLD Pattern: "98c+", "98 cent", "95c", "0.98"
    const priceThresholdMatch = lower.match(/(\d{1,2})(?:c|c\+|cent|cents|¢)?\b/i) || 
                                 lower.match(/0\.(\d{2})/);
    if (priceThresholdMatch) {
      // Convert to cents (98c = 0.98, 95 = 0.95)
      let price = parseInt(priceThresholdMatch[1]);
      if (price > 1) price = price / 100; // If > 1, assume it's in cents
      
      params.entryConditions.push({
        type: 'PRICE_THRESHOLD',
        condition: 'PRICE_AT_OR_ABOVE',
        value: price,
        description: `Enter when price reaches ${(price * 100).toFixed(0)}¢ or higher`
      });
      params.recognizedPatterns.push(`Price_Threshold_${(price * 100).toFixed(0)}c`);
    }

    // SIDE Pattern: "whichever side", "buy whichever", "up side", "down side", "long", "short"
    const whicheverSideMatch = lower.match(/whichever\s*side|buy\s*whichever|either\s*side/i);
    const upSideMatch = lower.match(/up\s*side|upside|long|yes\s*side/i);
    const downSideMatch = lower.match(/down\s*side|downside|short|no\s*side/i);
    
    if (whicheverSideMatch) {
      params.entryConditions.push({
        type: 'SIDE',
        condition: 'WHICHEVER',
        value: 'BOTH',
        description: 'Buy whichever side (YES/NO) meets criteria'
      });
      params.recognizedPatterns.push('Side_Whichever');
    } else if (upSideMatch && !downSideMatch) {
      params.entryConditions.push({
        type: 'SIDE',
        condition: 'UP',
        value: 'YES',
        description: 'Buy UP side (YES) only'
      });
      params.recognizedPatterns.push('Side_Up');
    } else if (downSideMatch && !upSideMatch) {
      params.entryConditions.push({
        type: 'SIDE',
        condition: 'DOWN',
        value: 'NO',
        description: 'Buy DOWN side (NO) only'
      });
      params.recognizedPatterns.push('Side_Down');
    }

    // If we detected Polymarket patterns, return early (skip traditional patterns)
    if (params.recognizedPatterns.some((p: string) => p.includes('Time_Window') || p.includes('Price_Threshold'))) {
      return params;
    }
  }

  // ==========================================
  // TRADITIONAL CRYPTO PATTERNS (non-Polymarket)
  // ==========================================

  // RSI pattern: "RSI 30'da al, 70'te sat"
  const rsiMatch = lower.match(/rsi\s*(\d+).*?(\d+)/i);
  if (rsiMatch) {
    params.indicators.push({ type: 'RSI', period: 14 });
    params.entryConditions.push({ indicator: 'RSI', condition: '<', value: parseInt(rsiMatch[1]) });
    params.exitConditions.push({ indicator: 'RSI', condition: '>', value: parseInt(rsiMatch[2]) });
    params.recognizedPatterns.push('RSI_Mean_Reversion');
  }

  // MA pattern: "50 günlük MA üstüne geçince al" or "50 day MA"
  const maMatch = lower.match(/(\d+)\s*(?:günlük|gün|day|period)/i);
  if (maMatch) {
    params.indicators.push({ type: 'MA', period: parseInt(maMatch[1]) });
    params.entryConditions.push({ indicator: 'MA', condition: 'cross_above' });
    params.exitConditions.push({ indicator: 'MA', condition: 'cross_below' });
    params.recognizedPatterns.push('MA_Crossover');
  }

  // MACD pattern
  const macdMatch = lower.match(/macd/i);
  if (macdMatch) {
    params.indicators.push({ type: 'MACD' });
    params.entryConditions.push({ indicator: 'MACD', condition: 'bullish_cross' });
    params.exitConditions.push({ indicator: 'MACD', condition: 'bearish_cross' });
    params.recognizedPatterns.push('MACD');
  }

  // Bollinger Bands pattern
  const bbMatch = lower.match(/bollinger|bb|bands/i);
  if (bbMatch) {
    params.indicators.push({ type: 'BollingerBands' });
    params.entryConditions.push({ indicator: 'BB', condition: 'touch_lower' });
    params.exitConditions.push({ indicator: 'BB', condition: 'touch_upper' });
    params.recognizedPatterns.push('Bollinger_Bands');
  }

  // Timeframe pattern: "15m market", "1h timeframe"
  const timeframeMatch = lower.match(/(\d+)([smh])\s*(?:market|timeframe|tf)/i);
  if (timeframeMatch) {
    const value = parseInt(timeframeMatch[1]);
    const unit = timeframeMatch[2];
    params.timeframe = { value, unit, description: `${value}${unit} timeframe detected` };
    params.recognizedPatterns.push('Timeframe_Specification');
  }

  // Stop loss pattern: "2% stop loss"
  const slMatch = lower.match(/(\d+)%?\s*stop\s*loss/i);
  if (slMatch) {
    params.stopLoss = parseFloat(slMatch[1]);
    params.recognizedPatterns.push('Stop_Loss');
  }

  // Take profit pattern: "5% take profit"
  const tpMatch = lower.match(/(\d+)%?\s*take\s*profit/i);
  if (tpMatch) {
    params.takeProfit = parseFloat(tpMatch[1]);
    params.recognizedPatterns.push('Take_Profit');
  }

  // Breakout pattern
  const breakoutMatch = lower.match(/breakout|break\s*out/i);
  if (breakoutMatch) {
    params.entryConditions.push({ indicator: 'PRICE', condition: 'breakout_above' });
    params.recognizedPatterns.push('Breakout');
  }

  // Support/Resistance pattern
  const srMatch = lower.match(/support|resistance|sr/i);
  if (srMatch) {
    params.recognizedPatterns.push('Support_Resistance');
  }

  return params;
}

// Fetch Polymarket data from PolyBackTest API
// Step 1: Find market by type (15m, 1h, etc)
// Step 2: Get snapshots for that market
async function fetchHistoricalData(market: string, timeframe: string, period: number, isPolymarket: boolean = false) {
  if (!isPolymarket) {
    // For traditional crypto, we need a different data source
    // PolyBackTest only provides Polymarket prediction market data
    throw new Error('Non-Polymarket strategies require a different data provider. PolyBackTest only serves Polymarket data.');
  }

  // Step 1: List markets to find the correct one
  const marketType = timeframeToMarketType(timeframe);
  const marketsUrl = `${API_URL}/markets?market_type=${marketType}&limit=50`;
  
  const marketsResponse = await fetch(marketsUrl, {
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY!,
    },
  });

  if (!marketsResponse.ok) {
    const errorText = await marketsResponse.text().catch(() => 'Unknown error');
    throw new Error(`PolyBackTest markets API error: ${marketsResponse.status} - ${marketsResponse.statusText}. ${errorText}`);
  }

  const marketsData = await marketsResponse.json();
  
  if (!marketsData.markets || marketsData.markets.length === 0) {
    throw new Error(`No markets found for type: ${marketType}. Response: ${JSON.stringify(marketsData)}`);
  }

  // Find a BTC market (or the requested market)
  const targetMarket = marketsData.markets.find((m: any) => 
    m.slug?.toLowerCase().includes(market.toLowerCase()) ||
    m.market_id?.toLowerCase().includes(market.toLowerCase())
  ) || marketsData.markets[0]; // Fallback to first market

  if (!targetMarket || !targetMarket.market_id) {
    throw new Error(`No valid market found. Available markets: ${JSON.stringify(marketsData.markets.slice(0, 3))}`);
  }

  const marketId = targetMarket.market_id;
  
  // Step 2: Get snapshots for this market
  const snapshotsResponse = await fetch(
    `${API_URL}/markets/${marketId}/snapshots?limit=1000`,
    {
      method: 'GET',
      headers: {
        'X-API-Key': API_KEY!,
      },
    }
  );

  if (!snapshotsResponse.ok) {
    throw new Error(`PolyBackTest snapshots API error: ${snapshotsResponse.status} - ${snapshotsResponse.statusText}`);
  }

  const snapshotsData = await snapshotsResponse.json();
  
  if (!snapshotsData.snapshots || snapshotsData.snapshots.length === 0) {
    throw new Error(`No snapshots found for market: ${marketId}`);
  }

  // Convert snapshots to candle-like format for backtest
  return snapshotsToCandles(snapshotsData.snapshots);
}

// Convert timeframe to PolyBackTest market type
function timeframeToMarketType(timeframe: string): string {
  const mapping: Record<string, string> = {
    '5m': '5m',
    '15m': '15m',
    '1h': '1hr',
    '4h': '4hr',
    '24h': '24hr',
    '1d': '24hr',
  };
  return mapping[timeframe] || '15m';
}

// Convert PolyBackTest snapshots to candle format for backtesting
function snapshotsToCandles(snapshots: any[]) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    throw new Error('Invalid snapshots data: expected non-empty array');
  }

  return snapshots.map((snapshot, index) => {
    // Validate snapshot has required fields
    if (!snapshot || typeof snapshot !== 'object') {
      console.warn(`Invalid snapshot at index ${index}:`, snapshot);
      return null;
    }

    const priceUp = typeof snapshot.price_up === 'number' ? snapshot.price_up : 0.5;
    const priceDown = typeof snapshot.price_down === 'number' ? snapshot.price_down : 0.5;
    const btcPrice = typeof snapshot.btc_price === 'number' ? snapshot.btc_price : 45000;
    
    // Use YES token price as the primary price
    const price = priceUp;
    
    // Calculate from adjacent snapshots
    const prevSnapshot = index > 0 ? snapshots[index - 1] : snapshot;
    const prevPrice = typeof prevSnapshot?.price_up === 'number' ? prevSnapshot.price_up : 0.5;
    
    // Parse timestamp safely
    let timestamp = Date.now();
    if (snapshot.time) {
      try {
        timestamp = new Date(snapshot.time).getTime();
        if (isNaN(timestamp)) timestamp = Date.now();
      } catch (e) {
        timestamp = Date.now();
      }
    }
    
    return {
      timestamp,
      open: prevPrice,
      high: Math.max(price, prevPrice),
      low: Math.min(price, prevPrice),
      close: price,
      volume: btcPrice * 0.01,
      // Polymarket-specific data
      priceUp,
      priceDown,
      btcPrice,
      marketId: snapshot.market_id || 'unknown',
    };
  }).filter((c): c is NonNullable<typeof c> => c !== null);
}

// Run backtest simulation
function runBacktest(candles: any[], strategy: any): BacktestResult & { warnings?: string[] } {
  const warnings: string[] = [];
  
  // Check if this is a Polymarket strategy
  const isPolymarket = strategy.isPolymarket || false;
  const hasTimeWindow = strategy.entryConditions.some((e: any) => e.type === 'TIME_WINDOW');
  const hasPriceThreshold = strategy.entryConditions.some((e: any) => e.type === 'PRICE_THRESHOLD');
  
  if (isPolymarket) {
    warnings.push('Polymarket binary market strategy detected');
    
    if (hasTimeWindow && hasPriceThreshold) {
      const timeWindow = strategy.entryConditions.find((e: any) => e.type === 'TIME_WINDOW');
      const priceThreshold = strategy.entryConditions.find((e: any) => e.type === 'PRICE_THRESHOLD');
      warnings.push(`Strategy: Enter in last ${timeWindow?.value}s if price >= ${(priceThreshold?.value * 100).toFixed(0)}¢`);
    }
  }
  
  // POLYMARKET STRATEGY: Time-window + Price threshold
  if (isPolymarket && hasTimeWindow && hasPriceThreshold) {
    return runPolymarketBacktest(candles, strategy, warnings);
  }
  
  // TRADITIONAL CRYPTO STRATEGY
  return runTraditionalBacktest(candles, strategy, warnings);
}

// Polymarket-specific backtest using real snapshot data
function runPolymarketBacktest(candles: any[], strategy: any, warnings: string[]): BacktestResult & { warnings?: string[] } {
  const timeWindow = strategy.entryConditions.find((e: any) => e.type === 'TIME_WINDOW');
  const priceThreshold = strategy.entryConditions.find((e: any) => e.type === 'PRICE_THRESHOLD');
  const sideCondition = strategy.entryConditions.find((e: any) => e.type === 'SIDE');
  
  const initialCapital = 10000;
  let capital = initialCapital;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let maxCapital = initialCapital;
  let minCapital = initialCapital;
  let totalProfit = 0;
  let totalLoss = 0;
  
  const priceThresholdValue = priceThreshold?.value || 0.98; // Default 98c
  const entrySeconds = (timeWindow?.value || 15) * 1000; // Last N seconds in ms
  
  // Group snapshots by market (15m intervals)
  // Each snapshot has: priceUp (YES), priceDown (NO), btcPrice, timestamp
  const markets: any[][] = [];
  let currentMarket: any[] = [];
  let lastTimestamp = 0;
  
  for (const candle of candles) {
    // If gap is more than 20 minutes, start new market
    if (lastTimestamp > 0 && candle.timestamp - lastTimestamp > 20 * 60 * 1000) {
      if (currentMarket.length > 0) markets.push(currentMarket);
      currentMarket = [];
    }
    currentMarket.push(candle);
    lastTimestamp = candle.timestamp;
  }
  if (currentMarket.length > 0) markets.push(currentMarket);
  
  warnings.push(`Found ${markets.length} markets in data`);
  
  // Simulate trading on each market
  for (const market of markets) {
    if (market.length < 2) continue;
    
    const marketStart = market[0].timestamp;
    const marketEnd = market[market.length - 1].timestamp;
    const marketDuration = marketEnd - marketStart;
    
    // Find entry window (last N seconds)
    const entryWindowStart = marketEnd - entrySeconds;
    
    // Find all snapshots in entry window where price >= threshold
    const entryCandidates = market.filter(s => 
      s.timestamp >= entryWindowStart && s.timestamp <= marketEnd && s.priceUp >= priceThresholdValue
    );
    
    if (entryCandidates.length === 0) continue;
    
    // Use first candidate for entry
    const entrySnapshot = entryCandidates[0];
    const entryPrice = entrySnapshot.priceUp;
    
    trades++;
    
    // Determine outcome - check if market resolved UP or DOWN
    // In Polymarket binary markets, if you buy YES and market goes UP, you win
    // We'll use the last snapshot's price to determine outcome direction
    const lastSnapshot = market[market.length - 1];
    const marketResolvedUp = lastSnapshot.btcPrice > entrySnapshot.btcPrice;
    
    // Determine which side we bought
    let boughtSide = 'YES';
    if (sideCondition?.value === 'BOTH') {
      // "Whichever side" - buy the side that reached threshold
      // If UP token reached 98c, we buy UP (YES)
      boughtSide = 'YES';
    } else if (sideCondition?.value === 'NO') {
      boughtSide = 'NO';
    }
    
    // Binary market payout calculation
    // Buy at 98c: Risk $0.98 to win $1.00 (profit = $0.02 = 2%)
    const tradeSize = capital * 0.05; // 5% of capital per trade
    const isWin = (boughtSide === 'YES' && marketResolvedUp) || (boughtSide === 'NO' && !marketResolvedUp);
    
    if (isWin) {
      // Win: Get $1.00, paid $0.98, net profit = $0.02 per $0.98 risked
      const profit = tradeSize * ((1 - entryPrice) / entryPrice);
      capital += profit;
      wins++;
      totalProfit += profit;
    } else {
      // Loss: Lose entire stake
      const loss = tradeSize;
      capital -= loss;
      losses++;
      totalLoss += loss;
    }
    
    maxCapital = Math.max(maxCapital, capital);
    minCapital = Math.min(minCapital, capital);
  }

  // Calculate metrics
  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const maxDrawdown = maxCapital > 0 ? ((maxCapital - minCapital) / maxCapital) * 100 : 0;
  
  // Sharpe ratio for binary outcomes
  const sharpeRatio = trades > 10 ? (winRate / 100 - 0.5) / (Math.sqrt((winRate/100)*(1-winRate/100)) + 0.001) : 0.5;
  
  // CAGR
  const days = markets.length / 96; // 96 15m periods per day
  const cagr = days > 0 ? (Math.pow(1 + totalReturn / 100, 365 / days) - 1) * 100 : 0;

  return {
    totalTrades: trades,
    winningTrades: wins,
    losingTrades: losses,
    profitFactor: Math.min(5, profitFactor),
    maxDrawdown: Math.min(100, maxDrawdown),
    sharpeRatio: Math.min(3, Math.max(-3, sharpeRatio)),
    cagr: Math.max(-100, Math.min(500, cagr)),
    winRate: Math.min(100, winRate),
    initialCapital,
    finalCapital: capital,
    totalReturn,
    startDate: candles[0]?.timestamp || Date.now(),
    endDate: candles[candles.length - 1]?.timestamp || Date.now(),
    warnings,
  };
}

// Traditional crypto backtest
function runTraditionalBacktest(candles: any[], strategy: any, warnings: string[]): BacktestResult & { warnings?: string[] } {
  // Check if no patterns recognized at all
  if (strategy.recognizedPatterns.length === 0 && strategy.indicators.length === 0) {
    warnings.push('No recognizable strategy patterns found. Using generic mean-reversion simulation.');
    warnings.push('Supported patterns: RSI, MA, MACD, Bollinger Bands, Breakout, Stop Loss, Take Profit, Polymarket Time/Price Threshold');
  }
  
  const initialCapital = 10000;
  let capital = initialCapital;
  let trades = 0;
  let wins = 0;
  let losses = 0;
  let maxCapital = initialCapital;
  let minCapital = initialCapital;
  let totalProfit = 0;
  let totalLoss = 0;
  
  let position: 'long' | 'short' | null = null;
  let entryPrice = 0;
  let entryTime = 0;

  // Determine which strategy to simulate based on detected patterns
  const hasRSI = strategy.indicators.some((ind: any) => ind.type === 'RSI');
  const hasMA = strategy.indicators.some((ind: any) => ind.type === 'MA');
  const hasBreakout = strategy.recognizedPatterns.includes('Breakout');
  
  // Simulate trades based on strategy type
  for (let i = 20; i < candles.length - 1; i++) {
    const candle = candles[i];
    
    let shouldEnter = false;
    let shouldExit = false;
    
    if (hasRSI) {
      // RSI Mean Reversion Strategy
      const rsi = calculateRSI(candles, i, 14);
      if (!position && rsi < 30) {
        shouldEnter = true;
      }
      if (position === 'long' && rsi > 70) {
        shouldExit = true;
      }
    } else if (hasMA) {
      // MA Crossover Strategy
      const ma20 = calculateMA(candles, i, 20);
      const ma50 = calculateMA(candles, i, 50);
      const prevMA20 = calculateMA(candles, i - 1, 20);
      const prevMA50 = calculateMA(candles, i - 1, 50);
      
      if (!position && prevMA20 <= prevMA50 && ma20 > ma50) {
        shouldEnter = true;
      }
      if (position === 'long' && prevMA20 >= prevMA50 && ma20 < ma50) {
        shouldExit = true;
      }
    } else if (hasBreakout) {
      // Breakout Strategy
      const highest20 = Math.max(...candles.slice(i - 20, i).map((c: any) => c.high));
      if (!position && candle.close > highest20) {
        shouldEnter = true;
      }
      const lowest10 = Math.min(...candles.slice(i - 10, i).map((c: any) => c.low));
      if (position === 'long' && candle.close < lowest10) {
        shouldExit = true;
      }
    } else {
      // Default: Mean reversion
      const rsi = calculateRSI(candles, i, 14);
      if (!position && rsi < 35) {
        shouldEnter = true;
      }
      if (position === 'long' && rsi > 65) {
        shouldExit = true;
      }
    }
    
    // Entry logic
    if (!position && shouldEnter) {
      position = 'long';
      entryPrice = candle.close;
      entryTime = candle.timestamp;
    }
    
    // Exit logic
    if (position === 'long') {
      const pnl = (candle.close - entryPrice) / entryPrice;
      
      const stopLossHit = strategy.stopLoss && pnl < -strategy.stopLoss / 100;
      const takeProfitHit = strategy.takeProfit && pnl > strategy.takeProfit / 100;
      
      if (shouldExit || stopLossHit || takeProfitHit) {
        const tradePnl = pnl * capital * 0.1;
        capital += tradePnl;
        trades++;
        
        if (tradePnl > 0) {
          wins++;
          totalProfit += tradePnl;
        } else {
          losses++;
          totalLoss += Math.abs(tradePnl);
        }
        
        maxCapital = Math.max(maxCapital, capital);
        minCapital = Math.min(minCapital, capital);
        position = null;
      }
    }
  }

  // Close any open position at end
  if (position === 'long') {
    const lastCandle = candles[candles.length - 1];
    const pnl = (lastCandle.close - entryPrice) / entryPrice;
    const tradePnl = pnl * capital * 0.1;
    capital += tradePnl;
    trades++;
    
    if (tradePnl > 0) {
      wins++;
      totalProfit += tradePnl;
    } else {
      losses++;
      totalLoss += Math.abs(tradePnl);
    }
    
    maxCapital = Math.max(maxCapital, capital);
    minCapital = Math.min(minCapital, capital);
    warnings.push('Open position closed at end of backtest period');
  }

  // Calculate metrics
  const totalReturn = ((capital - initialCapital) / initialCapital) * 100;
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
  const winRate = trades > 0 ? (wins / trades) * 100 : 0;
  const maxDrawdown = maxCapital > 0 ? ((maxCapital - minCapital) / maxCapital) * 100 : 0;
  const volatility = trades > 0 ? Math.abs(totalReturn) / Math.sqrt(trades) : 1;
  const sharpeRatio = volatility > 0 ? (totalReturn / 100) / (volatility / 100) : 0;
  const days = candles.length;
  const cagr = days > 0 ? (Math.pow(1 + totalReturn / 100, 365 / days) - 1) * 100 : 0;

  return {
    totalTrades: trades,
    winningTrades: wins,
    losingTrades: losses,
    profitFactor: Math.min(5, profitFactor),
    maxDrawdown: Math.min(100, maxDrawdown),
    sharpeRatio: Math.min(3, sharpeRatio),
    cagr: Math.max(-100, Math.min(500, cagr)),
    winRate: Math.min(100, winRate),
    initialCapital,
    finalCapital: capital,
    totalReturn,
    startDate: candles[0]?.timestamp || Date.now(),
    endDate: candles[candles.length - 1]?.timestamp || Date.now(),
    warnings,
  };
}

// Calculate RSI (Real calculation, not mock)
function calculateRSI(candles: any[], index: number, period: number): number {
  if (index < period) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = index - period + 1; i <= index; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate Moving Average
function calculateMA(candles: any[], index: number, period: number): number {
  if (index < period - 1) return candles[index].close;
  
  let sum = 0;
  for (let i = index - period + 1; i <= index; i++) {
    sum += candles[i].close;
  }
  return sum / period;
}
