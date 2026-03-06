import { ChatMessage, ScoreBreakdown, generateId } from '../types';

// Simple hash function to generate deterministic scores from question
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Generate scores based on question content
function generateScores(question: string): ScoreBreakdown {
  const hash = hashString(question.toLowerCase().trim());
  
  // Generate realistic trading strategy scores
  const pt = 1.0 + (hash % 40) / 10;      // 1.0 - 5.0
  const pro = 10 + (hash % 50);            // 10 - 60
  const sr = 0.3 + (hash % 15) / 10;      // 0.3 - 1.8
  const card = 5 + (hash % 45);           // 5 - 50
  const ae = 5 + (hash % 55);             // 5 - 60
  
  // Calculate weighted total (0-100)
  const total = Math.min(100, Math.round(
    (pt * 8) +           // PT weight: 8
    (pro * 0.6) +        // PRO weight: 0.6
    (sr * 20) +          // SR weight: 20
    ((50 - card) * 0.5) + // CARD weight: inverse, 0.5
    (ae * 0.5)           // AE weight: 0.5
  ));
  
  return {
    pt: Math.round(pt * 10) / 10,
    pro,
    sr: Math.round(sr * 10) / 10,
    card,
    ae,
    total
  };
}

// Generate AI response text based on scores
function generateResponse(question: string, scores: ScoreBreakdown): string {
  const { pt, pro, sr, card, ae, total } = scores;
  
  let recommendation = '';
  let riskLevel = '';
  let positionSize = '';
  
  if (total >= 80) {
    recommendation = 'This strategy shows excellent potential with strong metrics across the board.';
    riskLevel = 'Low';
    positionSize = '3-5%';
  } else if (total >= 60) {
    recommendation = 'This strategy has good potential but requires careful risk management.';
    riskLevel = 'Moderate';
    positionSize = '2-3%';
  } else if (total >= 40) {
    recommendation = 'This strategy shows moderate potential with some concerns in key areas.';
    riskLevel = 'Moderate-High';
    positionSize = '1-2%';
  } else {
    recommendation = 'This strategy has significant weaknesses and should be approached with caution.';
    riskLevel = 'High';
    positionSize = '0.5-1%';
  }
  
  // Key insights based on individual scores
  const insights: string[] = [];
  
  if (sr >= 1.2) insights.push('Excellent strike rate indicates consistent performance.');
  if (sr < 0.7) insights.push('Low strike rate suggests frequent losses.');
  if (pro >= 40) insights.push('High probability of success in favorable conditions.');
  if (card <= 15) insights.push('Low risk/reward ratio provides good protection.');
  if (card > 35) insights.push('High risk exposure requires tight stop losses.');
  if (ae >= 35) insights.push('Strong average expectancy over time.');
  if (pt >= 3.0) insights.push('Good profit targets for capturing moves.');
  
  const insightsText = insights.length > 0 
    ? `\n\nKey Insights:\n${insights.map(i => `• ${i}`).join('\n')}`
    : '';
  
  return `## Strategy Analysis\n\n**Overall Score: ${total}/100**\n\n### Summary\n${recommendation}${insightsText}\n\n### Risk Assessment\n- **Risk Level:** ${riskLevel}\n- **Suggested Position Size:** ${positionSize} of portfolio\n- **Maximum Drawdown (Est.):** ${card}%\n\n### Recommendation\n${total >= 60 
    ? '✓ **APPROVED** - Suitable for implementation with specified risk controls.' 
    : '⚠ **CAUTION** - Requires further optimization before live trading.'}`;
}

// Mock AI service function
export async function mockAIResponse(question: string): Promise<ChatMessage> {
  // Simulate network delay (1-2 seconds)
  const delay = 1000 + Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Generate scores based on question
  const scores = generateScores(question);
  
  // Generate formatted response
  const answer = generateResponse(question, scores);
  
  return {
    id: generateId(),
    question: question.trim(),
    answer,
    scores,
    timestamp: Date.now(),
    isExpanded: false
  };
}

// Helper to create a mock chat for testing
export function createMockChat(
  question: string,
  overrides?: Partial<ChatMessage>
): ChatMessage {
  const scores = generateScores(question);
  
  return {
    id: generateId(),
    question: question.trim(),
    answer: generateResponse(question, scores),
    scores,
    timestamp: Date.now(),
    isExpanded: false,
    ...overrides
  };
}
