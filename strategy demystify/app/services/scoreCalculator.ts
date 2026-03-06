import { 
  MetricValues, 
  ScoreBreakdown, 
  ScoreResult, 
  RedFlag, 
  getScoreCategory, 
  getRecommendation,
  ScoreCategory 
} from '../types/scoring';

// Individual metric scoring functions (0-20 points each)
// Based on cursor-score-strategy skill

export function calculatePFScore(profitFactor: number): number {
  if (profitFactor >= 2.5) return 20;
  if (profitFactor >= 2.0) return 16;
  if (profitFactor >= 1.5) return 12;
  if (profitFactor >= 1.2) return 8;
  return Math.max(0, (profitFactor - 1.0) * 20); // Linear 1.0->1.2
}

export function calculateMDDScore(maxDrawdown: number): number {
  // Lower drawdown is better (inverse scoring)
  if (maxDrawdown <= 5) return 20;
  if (maxDrawdown <= 10) return 16;
  if (maxDrawdown <= 15) return 12;
  if (maxDrawdown <= 25) return 8;
  if (maxDrawdown <= 35) return 4;
  return Math.max(0, 20 - (maxDrawdown - 35) * 0.5);
}

export function calculateSharpeScore(sharpeRatio: number): number {
  if (sharpeRatio >= 2.0) return 20;
  if (sharpeRatio >= 1.5) return 16;
  if (sharpeRatio >= 1.0) return 12;
  if (sharpeRatio >= 0.5) return 8;
  return Math.max(0, sharpeRatio * 16); // Linear 0->0.5
}

export function calculateCAGRScore(cagr: number): number {
  if (cagr >= 50) return 20;
  if (cagr >= 30) return 18;
  if (cagr >= 25) return 16;
  if (cagr >= 20) return 14;
  if (cagr >= 15) return 12;
  if (cagr >= 10) return 8;
  if (cagr >= 5) return 4;
  return Math.max(0, cagr * 0.8); // Linear
}

export function calculateWinRateScore(winRate: number): number {
  if (winRate >= 65) return 20;
  if (winRate >= 60) return 16;
  if (winRate >= 55) return 12;
  if (winRate >= 50) return 8;
  if (winRate >= 45) return 4;
  return Math.max(0, winRate * 0.09); // Linear
}

// Detect red flags
export function detectRedFlags(metrics: MetricValues, totalTrades: number): RedFlag[] {
  const flags: RedFlag[] = [];

  // Small sample warning
  if (totalTrades < 30) {
    flags.push({
      type: 'small_sample',
      severity: 'warning',
      message: `Only ${totalTrades} trades - insufficient data for reliable analysis`,
      metric: 'totalTrades',
      value: totalTrades,
      threshold: 30,
    });
  }

  // Overfitting risk
  if (metrics.winRate > 75) {
    flags.push({
      type: 'overfitting',
      severity: 'warning',
      message: 'Win rate >75% suggests potential overfitting',
      metric: 'winRate',
      value: metrics.winRate,
      threshold: 75,
    });
  }

  if (metrics.profitFactor > 3.5) {
    flags.push({
      type: 'overfitting',
      severity: 'warning',
      message: 'Profit Factor >3.5 may indicate overfitting',
      metric: 'profitFactor',
      value: metrics.profitFactor,
      threshold: 3.5,
    });
  }

  // Excessive risk
  if (metrics.maxDrawdown > 30) {
    flags.push({
      type: 'excessive_risk',
      severity: 'critical',
      message: 'Max drawdown >30% indicates excessive risk exposure',
      metric: 'maxDrawdown',
      value: metrics.maxDrawdown,
      threshold: 30,
    });
  }

  if (metrics.sharpeRatio < 0.5) {
    flags.push({
      type: 'excessive_risk',
      severity: 'critical',
      message: 'Sharpe ratio <0.5 suggests poor risk-adjusted returns',
      metric: 'sharpeRatio',
      value: metrics.sharpeRatio,
      threshold: 0.5,
    });
  }

  // Poor returns
  if (metrics.cagr < 10 && metrics.maxDrawdown > 20) {
    flags.push({
      type: 'poor_returns',
      severity: 'critical',
      message: 'CAGR <10% with MDD >20% indicates poor risk/reward',
      metric: 'cagr',
      value: metrics.cagr,
      threshold: 10,
    });
  }

  // High variance (inconsistent performance)
  if (metrics.winRate < 45 && metrics.profitFactor > 2.0) {
    flags.push({
      type: 'high_variance',
      severity: 'warning',
      message: 'Low win rate with high profit factor suggests inconsistent performance',
      metric: 'winRate',
      value: metrics.winRate,
      threshold: 45,
    });
  }

  return flags;
}

