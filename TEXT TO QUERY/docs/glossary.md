# Glossary — Domain terimleri + Polymarket eşlemesi

> Tek referans: tüm terimler burada tanımlı. LLM prompt’u ve mapping kuralları buna göre.
> **Kaynaklar:** [Polymarket Docs](https://docs.polymarket.com/), [Polymarket CLI](https://github.com/Polymarket/polymarket-cli)

---

## Platform tarafı (Polymarket)

| Terim | Tanım | Polymarket karşılığı |
| :--- | :--- | :--- |
| **Market** | Tek bir evet/hayır sorusu; başlangıç ve bitiş zamanı var; iki outcome (Yes/No). | [Markets & Events](https://docs.polymarket.com/) — market = condition + outcomes; CLI: `polymarket markets get`, `markets list`. |
| **Event** | İlişkili market’leri gruplayan yapı (örn. “2024 Election”). | CLI: `polymarket events list`, `events get`. Bizim backtest’te tek market = tek session. |
| **Token** | Bir outcome’a bağlı trade edilebilir pay. Bizde: UP (fiyat yukarı) / DOWN (fiyat aşağı). | Polymarket’te Yes/No token; CLOB’da `tokenID`, fiyat 0–1. CLI: `clob price`, `clob book`. |
| **Resolution** | Market’in kapanması; kazanan outcome belli olur. | [Resolution](https://docs.polymarket.com/) — resolution sonrası kazanan token 1, diğeri 0. |
| **CLOB** | Merkezi limit order book; fiyatlar ve emirler burada. | [Orderbook](https://docs.polymarket.com/) — fiyat geçmişi, order book. Bizde snapshot’lar CLOB fiyatlarının zaman serisi. |
| **Candle** | In trading/backtest: a price bar over a time period (open, high, low, close). "Same color" = same direction (green = close > open, red = close < open). In our system we have **snapshots** (point-in-time: time, price_up, price_down, btc_price); one snapshot = one "candle" close. "Candle" can mean: (1) one snapshot (token or btc price), or (2) external BTC OHLC bar. For "N candle sequence same color", infer from context; only ask if unclear: token snapshots vs BTC candles. | Snapshot = our data; candle = standard term. |

---

## Backtest domain (bizim model)

| Terim | Tanım | Slot / alan |
| :--- | :--- | :--- |
| **Session** | Tek bir market’in ömrü: `start_time` → `end_time`. Süre market_type’a göre (5m, 15m, 1hr, 4hr, 24hr). | `market_type` session süresini belirler; her resolved market = bir session. |
| **Time range** | Backtest’in kapsadığı **takvim aralığı**. Hangi session’lara bakıyoruz (hangi tarihler arası market’ler). | `start_time`, `end_time` (YYYY-MM-DD veya datetime). |
| **Entry** | Ne zaman ve hangi koşulla **alım** yapılacak. | `buy_triggers`: liste of `{ condition, token }`; ilk tetiklenen kazanır. |
| **Entry condition** | Giriş için gerekli koşul (fiyat, BTC % vb.). | `buy_triggers[i].condition` (örn. `price_up >= 0.90`). |
| **Entry window** | Session içinde girişe izin verilen **zaman aralığı**. Örn. “only in the last minute” = session sonuna göre; “only in the first 10 minutes” = session başlangıcına göre. | `entry_window_minutes` + `entry_window_anchor` (`end`=last N, `start`=first N). |
| **Exit** | Ne zaman **satış** (pozisyon kapatma). | `sell_condition`: `market_end` | `immediate` | veya fiyat koşulu. |
| **market_end** | Session sonunda kapat; resolution’a göre kazanan token 1, kaybeden 0. | `sell_condition = "market_end"`. |
| **Exit on % move** | Giriş fiyatından (veya BTC fiyatından) belirli bir **yüzde hareket** olduğunda sat. Örn. "sell after 0.2% move" = fiyat girişe göre %0,2 hareket edince çık. | `exit_on_pct_move` (sayı, örn. 0.2), `exit_pct_move_ref` (token / btc), `exit_pct_move_direction` (any / favor / against). |
| **exit_pct_move_direction** | % hareketin **hangi yönde** olunca çıkılacağı: **any** = herhangi yönde X%, **favor** = lehimize X%, **against** = aleyhimize (ters taraf, "opposite side") X%. | `"any"` \| `"favor"` \| `"against"`. |

---

## Kullanıcı ifadeleri → hangi kavram

- “Last 7 days”, “son 3 gün” → **time range** (takvim aralığı).
- “In the last minute”, “session’ın son dakikasında” → **entry window** (session’a göre; veri aralığı değil).
- “Price 0.90”, “above 0.60” → **entry condition**.
- “Sell at close”, “market end”, “resolution” → **exit** = `market_end`.
- **“Sell after 0.2% move”**, “exit when price moves X%” → **exit on % move** (`exit_on_pct_move` = X; yön yoksa `any`).
- “Moves opposite side”, “when it moves against us” → **exit on % move** + yön = **against**.
- “In our favor”, “when it moves in favor” → **exit on % move** + yön = **favor**.
- “UP” / “DOWN” → **token** (yön).

---

## Veri kaynağı notu

- **PolyBackTest API:** Bizim backtest’te kullandığımız historical snapshot’lar (market başına fiyat serisi, resolution). Polymarket CLOB’un geçmiş verisi / türevi.
- **Polymarket CLI / Docs:** Market yapısı, token, resolution, order book kavramları için referans. Canlı/geçmiş veri için API farklı olabilir; bizim motor PolyBackTest’e göre.
