---

Feature-based Pseudo-rule

---



- Technical Analysis–based
- definments = bounded context
- user natural language  to database query 
- Mapping rules doc
- **NLP / intent parsing + domain model**  
- “Agent” dediğin kısım burada ayrı bir ajan orkestrasyonu değil; pratikte 1 LLM parse çağrısı + deterministic backtest pipeline.

---

### "TA"

### 3 yapı **industry standard**:

- Trend Following
- Breakout
- Mean Reversion

Bu üçü zaten **tüm sistematik trading evrenini kapsar**.

---

Notes;

- ❌ OHLC → gerçek volume üretmez
- ✅ Profesyoneller **3 yapıdan birini** seçer
- ✅ Mean Reversion **BTC’de çok güçlüdür**
- ❌ Ama **sadece doğru market rejiminde**

---

Bir sonraki adımda istersen:

- 🔬 **Mean Reversion için backtest framework**
- 🧠 **Market regime detection (rule-based)**
- 🧩 **Price-only → feature engineering**

---

## 3.3 Profesyoneller Mean Reversion’ı NASIL bozar?

Çoğu kişinin kaybettiği yer burası:

❌ **Trend markette mean reversion denemek**  
❌ **Stop kullanmamak**  
❌ **“Biraz daha düşer ama döner” demek**

Profesyonel ise:

- **ATR stop** kullanır
- **Zaman stop** koyar (ör: 10 mumda dönmezse çık)
- **Win rate yüksek / RR düşük** kabul eder

---

## Basit ama Gerçekçi Pseudo-Rule

```
IF
  EMA200 slope ≈ 0
  RSI < 28
  Close < BB lower
THEN
  Long
  TP = BB mid
  SL = Entry - 1.2 × ATR
```

---

Bu şunu kabul eder:

- Win rate yüksek
- Risk/Reward düşük
- Ama sistematik

> Profesyonel farkı burada başlar.

---

İndikatörler **araçtır**, kural değildir.  

---

## Pseudo-Rule nasıl yazılır? (Genel Şablon)

```
IF
  Market regime = X
  Condition A
  Condition B
THEN
  Action
  Exit logic
  Risk logic
```

---

Özet (çok net)

- ✅ Pseudo-Rule = stratejiyi **formülize etmek**
- ✅ İnsan + makine için **ortak dil**
- ❌ “Grafikte gördüm” yaklaşımı değil
- ✅ Backtest, optimization, deployment’a açılır

---

- User asks (natural language)
- System parses to structured rule
- Agent/UI returns human-form summary (“Şöyle anladım”)
- Onay sonrası execution/backtest çalışır.

---

### METRICS (en kritik kısım)

Bakılan şeyler:

- Win rate ❌ tek başına anlamsız
- Expectancy ✅
- Max drawdown ✅
- Trade başına süre
- Hangi markette çalışıyor / ölüyor

---

## 1.2 Profesyonel Backtest’te sorulan sorular

> “Kazanıyor mu?” ❌  
> “**Ne zaman kazanıyor, ne zaman ölüyor?**” ✅

Örnek sonuç yorumu:

- Trend market → **zarar**
- Sideways → **istikrarlı**  
→ Demek ki **regime filtresi şart**

---

## Rule-Based Regime Detection (price-only)

### Örnek Pseudo-Rule:

```
IF
  abs(EMA200_slope) < ε
  ATR_normalized < threshold
THEN
  Market = RANGE
```

```
IF
  EMA50 > EMA200
  Higher High + Higher Low
THEN
  Market = TREND_UP
```

---

# 3 Adım Birlikte Nasıl Çalışır?

```
Market Regime
   ↓
Strateji Seçimi
   ↓
Pseudo-Rule
   ↓
Backtest
   ↓
Optimize / Kill
```



---

## Uygulama Mimarisi

```
Ham Veri (OHLCV + OB + Funding)
        ↓
Feature Engineering (50+ özellik)
        ↓
Model Eğitimi (XGBoost / Random Forest)
        ↓
Pseudo-Rule Çıkarımı (SHAP / Rule Extraction)
        ↓
Backtest → Paper Trade → Live Trade
```

---

Sistem, bir karara varmak için verinin içindeki farklı özellikleri (renk, boyut, frekans, bağlam vb.) ağırlıklandırır.

---

Feature-based Pseudo-rule

---

Senin sistemin aslında bir **"Filtre Bulucu"**ya dönüşecek. Sen "RSI < 10" dediğinde, sistem arka planda o RSI < 10 anlarını "Başarılı" ve "Başarısız" diye iki kutuya ayıracak. Başarılı kutusundaki ortak özellikleri (Yüksek hacim, sabah saatleri vb.) bulup sana raporlayacak.

---

Buna **"Feature Importance" (Özellik Önem Analizi)** denir. Sen kod yazmasan da mantık budur: **Hangi yan özellik, ana kuralın başarısını artırıyor?**