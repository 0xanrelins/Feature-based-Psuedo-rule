# Strategy Demystify + Cursor Score Strategy Integration Plan

## Skill analysis

[GitHub - 0xanrelins/cursor-score-strategy](https://github.com/0xanrelins/cursor-score-strategy)

**Skill features:**
- Python-based backtesting (Backtrader)
- 0-100 Scoring Framework (5 metric)
- Natural language → strategy parser
- Red flag detection
- Terminal-formatted output

**Scoring metrics:**
1. **PF** (Profit Factor) - 20%
2. **MDD** (Max Drawdown) - 20%
3. **Sharpe** (Sharpe Ratio) - 20%
4. **CAGR** (Annual Growth) - 20%
5. **Win Rate** - 20%

Bonus: +10 | Penalty: -10 | Categories: Exceptional/Excellent/Good/Fair/Poor

---

## Integration options

### Seçenek A: Full Python Backend (Complex)
```
Next.js Frontend ← → Python FastAPI Backend ← → Backtrader Engine
```
- **Advantage:** Real backtest, historical data
- **Disadvantage:** Deployment complexity, separate server

### Seçenek B: Scoring Logic Port (Recommended)
```
Next.js Frontend ← → TypeScript Scoring Engine (skill logic ported)
```
- **Advantage:** Single codebase, fast deployment, runs client-side
- **Disadvantage:** Backtesting simulated (historical simulation with mock data)

### Seçenek C: Hybrid Approach
- **Phase 1:** Port scoring logic to TypeScript (now)
- **Phase 2:** Optional Python microservice (later)

---

## Recommended plan (Option B - Port)

### Phase 1: Scoring Engine Migration
**Goal:** Port Python scoring logic to TypeScript

1. **New metrics** (replacing current PT/PRO/SR/CARD/AE)
   - PF: Profit Factor (gain/loss ratio)
   - MDD: Max Drawdown (%)
   - Sharpe: Risk-adjusted return
   - CAGR: Annual performance
   - Win Rate: Trade success rate

2. **ScoreCalculator Service** (TypeScript)
   ```
   app/services/
   └── scoreCalculator.ts
   ```
   - Her metrik 0-20 puan
   - Bonus/Penalty logic
   - 0-100 total score

3. **Category/Rating Sistemi**
   - 90-100: Exceptional 🌟
   - 75-89: Excellent 🏆
   - 60-74: Good ✅
   - 40-59: Fair ⚠️
   - 0-39: Poor ❌

4. **Red Flag Detection**
   - Overfitting: Win Rate >75%
   - Excessive Risk: MDD >30%
   - Poor Returns: CAGR <10%

### Phase 2: Natural Language Parser (Basit)
**Goal:** "Buy at RSI 30" → strategy parameters

1. **Simple Strategy Parser**
   - Regex-based pattern matching
   - RSI, MA, MACD keyword'leri
   - Simple indicator extraction

2. **Mock Historical Data**
   - Deterministic simülasyon
   - Question hash → fake backtest results
   - Realistic PF, MDD, Sharpe values

### Phase 3: UI Enhancements

1. **New ScoreTable** (6-metric display)
   ```
   PF | MDD | Sharpe | CAGR | WinRate | TOTAL
   2.3 | 15% | 1.8    | 22%  | 58%     | 79
   ```

2. **Red Flag Banner**
   - Yellow/Red alerts (visible in UI)
   - "⚠️ Overfitting Risk Detected"

3. **Category Badge**
   - Color categories (green/yellow/red)

4. **Strategy Breakdown**
   - Why did each metric get that score?
   - "PF: 2.3 → 16/20 points (Good)"

---

## File changes

### Yeni Dosyalar
```
app/
├── services/
│   ├── scoreCalculator.ts     # Core scoring logic
│   ├── strategyParser.ts      # NL → strategy params
│   └── enhancedMockAI.ts      # New mock (skill logic)
├── types/
│   └── scoring.ts             # New metric types
└── components/
    ├── ScoreTableV2.tsx         # Updated score table
    └── RedFlagAlert.tsx         # Alert banner
```

### To update
```
app/
├── page.tsx                   # Yeni state'ler
├── components/
│   ├── ChatOutput.tsx         # Yeni format + red flags
│   └── ChatList.tsx           # New sorting (by skill)
```

### To remove
```
app/
├── services/mockAI.ts         # Eski mock yerine enhanced versiyon
└── types/index.ts             # Replace old ScoreBreakdown with new
```

---

## Example user flow

### Before (current)
```
User: "Is buy the dip good?"
AI:  PT: 3.5 | PRO: 35 | SR: 1 | CARD: 22 | AE: 35 | TOTAL: 59
```

### After (with skill)
```
User: "Buy at RSI 30, sell at 70"
↓
Parser: RSI(14) < 30 (entry), RSI(14) > 70 (exit)
↓
Mock Backtest: 90 days, 47 trades
↓
Scores: PF: 2.3 | MDD: 15% | Sharpe: 1.8 | CAGR: 22% | WinRate: 58%
↓
Calculator: 16+12+14+16+15 = 73/100 (+0 bonus, -0 penalty)
↓
Category: Good ✅
↓
Red Flags: None
↓
Recommendation: Deploy with caution
```

---

## Teknik Notlar

### Mock vs real
- For now we use **mock/simulation**
- Skill logic is the same, only data is fake
- Python API can be added later for real backtest

### Sorting change
- Current: Sort by TOTAL
- New: Same (skill also gives total score)
- Compatibility preserved

### Color coding
| Range | Category | Color |
|-------|----------|-------|
| 90-100 | Exceptional | 🟢 Green |
| 75-89 | Excellent | 🟢 Green |
| 60-74 | Good | 🟡 Yellow |
| 40-59 | Fair | 🟠 Orange |
| 0-39 | Poor | 🔴 Red |

---

## Estimated time

| Phase | Duration | Content |
|-------|------|--------|
| 1 | 1.5h | Scoring engine + types |
| 2 | 1h | Parser + enhanced mock |
| 3 | 1.5h | UI updates + red flags |
| 4 | 0.5h | Test + GitHub push |
| **Total** | **~4.5h** | |

---

## Pending approval

Once you approve this plan, I'll start with **Phase 1**.

**Questions:**
1. Do we replace current PT/PRO/SR/CARD/AE metrics entirely, or keep both?
2. Which indicators for the parser? (RSI, MA, MACD?)
3. Should mock data be deterministic? (Same question = same result)
