// Strategy Demystify - TypeScript Types

export interface ScoreBreakdown {
  pt: number;      // Profit Target
  pro: number;     // Probability
  sr: number;      // Strike Rate
  card: number;    // Card (Risk/Reward)
  ae: number;      // Average Expectancy
  total: number;   // Weighted Total
}

export interface ChatMessage {
  id: string;                    // unique id (timestamp + random)
  question: string;              // user input
  answer: string;                // AI response
  scores: ScoreBreakdown;        // scoring framework
  timestamp: number;             // created at (Date.now())
  isExpanded: boolean;          // UI state for list view
}

export type ScoreRating = 'excellent' | 'good' | 'moderate' | 'weak' | 'poor';

export interface ScoreRatingConfig {
  min: number;
  max: number;
  label: string;
  color: string;
  icon: string;
}

export const SCORE_RATINGS: Record<ScoreRating, ScoreRatingConfig> = {
  excellent: { min: 90, max: 100, label: 'Excellent', color: 'text-accent-green', icon: '★' },
  good: { min: 70, max: 89, label: 'Good', color: 'text-accent-green', icon: '✓' },
  moderate: { min: 50, max: 69, label: 'Moderate', color: 'text-accent-yellow', icon: '◐' },
  weak: { min: 30, max: 49, label: 'Weak', color: 'text-accent-orange', icon: '○' },
  poor: { min: 0, max: 29, label: 'Poor', color: 'text-accent-red', icon: '✕' },
};

export function getScoreRating(total: number): ScoreRatingConfig {
  if (total >= 90) return SCORE_RATINGS.excellent;
  if (total >= 70) return SCORE_RATINGS.good;
  if (total >= 50) return SCORE_RATINGS.moderate;
  if (total >= 30) return SCORE_RATINGS.weak;
  return SCORE_RATINGS.poor;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}
