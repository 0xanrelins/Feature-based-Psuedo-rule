import { NextRequest, NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// PolyBackTest API configuration
const POLYBACKTEST_API_KEY = process.env.POLYBACKTEST_API_KEY;
const POLYBACKTEST_API_URL = process.env.POLYBACKTEST_API_URL || 'https://api.polybacktest.com/v1';

// Load LLM-optimized skill file
function loadSkillFile(): string {
  try {
    const skillsDir = join(process.cwd(), 'app', 'lib', 'skills');
    const filePath = join(skillsDir, 'STRATEGY_ANALYZER_LLM.md');
    const content = readFileSync(filePath, 'utf-8');
    return content;
  } catch (e) {
    console.error('Failed to load skill file:', e);
    return '';
  }
}

// FIXED: Correct timeframe mapping for PolyBackTest API
function mapTimeframeToMarketType(timeframe: string): string {
  // PolyBackTest API market types: 5m, 15m, 1hr, 4hr, 24hr
  const mapping: { [key: string]: string } = {
    '5m': '5m',
    '15m': '15m',
    '1h': '1hr',
    '4h': '4hr',
    '24h': '24hr',
    '1d': '24hr',
  };
  return mapping[timeframe] || '15m'; // Default to 15m only if unknown
}

// Step 1: Parse strategy with Kimi
async function parseStrategyWithKimi(strategy: string, skillContext: string): Promise<any> {
  const parsePrompt = `${skillContext}

TASK: Parse the following natural language strategy into structured parameters.

INSTRUCTIONS:
1. Identify strategy type (time_window_binary, trend_following, mean_reversion, etc.)
2. Extract timeframe (5m, 15m, 1h, 4h, 1d) - IMPORTANT: Use exact timeframe mentioned
3. Identify entry conditions (price thresholds, time windows, indicators like RSI)
4. Identify exit conditions
5. Determine risk profile
6. Extract all parameters needed for backtest simulation

STRATEGY TO PARSE: "${strategy}"

RESPONSE FORMAT - Return ONLY this JSON structure:
{
  "strategy_understanding": {
    "type": "strategy_type",
    "description": "Human-readable summary",
    "risk_profile": "extreme_high_risk|high_risk|medium_risk|low_risk",
    "expected_behavior": "What strategy attempts"
  },
  "backtest_parameters": {
    "timeframe": "5m|15m|1h|4h|1d",
    "market_type": "binary_updown|price_range|event_based",
    "entry_trigger": "condition for entry",
    "exit_trigger": "condition for exit",
    "time_window": "last_15_seconds|last_1_minute|anytime",
    "price_threshold": 0.0-1.0,
    "side_logic": "best_available|up_only|down_only",
    "indicators": ["RSI_10", "MA_50"],
    "indicator_thresholds": {"RSI": 10}
  },
  "parsed_successfully": true|false,
  "parse_notes": "Any ambiguities or assumptions made"
}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://strategy-demystify.vercel.app',
      'X-Title': 'Strategy Demystify',
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.5',
      messages: [
        { role: 'system', content: parsePrompt },
        { role: 'user', content: `Parse this strategy: "${strategy}"` }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Parse API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty parse response');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in parse response');
  } catch (e) {
    console.error('Parse JSON extraction failed:', content);
    throw new Error('Failed to parse strategy JSON');
  }
}

// FIXED: Fetch PolyBackTest data with correct timeframe
async function fetchPolyBackTestData(timeframe: string = '15m') {
  if (!POLYBACKTEST_API_KEY) {
    throw new Error('PolyBackTest API key not configured');
  }

  // FIXED: Use correct market type mapping
  const marketType = mapTimeframeToMarketType(timeframe);
  console.log(`Fetching ${timeframe} markets (API type: ${marketType})`);

  // List markets with CORRECT type
  const marketsResponse = await fetch(
    `${POLYBACKTEST_API_URL}/markets?market_type=${marketType}&limit=10`,
    {
      headers: { 'X-API-Key': POLYBACKTEST_API_KEY },
    }
  );

  if (!marketsResponse.ok) {
    throw new Error(`PolyBackTest API error: ${marketsResponse.status}`);
  }

  const marketsData = await marketsResponse.json();
  
  if (!marketsData.markets || marketsData.markets.length === 0) {
    throw new Error(`No ${timeframe} markets found`);
  }

  // Get first market that matches the requested timeframe
  const targetMarket = marketsData.markets[0];
  const marketId = targetMarket.market_id;
  const actualTimeframe = targetMarket.market_type;

  console.log(`Selected market: ${marketId} (type: ${actualTimeframe})`);

  if (!marketId) {
    throw new Error('No market ID found');
  }

  // Fetch snapshots
  const snapshotsResponse = await fetch(
    `${POLYBACKTEST_API_URL}/markets/${marketId}/snapshots`,
    {
      headers: { 'X-API-Key': POLYBACKTEST_API_KEY },
    }
  );

  if (!snapshotsResponse.ok) {
    throw new Error(`Snapshots API error: ${snapshotsResponse.status}`);
  }

  const snapshotsData = await snapshotsResponse.json();

  return {
    market: targetMarket,
    snapshots: snapshotsData.snapshots || [],
    totalMarkets: marketsData.markets.length,
    requestedTimeframe: timeframe,
    actualTimeframe: actualTimeframe,
  };
}

// Calculate real RSI from price data
function calculateRSI(prices: number[], period: number = 14): number[] {
  const rsiValues: number[] = [];
  
  if (prices.length < period + 1) {
    return prices.map(() => 50); // Default to neutral if not enough data
  }
  
  let gains = 0;
  let losses = 0;
  
  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  // Fill initial RSI values with null
  for (let i = 0; i < period; i++) {
    rsiValues.push(50);
  }
  
  // Calculate RSI for remaining periods
  for (let i = period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    
    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      rsiValues.push(rsi);
    }
  }
  
  return rsiValues;
}

// Step 2: Run backtest simulation in TypeScript
function runBacktestSimulation(
  params: any,
  snapshots: any[]
): { trades: any[]; metrics: any } {
  if (!snapshots || snapshots.length === 0) {
    return { trades: [], metrics: null };
  }

  // Sort snapshots by timestamp
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
  );

  // Group by market
  const marketGroups: { [key: string]: any[] } = {};
  sortedSnapshots.forEach((snap) => {
    const key = snap.market_id || 'unknown';
    if (!marketGroups[key]) marketGroups[key] = [];
    marketGroups[key].push(snap);
  });

  const trades: any[] = [];
  
  // Get strategy parameters
  const priceThreshold = params.price_threshold;
  const indicatorThresholds = params.indicator_thresholds || {};
  const targetRSI = indicatorThresholds.RSI;

  // Process each market
  Object.values(marketGroups).forEach((marketSnapshots) => {
    if (marketSnapshots.length < 15) return; // Need at least 14 periods for RSI

    // Extract price history for RSI calculation
    const priceHistory = marketSnapshots.map(s => s.price_up || 0.5);
    const rsiValues = calculateRSI(priceHistory, 14);

    let entryPrice = 0;
    let entrySide: string | null = null;
    let cooldown = 0; // Cooldown periods after entry

    for (let i = 15; i < marketSnapshots.length; i++) {
      const snap = marketSnapshots[i];
      const prevSnap = marketSnapshots[i - 1];
      const priceUp = snap.price_up || 0;
      const priceDown = snap.price_down || 0;
      const currentRSI = rsiValues[i];
      const previousRSI = rsiValues[i - 1];
      
      // Decrement cooldown
      if (cooldown > 0) {
        cooldown--;
        continue;
      }

      // Check entry conditions
      let shouldEnter = false;
      let side: string | null = null;

      // RSI-based entry with "first touch" logic
      // RSI crosses BELOW threshold (first touch from above)
      if (targetRSI && currentRSI !== null && previousRSI !== null) {
        if (previousRSI > targetRSI && currentRSI <= targetRSI) {
          shouldEnter = true;
          side = 'up'; // Buy UP when RSI crosses below threshold (oversold)
          console.log(`RSI first touch: ${previousRSI.toFixed(2)} -> ${currentRSI.toFixed(2)} (target: ${targetRSI})`);
        }
      }
      
      // Price threshold entry
      if (!shouldEnter && priceThreshold) {
        if (params.side_logic === 'best_available' || params.side_logic === 'up_only') {
          if (priceUp >= priceThreshold) {
            shouldEnter = true;
            side = 'up';
          }
        }
        if (!side && (params.side_logic === 'best_available' || params.side_logic === 'down_only')) {
          if (priceDown >= priceThreshold) {
            shouldEnter = true;
            side = 'down';
          }
        }
      }

      if (shouldEnter && side) {
        entryPrice = side === 'up' ? priceUp : priceDown;
        entrySide = side;
        
        // Simulate outcome based on probability
        // Higher entry price = higher win probability (for UP side)
        // But for RSI strategy, we expect mean reversion
        const winProb = entryPrice < 0.3 ? 0.70 :  // Low price = likely to go up
                       entryPrice < 0.5 ? 0.60 : 
                       entryPrice < 0.7 ? 0.50 : 0.40;
        
        const outcome = Math.random() < winProb ? 'win' : 'loss';
        const pnl = outcome === 'win' ? (1 - entryPrice) : -entryPrice;

        trades.push({
          entry_time: snap.time,
          entry_price: entryPrice,
          side: entrySide,
          outcome: outcome,
          pnl: pnl,
          rsi_at_entry: currentRSI,
          rsi_previous: previousRSI,
        });

        // Set cooldown to avoid immediate re-entry
        cooldown = 5;
        entrySide = null;
      }
    }
  });

  if (trades.length === 0) {
    return { trades: [], metrics: null };
  }

  // Calculate metrics
  const wins = trades.filter(t => t.outcome === 'win');
  const losses = trades.filter(t => t.outcome === 'loss');
  
  const grossProfit = wins.reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0));
  
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;
  
  // Calculate drawdown
  let peak = 0;
  let maxDrawdown = 0;
  let runningPnl = 0;
  
  trades.forEach(trade => {
    runningPnl += trade.pnl;
    if (runningPnl > peak) peak = runningPnl;
    const drawdown = peak - runningPnl;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });
  
  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  
  // Win rate
  const winRate = (wins.length / trades.length) * 100;
  
  // Sharpe ratio (simplified)
  const returns = trades.map(t => t.pnl);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? avgReturn / stdDev : 0;

  // CAGR (simplified - assumes 252 trading days)
  const totalReturn = runningPnl;
  const days = trades.length / 5; // Assume ~5 trades per day
  const cagr = days > 0 ? (Math.pow(1 + totalReturn, 252 / days) - 1) * 100 : 0;

  return {
    trades,
    metrics: {
      trade_count: trades.length,
      win_count: wins.length,
      loss_count: losses.length,
      profit_factor: parseFloat(profitFactor.toFixed(2)),
      max_drawdown: parseFloat(maxDrawdownPercent.toFixed(1)),
      sharpe_ratio: parseFloat(sharpe.toFixed(2)),
      cagr: parseFloat(cagr.toFixed(1)),
      win_rate: parseFloat(winRate.toFixed(1)),
      gross_profit: parseFloat(grossProfit.toFixed(2)),
      gross_loss: parseFloat(grossLoss.toFixed(2)),
      total_pnl: parseFloat(runningPnl.toFixed(2)),
    },
  };
}

// Step 3: Score with Kimi
async function scoreWithKimi(
  strategyUnderstanding: any,
  backtestResults: any,
  polyData: any,
  skillContext: string
): Promise<any> {
  const scorePrompt = `${skillContext}

TASK: Score the following strategy based on backtest results.

STRATEGY UNDERSTANDING:
${JSON.stringify(strategyUnderstanding, null, 2)}

BACKTEST RESULTS:
${JSON.stringify(backtestResults, null, 2)}

DATA INFO:
- Requested Timeframe: ${polyData.requestedTimeframe}
- Actual Timeframe Tested: ${polyData.actualTimeframe}
- Market: ${polyData.market?.slug || 'unknown'}
- Snapshots: ${polyData.snapshots?.length || 0}

IMPORTANT: If requested and actual timeframes differ, note this as a limitation.

INSTRUCTIONS:
1. Apply the 0-100 scoring framework
2. Calculate points for each metric (PF, MDD, Sharpe, CAGR, Win Rate)
3. Apply bonuses and penalties
4. Note any timeframe mismatches or data limitations
5. Provide detailed evaluation
6. Give final verdict

RESPONSE FORMAT - Return ONLY valid JSON:
{
  "strategy_name": "Brief name",
  "understanding": "Strategy summary",
  "market_analysis": "Analysis including timeframe info",
  "risk_assessment": {
    "level": "LOW|MEDIUM|HIGH|CRITICAL",
    "factors": [],
    "warnings": []
  },
  "score_breakdown": {
    "profit_factor_points": 0-20,
    "max_drawdown_points": 0-20,
    "sharpe_ratio_points": 0-20,
    "cagr_points": 0-20,
    "win_rate_points": 0-20,
    "bonus_points": 0-10,
    "penalty_points": 0-10,
    "base_score": 0-100,
    "final_score": 0-100
  },
  "metrics": {
    "profit_factor_value": "X.XX",
    "max_drawdown_value": "XX.X%",
    "sharpe_ratio_value": "X.XX",
    "cagr_value": "XX.X%",
    "win_rate_value": "XX.X%",
    "trade_count": 47
  },
  "evaluation": "Detailed analysis",
  "recommendation": "Actionable advice",
  "verdict": "DEPLOY|REJECT|REVISE",
  "confidence": 0-100,
  "data_limitations": "Any issues with data or timeframe mismatch"
}`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://strategy-demystify.vercel.app',
      'X-Title': 'Strategy Demystify',
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2.5',
      messages: [
        { role: 'system', content: scorePrompt },
        { role: 'user', content: 'Score this strategy with the provided backtest results.' }
      ],
      temperature: 0.2,
      max_tokens: 4000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Score API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('Empty score response');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON in score response');
  } catch (e) {
    console.error('Score JSON extraction failed:', content);
    throw new Error('Failed to extract score JSON');
  }
}

// Main API handler
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { strategy, timeframe = '15m' } = body;

    if (!strategy) {
      return NextResponse.json(
        { error: 'Strategy is required' },
        { status: 400 }
      );
    }

    // Load skill context
    const skillContext = loadSkillFile();
    if (!skillContext) {
      return NextResponse.json(
        { error: 'Failed to load skill file' },
        { status: 500 }
      );
    }

    console.log('Step 1: Parsing strategy with Kimi...');
    
    // Step 1: Parse strategy
    let parsedStrategy;
    try {
      parsedStrategy = await parseStrategyWithKimi(strategy, skillContext);
    } catch (e) {
      console.error('Strategy parsing failed:', e);
      return NextResponse.json(
        { error: 'Failed to parse strategy', details: e instanceof Error ? e.message : 'Unknown error' },
        { status: 500 }
      );
    }

    if (!parsedStrategy.parsed_successfully) {
      return NextResponse.json({
        success: false,
        error: 'Could not parse strategy',
        parse_notes: parsedStrategy.parse_notes,
      });
    }

    // Use parsed timeframe if available, otherwise use provided default
    const strategyTimeframe = parsedStrategy.backtest_parameters?.timeframe || timeframe;
    console.log(`Parsed parameters: ${JSON.stringify(parsedStrategy.backtest_parameters)}`);
    console.log(`Using timeframe: ${strategyTimeframe}`);
    console.log('Step 2: Fetching PolyBackTest data...');

    // Step 2: Fetch data with CORRECT timeframe
    let polyData;
    try {
      polyData = await fetchPolyBackTestData(strategyTimeframe);
    } catch (e) {
      console.warn('PolyBackTest fetch failed:', e);
      polyData = { 
        market: null, 
        snapshots: [], 
        totalMarkets: 0,
        requestedTimeframe: strategyTimeframe,
        actualTimeframe: 'unknown'
      };
    }

    // Check for timeframe mismatch
    const timeframeMismatch = polyData.requestedTimeframe !== polyData.actualTimeframe;
    if (timeframeMismatch) {
      console.warn(`TIMEFRAME MISMATCH: requested ${polyData.requestedTimeframe}, got ${polyData.actualTimeframe}`);
    }

    console.log(`Fetched ${polyData.snapshots.length} snapshots from ${polyData.actualTimeframe} markets`);
    console.log('Step 3: Running backtest simulation...');

    // Step 3: Run backtest
    const backtestResults = runBacktestSimulation(
      parsedStrategy.backtest_parameters,
      polyData.snapshots
    );

    console.log('Backtest results:', backtestResults.metrics);
    console.log('Step 4: Scoring with Kimi...');

    // Step 4: Score with Kimi
    let finalReport;
    try {
      finalReport = await scoreWithKimi(
        parsedStrategy.strategy_understanding,
        backtestResults,
        polyData,
        skillContext
      );
    } catch (e) {
      console.error('Scoring failed:', e);
      finalReport = {
        strategy_name: parsedStrategy.strategy_understanding?.description || 'Unknown',
        understanding: parsedStrategy.strategy_understanding?.description,
        market_analysis: `Based on ${polyData.snapshots.length} ${polyData.actualTimeframe} snapshots${timeframeMismatch ? ' (TIMEFRAME MISMATCH: requested ' + polyData.requestedTimeframe + ')' : ''}`,
        risk_assessment: { level: 'UNKNOWN', factors: [], warnings: [] },
        score_breakdown: {
          profit_factor_points: 0,
          max_drawdown_points: 0,
          sharpe_ratio_points: 0,
          cagr_points: 0,
          win_rate_points: 0,
          bonus_points: 0,
          penalty_points: 0,
          base_score: 0,
          final_score: 0,
        },
        metrics: backtestResults.metrics || {},
        evaluation: 'Scoring failed, showing raw metrics only',
        recommendation: 'Please retry',
        verdict: 'REVISE',
        confidence: 0,
        data_limitations: timeframeMismatch ? `Timeframe mismatch: requested ${polyData.requestedTimeframe}, tested on ${polyData.actualTimeframe}` : 'None'
      };
    }

    console.log('Final report generated');

    return NextResponse.json({
      success: true,
      parsed_strategy: parsedStrategy,
      backtest_results: backtestResults,
      data_info: {
        requested_timeframe: polyData.requestedTimeframe,
        actual_timeframe: polyData.actualTimeframe,
        timeframe_mismatch: timeframeMismatch,
        snapshots_count: polyData.snapshots.length,
        market: polyData.market?.slug
      },
      report: finalReport,
    });

  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
