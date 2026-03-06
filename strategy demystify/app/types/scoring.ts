// Scoring Framework Types
// Based on cursor-score-strategy skill

export interface MetricValues {
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  cagr: number;
  winRate: number;
}

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  cagr: number;
  winRate: number;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  startDate: number;
  endDate: number;
  warnings?: string[];
}

export interface ScoreBreakdown {
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  cagr: number;
  winRate: number;
  bonus: number;
  penalty: number;
  total: number;
}

export interface ScoreResult {
  breakdown: ScoreBreakdown;
  category: ScoreCategory;
  rating: ScoreRating;
  recommendation: string;
  redFlags: RedFlag[];
}

export type ScoreCategory = 
  | 'exceptional'  // 90-100
  | 'excellent'    // 75-89
  | 'good'         // 60-74
  | 'fair'         // 40-59
  | 'poor';        // 0-39

export interface ScoreRating {
  category: ScoreCategory;
  label: string;
  symbol: string;
  color: string;
  minScore: number;
  maxScore: number;
}

export interface RedFlag {
  type: 'overfitting' | 'excessive_risk' | 'poor_returns' | 'small_sample' | 'high_variance';
  severity: 'warning' | 'critical';
  message: string;
  metric: string;
  value: number;
  threshold: number;
}

export const SCORE_CATEGORIES: Record<ScoreCategory, ScoreRating> = {
  exceptional: {
    category: 'exceptional',
    label: 'Exceptional',
    symbol: '🌟',
    color: 'text-accent-green',
    minScore: 90,
    maxScore: 100,
  },
  excellent: {
    category: 'excellent',
    label: 'Excellent',
    symbol: '🏆',
    color: 'text-accent-green',
    minScore: 75,
    maxScore: 89,
  },
  good: {
    category: 'good',
    label: 'Good',
    symbol: '✓',
    color: 'text-accent-green',
    minScore: 60,
    maxScore: 74,
  },
  fair: {
    category: 'fair',
    label: 'Fair',
    symbol: '⚠',
    color: 'text-accent-yellow',
    minScore: 40,
    maxScore: 59,
  },
  poor: {
    category: 'poor',
    label: 'Poor',
    symbol: '✕',
    color: 'text-accent-red',
    minScore: 0,
    maxScore: 39,
  },
};

export function getScoreCategory(totalScore: number): ScoreRating {
  if (totalScore >= 90) return SCORE_CATEGORIES.exceptional;
  if (totalScore >= 75) return SCORE_CATEGORIES.excellent;
  if (totalScore >= 60) return SCORE_CATEGORIES.good;
  if (totalScore >= 40) return SCORE_CATEGORIES.fair;
  return SCORE_CATEGORIES.poor;
}

export function getRecommendation(category: ScoreCategory): string {
  switch (category) {
    case 'exceptional':
      return 'Deploy with confidence after validation';
    case 'excellent':
      return 'Deploy after thorough validation';
    case 'good':
      return 'Deploy with caution and proper risk management';
    case 'fair':
      return 'Do NOT deploy - requires significant revision';
    case 'poor':
      return 'Reject - strategy is fundamentally flawed';
    default:
      return 'Unknown category';
  }
}
