# Strategy Demystify + Cursor Score Strategy Integration Plan

## Skill Analizi

[GitHub - 0xanrelins/cursor-score-strategy](https://github.com/0xanrelins/cursor-score-strategy)

**Skill Özellikleri:**
- Python tabanlı backtesting (Backtrader)
- 0-100 Scoring Framework (5 metric)
- Natural language → strategy parser
- Red flag detection
- Terminal-formatted output

**Skorlama Metrikleri:**
1. **PF** (Profit Factor) - 20%
2. **MDD** (Max Drawdown) - 20%
3. **Sharpe** (Sharpe Ratio) - 20%
4. **CAGR** (Annual Growth) - 20%
5. **Win Rate** - 20%

Bonus: +10 | Penalty: -10 | Categories: Exceptional/Excellent/Good/Fair/Poor

---

## Entegrasyon Seçenekleri

### Seçenek A: Full Python Backend (Complex)
```
Next.js Frontend ← → Python FastAPI Backend ← → Backtrader Engine
```
- **Avantaj:** Gerçek backtest, historical data
- **Dezavantaj:** Deployment karmaşıklığı, ayrı server

### Seçenek B: Scoring Logic Port (Recommended)
```
Next.js Frontend ← → TypeScript Scoring Engine (Skill mantığı port edilmiş)
```
- **Avantaj:** Tek codebase, hızlı deployment, client-side çalışır
- **Dezavantaj:** Backtesting simüle (mock data ile historical simülasyon)

### Seçenek C: Hybrid Approach
- **Phase 1:** Scoring mantığını TypeScript'e port et (şimdi)
- **Phase 2:** İsteğe bağlı Python microservice (gelecekte)

---

## Önerilen Plan (Seçenek B - Port)

### Phase 1: Scoring Engine Migration
**Hedef:** Python scoring mantığını TypeScript'e çevir

1. **Yeni Metrikler** (Mevcut PT/PRO/SR/CARD/AE yerine)
   - PF: Profit Factor (kazanç/kayıp oranı)
   - MDD: Max Drawdown (%)
   - Sharpe: Risk-adjusted return
   - CAGR: Annual performance
   - Win Rate: Trade başarı oranı

2. **ScoreCalculator Service** (TypeScript)
   ```
   app/services/
   └── scoreCalculator.ts
   ```
   - Her metrik 0-20 puan
   - Bonus/Penalty mantığı
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
**Hedef:** "RSI 30'da al" → strateji parametreleri

1. **Simple Strategy Parser**
   - Regex-based pattern matching
   - RSI, MA, MACD keyword'leri
   - Basit indikatör çıkarımı

2. **Mock Historical Data**
   - Deterministic simülasyon
   - Question hash → fake backtest sonuçları
   - Gerçekçi PF, MDD, Sharpe değerleri

### Phase 3: UI Enhancements

1. **Yeni ScoreTable** (6 metric gösterimi)
   ```
   PF | MDD | Sharpe | CAGR | WinRate | TOTAL
   2.3 | 15% | 1.8    | 22%  | 58%     | 79
   ```

2. **Red Flag Banner**
   - Sarı/Red uyarılar (UI'da görsel)
   - "⚠️ Overfitting Risk Detected"

3. **Category Badge**
   - Renkli kategoriler (yeşil/sarı/kırmızı)

4. **Strategy Breakdown**
   - Her metrik neden o puanı aldı?
   - "PF: 2.3 → 16/20 points (Good)"

---

## Dosya Değişiklikleri

### Yeni Dosyalar
```
app/
├── services/
│   ├── scoreCalculator.ts     # Ana scoring mantığı
│   ├── strategyParser.ts      # NL → strategy params
│   └── enhancedMockAI.ts      # Yeni mock (skill mantığıyla)
├── types/
│   └── scoring.ts             # Yeni metric tipleri
└── components/
    ├── ScoreTableV2.tsx         # Güncellenmiş score table
    └── RedFlagAlert.tsx         # Uyarı banner'ı
```

### Güncellenecekler
```
app/
├── page.tsx                   # Yeni state'ler
├── components/
│   ├── ChatOutput.tsx         # Yeni format + red flags
│   └── ChatList.tsx           # Yeni sorting (skill'e göre)
```

### Silinecekler
```
app/
├── services/mockAI.ts         # Eski mock yerine enhanced versiyon
└── types/index.ts             # Eski ScoreBreakdown yerine yeni
```

---

## Örnek Kullanıcı Akışı

### Before (Mevcut)
```
User: "Is buy the dip good?"
AI:  PT: 3.5 | PRO: 35 | SR: 1 | CARD: 22 | AE: 35 | TOTAL: 59
```

### After (Skill Entegreli)
```
User: "RSI 30'da al, 70'te sat"
↓
Parser: RSI(14) < 30 (entry), RSI(14) > 70 (exit)
↓
Mock Backtest: 90 gün, 47 trades
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

### Mock vs Gerçek
- Şimdilik **mock/simulation** kullanacağız
- Skill'in mantığı aynı, sadece data fake
- Gelecekte gerçek backtest için Python API eklenebilir

### Sıralama Değişimi
- Mevcut: TOTAL'a göre sıralama
- Yeni: Aynı (skill de total score veriyor)
- Compatibility korunur

### Renk Kodlaması
| Range | Category | Color |
|-------|----------|-------|
| 90-100 | Exceptional | 🟢 Green |
| 75-89 | Excellent | 🟢 Green |
| 60-74 | Good | 🟡 Yellow |
| 40-59 | Fair | 🟠 Orange |
| 0-39 | Poor | 🔴 Red |

---

## Tahmini Süre

| Phase | Süre | İçerik |
|-------|------|--------|
| 1 | 1.5h | Scoring engine + types |
| 2 | 1h | Parser + enhanced mock |
| 3 | 1.5h | UI updates + red flags |
| 4 | 0.5h | Test + GitHub push |
| **Total** | **~4.5h** | |

---

## Onay Bekleniyor

Bu planı onaylarsan **Phase 1** ile başlıyorum.

**Sorular:**
1. Mevcut PT/PRO/SR/CARD/AE metriklerini TAMAMEN mi değiştiriyoruz? Yoksa ikisi de mi kalsın?
2. Parser için hangi indikatörler? (RSI, MA, MACD?)
3. Mock data deterministik mi olsun? (Aynı soru = Aynı sonuç)
