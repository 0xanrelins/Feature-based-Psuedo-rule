# Text-to-Query Backtest Skill — Schema Özeti

Kullanıcı cümlesi → Parse (LLM veya rule-based) → **ParsedQuery** → Backtest.

---

## ParsedQuery (Ana Şema)

| Alan | Tip | Açıklama |
|------|-----|----------|
| `market_type` | str | `5m` \| `15m` \| `1hr` \| `4hr` \| `24hr` |
| `start_time`, `end_time` | datetime | Backtest tarih aralığı |
| `buy_triggers` | list[dict] | `[{ "condition": str, "token": "up" \| "down" }, ...]` — ilk tetiklenen kazanır |
| `sell_condition` | str | `market_end` \| `immediate` \| veya fiyat/indikatör koşulu |
| `price_source` | str | `token` \| `btc_price` |
| `entry_window_minutes` | int \| null | Sadece session içinde N dakikada giriş (null = tüm session) |
| `entry_window_anchor` | str | `start` \| `end` (ilk / son N dakika) |
| `exit_on_pct_move` | float \| null | Girişe göre % hareket olunca çık (örn. 0.2 = %0.2) |
| `exit_pct_move_ref` | str | `token` \| `btc` |
| `exit_pct_move_direction` | str | `any` \| `favor` \| `against` |
| `action` | str | `backtest` \| `list_markets` \| `snapshot_at` |

---

## Condition İfadeleri

- **Karşılaştırma:** `price_up > 0.60`, `rsi < 30`, `macd_hist > 0`
- **Eşitlik:** `prev_5_btc_candles_same_color == "green"`
- **Aralık:** `0.40 <= price_up <= 0.60`
- **Crossover:** `ema_12 crosses_above price_up`, `rsi crosses_above 30` (önceki snapshot gerekir)

---

## Desteklenen Alanlar (Snapshot)

**Fiyat:** `price_up`, `price_down`, `btc_price`, `btc_pct_from_start`  
**Özel:** `prev_5_btc_candles_same_color`  
**TA:** `rsi`, `rsi_7`, `ema_9`, `ema_12`, `ema_20`, `ema_26`, `ema_50`, `macd`, `macd_signal`, `macd_hist`, `bb_upper`, `bb_middle`, `bb_lower`, `stoch_rsi_k`, `stoch_rsi_d`, `btc_rsi`, `btc_ema_9`, `btc_ema_12`, `btc_ema_20`

Desteklenmeyen (clarification): vwap, atr, cci, williams, adx, ichimoku, volume, obv, mfi, dmi, vb.

---

## Akış

1. **Parse:** User text + definments → LLM slots (veya rule-based) → `ParsedQuery`
2. **Backtest:** Markets listele → her market için snapshot’lar yükle → TA zenginleştir (gerekirse) → entry/exit koşullarını değerlendir → Trade listesi
3. **Çıkış:** Win rate, PnL, trade detayları

---

## Kaynaklar

- Slot kuralları: `docs/mapping-rules.md`
- Terimler: `docs/glossary.md`
- TA terimleri: `docs/backtest-crypto-trading-terminology-library.md`
