# Strategy Demystify

> AI-Powered Trading Strategy Scoring for Polymarket Prediction Markets

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Kimi AI](https://img.shields.io/badge/Kimi-k2.5-FF6B6B?style=flat-square)](https://www.moonshot.cn/)

A sophisticated AI-driven platform that analyzes, backtests, and scores trading strategies for Polymarket prediction markets using a proprietary 0-100 scoring framework.

## 🎯 Overview

Strategy Demystify bridges the gap between natural language trading ideas and data-driven strategy validation. Users can describe their trading strategies in plain English (e.g., *"Buy BTC UP when 5m RSI first touches 20"*), and the system will:

1. **Parse** the strategy using Kimi AI (Kimi k2.5)
2. **Backtest** against real historical Polymarket data via PolyBackTest API
3. **Score** the strategy using a comprehensive 0-100 point framework
4. **Report** detailed analysis with risk assessment, metrics, and actionable recommendations

## ✨ Key Features

### 🤖 AI-Powered Strategy Parsing
- Natural language strategy input
- Automatic extraction of parameters (timeframe, entry/exit triggers, indicators)
- Support for RSI, price thresholds, time windows, and custom logic

### 📊 Real Historical Backtesting
- Integration with PolyBackTest API (60M+ snapshots)
- Sub-second order book depth data
- Full bid/ask spread simulation
- Multiple timeframe support (5m, 15m, 1h, 4h, 24h)

### 📈 0-100 Scoring Framework
- **Profit Factor** (0-20 points)
- **Max Drawdown** (0-20 points) 
- **Sharpe Ratio** (0-20 points)
- **CAGR** (0-20 points)
- **Win Rate** (0-20 points)
- Bonus/Penalty system for edge cases

### 🔒 Risk Assessment Engine
- 4-tier risk classification (LOW → CRITICAL)
- Custom warning system
- Strategy-specific risk factor identification

## 🏗️ Architecture

### Two-Stage AI + TypeScript Pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Natural Lang   │────▶│   Kimi AI Parse  │────▶│  Structured     │
│  Strategy Input │     │  (Kimi k2.5)     │     │  Parameters     │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Final JSON    │◀────│   Kimi AI Score  │◀────│  Backtest       │
│   Report        │     │  (Risk + Verdict)│     │  Results        │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                    ┌──────────────────┐                   │
                    │  TypeScript      │◀──────────────────┘
                    │  Simulation      │
                    │  (Real Data)     │
                    └──────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS v4 |
| Backend | Next.js API Routes, TypeScript |
| AI Engine | Kimi k2.5 via OpenRouter |
| Data API | PolyBackTest REST API |
| Styling | Tailwind CSS, CSS Variables (Dark Theme) |

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/0xanrelins/strategy-demystify.git
   cd strategy-demystify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```env
   # Required: PolyBackTest API Key
   POLYBACKTEST_API_KEY=your_polybacktest_key_here
   
   # Required: OpenRouter API Key (for Kimi k2.5 access)
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open browser**
   Navigate to `http://localhost:3000`

### Getting API Keys

**PolyBackTest API Key:**
- Sign up at [polybacktest.com](https://polybacktest.com)
- Free tier: 100 snapshots per request
- Pro tier ($19/mo): Unlimited snapshots

**OpenRouter API Key:**
- Sign up at [openrouter.ai](https://openrouter.ai)
- Search for "moonshotai/kimi-k2.5" model
- Add credits to your account

## 💡 Usage

### Example Strategies

1. **RSI Mean Reversion**
   ```
   Buy market UP when BTC 5m RSI first touches 20
   ```

2. **Price Threshold**
   ```
   Buy UP side when price hits 98c+ in last 15 seconds of 15m market
   ```

3. **Time Window**
   ```
   Enter UP position at 14:50 in 15m BTC market if price > 60c
   ```

### Understanding Results

The system returns a comprehensive JSON report:

```json
{
  "strategy_name": "RSI-20 Mean Reversion 5m",
  "score_breakdown": {
    "final_score": 45,
    "profit_factor_points": 12,
    "max_drawdown_points": 8,
    ...
  },
  "risk_assessment": {
    "level": "MEDIUM",
    "warnings": ["Low sample size", "High volatility regime"]
  },
  "verdict": "REVISE",
  "metrics": {
    "profit_factor": 1.5,
    "max_drawdown": "12.5%",
    "win_rate": "58%",
    "trade_count": 47
  }
}
```

### Verdict System

| Score | Verdict | Action |
|-------|---------|--------|
| 75-100 | **DEPLOY** | Ready for live trading |
| 50-74 | **REVISE** | Optimize parameters |
| 25-49 | **REJECT** | Significant issues |
| 0-24 | **REJECT** | Do not use |

## 📁 Project Structure

```
strategy-demystify/
├── app/
│   ├── api/
│   │   └── analyze/
│   │       └── route.ts          # Main API endpoint (2-stage pipeline)
│   ├── components/
│   │   ├── ChatInput.tsx         # Strategy input component
│   │   ├── MessageList.tsx       # Chat/message display
│   │   └── StrategyReport.tsx    # Results visualization
│   ├── lib/
│   │   └── skills/
│   │       └── STRATEGY_ANALYZER_LLM.md  # Kimi AI skill file
│   └── page.tsx                  # Main dashboard
├── public/                        # Static assets
├── .env.local                     # Environment variables (gitignored)
├── next.config.js                 # Next.js configuration
├── package.json
├── tailwind.config.ts
└── README.md                      # This file
```

## 🔧 Configuration

### Customizing the Skill File

The AI behavior is controlled by `app/lib/skills/STRATEGY_ANALYZER_LLM.md`. This file contains:

- Strategy parsing rules
- Scoring framework algorithms
- Risk assessment criteria
- Required output format

Modify this file to adjust how Kimi interprets and scores strategies.

### Adjusting RSI Period

Default RSI calculation uses 14 periods. To change this, edit the `calculateRSI` function in `app/api/analyze/route.ts`.

### API Pagination

By default, the system fetches 100 snapshots per market. For Pro tier users, increase the `limit` parameter in the PolyBackTest API calls to fetch more historical data.

## 🐛 Troubleshooting

### "Backtest results: null"
This means no trades were generated. Check:
- RSI threshold may be too strict (try 30 instead of 20)
- Price threshold may be unreachable
- Timeframe may not have enough volatility

### "401 Unauthorized"
- Verify your PolyBackTest API key is valid
- Check OpenRouter API key and credits

### "Timeframe mismatch"
The requested timeframe wasn't available. System defaults to closest match. Check available markets in your PolyBackTest tier.

## 📝 Roadmap

- [x] Natural language strategy parsing
- [x] PolyBackTest API integration
- [x] Real RSI calculation
- [x] 0-100 scoring framework
- [ ] Multi-market backtesting (aggregate data)
- [ ] Custom indicator support (MACD, Bollinger Bands)
- [ ] Strategy optimization suggestions
- [ ] Export results to CSV/JSON
- [ ] Vercel deployment template

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [PolyBackTest](https://polybacktest.com) for historical Polymarket data
- [Kimi AI](https://www.moonshot.cn/) / [OpenRouter](https://openrouter.ai) for LLM capabilities
- [Next.js](https://nextjs.org/) team for the framework

## 📞 Contact

For issues or questions, please open a GitHub issue.

---

**Disclaimer:** This tool is for educational and research purposes. Past performance does not guarantee future results. Always conduct your own due diligence before deploying trading strategies with real capital.