// Calculate bonus points
export function calculateBonus(metrics: MetricValues): number {
  let bonus = 0;

  // Low risk + high return bonus
  if (metrics.maxDrawdown < 10 && metrics.cagr > 25) {
    bonus += 5;
  }

  // Consistent excellence (all metrics good)
  const allMetricsGood = 
    calculatePFScore(metrics.profitFactor) >= 14 &&
    calculateMDDScore(metrics.maxDrawdown) >= 14 &&
    calculateSharpeScore(metrics.sharpeRatio) >= 14 &&
    calculateCAGRScore(metrics.cagr) >= 14 &&
    calculateWinRateScore(metrics.winRate) >= 14;
  
  if (allMetricsGood) {
    bonus += 5;
  }

  // Risk management bonus
  if (metrics.sharpeRatio > 2.0 && metrics.maxDrawdown < 15) {
    bonus += 3;
  }

  return Math.min(10, bonus);
}

// Calculate penalty points
export function calculatePenalty(metrics: MetricValues): number {
  let penalty = 0;

  // Overfitting penalty
  if (metrics.winRate > 75 || metrics.profitFactor > 3.5) {
    penalty += 5;
  }

  // Excessive risk penalty
  if (metrics.maxDrawdown > 30 || metrics.sharpeRatio < 0.5) {
    penalty += 5;
  }

  // Poor returns penalty
  if (metrics.cagr < 10 && metrics.maxDrawdown > 20) {
    penalty += 3;
  }

  return Math.min(10, penalty);
}

// Main scoring function
export function calculateTotalScore(
  metrics: MetricValues, 
  totalTrades: number = 50
): ScoreResult {
  // Calculate base scores
  const pfScore = calculatePFScore(metrics.profitFactor);
  const mddScore = calculateMDDScore(metrics.maxDrawdown);
  const sharpeScore = calculateSharpeScore(metrics.sharpeRatio);
  const cagrScore = calculateCAGRScore(metrics.cagr);
  const winRateScore = calculateWinRateScore(metrics.winRate);

  const baseTotal = pfScore + mddScore + sharpeScore + cagrScore + winRateScore;

  // Apply bonuses and penalties
  const bonus = calculateBonus(metrics);
  const penalty = calculatePenalty(metrics);

  // Calculate final total (0-100)
  const total = Math.min(100, Math.max(0, baseTotal + bonus - penalty));

  // Detect red flags
  const redFlags = detectRedFlags(metrics, totalTrades);

  // Get category and recommendation
  const category = getScoreCategory(total).category;
  const recommendation = getRecommendation(category);

  return {
    breakdown: {
      profitFactor: pfScore,
      maxDrawdown: mddScore,
      sharpeRatio: sharpeScore,
      cagr: cagrScore,
      winRate: winRateScore,
      bonus,
      penalty,
      total,
    },
    category,
    rating: getScoreCategory(total),
    recommendation,
    redFlags,
  };
}

// Format score for display
export function formatMetricValue(metric: keyof MetricValues, value: number): string {
  switch (metric) {
    case 'profitFactor':
      return value.toFixed(2);
    case 'maxDrawdown':
    case 'cagr':
    case 'winRate':
      return `${value.toFixed(1)}%`;
    case 'sharpeRatio':
      return value.toFixed(2);
    default:
      return value.toString();
  }
}

// Get color class for metric value
export function getMetricColor(metric: keyof MetricValues, value: number): string {
  switch (metric) {
    case 'profitFactor':
      return value >= 2.0 ? 'text-accent-green' : value >= 1.5 ? 'text-accent-yellow' : 'text-accent-red';
    case 'maxDrawdown':
      return value <= 10 ? 'text-accent-green' : value <= 20 ? 'text-accent-yellow' : 'text-accent-red';
    case 'sharpeRatio':
      return value >= 1.5 ? 'text-accent-green' : value >= 1.0 ? 'text-accent-yellow' : 'text-accent-red';
    case 'cagr':
      return value >= 25 ? 'text-accent-green' : value >= 15 ? 'text-accent-yellow' : 'text-accent-red';
    case 'winRate':
      return value >= 60 ? 'text-accent-green' : value >= 50 ? 'text-accent-yellow' : 'text-accent-red';
    default:
      return 'text-text-primary';
  }
}
