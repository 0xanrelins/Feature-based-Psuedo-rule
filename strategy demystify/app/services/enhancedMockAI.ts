import { ChatMessage, generateId } from '../types';

// AI service that calls Kimi AI Agent with PolyBackTest integration
// Uses /api/analyze endpoint which integrates Kimi k2.5 + Scoring Framework + PolyBackTest data
export async function enhancedAIResponse(question: string): Promise<ChatMessage> {
  try {
    // Call new AI-powered analyze API
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy: question,
        timeframe: '15m', // Default to Polymarket 15m markets
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.details || `API Error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Analysis failed');
    }

    return createChatMessageFromAI(question, data);
    
  } catch (error) {
    console.error('AI analysis failed:', error);
    
    // Return error message
    return {
      id: generateId(),
      question: question.trim(),
      answer: formatErrorResponse(error instanceof Error ? error.message : 'Unknown error'),
      scores: {
        pt: 0,
        pro: 0,
        sr: 0,
        card: 0,
        ae: 0,
        total: 0,
      },
      timestamp: Date.now(),
      isExpanded: false,
    };
  }
}

// Format error response
function formatErrorResponse(errorMessage: string): string {
  return `## ⚠️ Analysis Failed

**Error:** ${errorMessage}

### Possible Causes:
- OpenRouter API key not configured
- PolyBackTest API key not configured
- Network connectivity issue
- Invalid strategy parameters

### How to Fix:
1. Check your ".env.local" file has required API keys
2. Verify your API keys are valid
3. Check your internet connection
4. Try a different strategy description

---
*Note: This system uses OpenRouter (Kimi k2.5) + PolyBackTest data integration.*`;
}

// Create ChatMessage from AI analysis response
function createChatMessageFromAI(question: string, data: any): ChatMessage {
  const { analysis, data_source } = data;
  
  const answer = formatAIAnalysis(analysis, data_source);
  
  // Extract total score from AI analysis
  const totalScore = analysis?.score_breakdown?.total 
    ? parseInt(analysis.score_breakdown.total) 
    : 0;
  
  return {
    id: generateId(),
    question: question.trim(),
    answer,
    scores: {
      pt: parseFloat(analysis?.score_breakdown?.profit_factor) || 0,
      pro: parseFloat(analysis?.score_breakdown?.win_rate) || 0,
      sr: parseFloat(analysis?.score_breakdown?.sharpe_ratio) || 0,
      card: parseFloat(analysis?.score_breakdown?.max_drawdown) || 0,
      ae: parseFloat(analysis?.score_breakdown?.cagr) || 0,
      total: totalScore,
    },
    timestamp: Date.now(),
    isExpanded: false,
  };
}

// Format AI analysis response
function formatAIAnalysis(analysis: any, dataSource: string): string {
  if (!analysis) {
    return `## ⚠️ Analysis Error

No analysis data received from AI agent.`;
  }
  
  let response = `## 🤖 AI Strategy Analysis\n\n`;
  
  // Strategy Name
  if (analysis.strategy_name) {
    response += `### 📋 ${analysis.strategy_name}\n\n`;
  }
  
  // AI Understanding
  if (analysis.understanding) {
    response += `**AI Understanding:** ${analysis.understanding}\n\n`;
  }
  
  // Verdict with emoji
  const verdict = analysis.verdict || 'UNKNOWN';
  const verdictEmoji = verdict === 'DEPLOY' ? '✅' : verdict === 'REJECT' ? '❌' : '⚠️';
  response += `## ${verdictEmoji} VERDICT: ${verdict}\n\n`;
  
  // Score Breakdown
  if (analysis.score_breakdown) {
    const sb = analysis.score_breakdown;
    response += `### 📊 Score Breakdown (0-100)\n\n`;
    response += `| Metric | Score | Max |\n`;
    response += `|--------|-------|-----|\n`;
    response += `| **Profit Factor** | ${sb.profit_factor || '?'}/20 | 20 |\n`;
    response += `| **Max Drawdown** | ${sb.max_drawdown || '?'}/20 | 20 |\n`;
    response += `| **Sharpe Ratio** | ${sb.sharpe_ratio || '?'}/20 | 20 |\n`;
    response += `| **CAGR** | ${sb.cagr || '?'}/20 | 20 |\n`;
    response += `| **Win Rate** | ${sb.win_rate || '?'}/20 | 20 |\n`;
    response += `| **Bonus** | +${sb.bonus || '0'} | +5 |\n`;
    response += `| **Penalty** | -${sb.penalty || '0'} | -10 |\n`;
    response += `| **TOTAL** | **${sb.total || '?'}/100** | **100** |\n\n`;
  }
  
  // Risk Assessment
  if (analysis.risk_assessment) {
    const risk = analysis.risk_assessment;
    response += `### 🚨 Risk Assessment: ${risk.level || 'UNKNOWN'}\n\n`;
    
    if (risk.factors?.length > 0) {
      response += `**Risk Factors:**\n`;
      risk.factors.forEach((factor: string) => {
        response += `- ${factor}\n`;
      });
      response += `\n`;
    }
    
    if (risk.warnings?.length > 0) {
      response += `**Warnings:**\n`;
      risk.warnings.forEach((warning: string) => {
        response += `- ⚠️ ${warning}\n`;
      });
      response += `\n`;
    }
  }
  
  // Evaluation
  if (analysis.evaluation) {
    response += `### 📝 AI Evaluation\n\n${analysis.evaluation}\n\n`;
  }
  
  // Recommendation
  if (analysis.recommendation) {
    response += `### 💡 Recommendation\n\n${analysis.recommendation}\n\n`;
  }
  
  // Confidence
  if (analysis.confidence) {
    response += `---\n*Confidence: ${analysis.confidence}% | Data Source: ${dataSource || 'Unknown'}*`;
  }
  
  return response;
}
