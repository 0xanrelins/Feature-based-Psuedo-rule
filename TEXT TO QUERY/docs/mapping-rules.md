# Mapping Rules

> **User ifadesi → domain alanı** örnekleri ve rehber. Bu dosya **kısıtlayıcı değildir**: LLM glossary, terminology library ve kendi domain bilgisiyle (in profit direction, in our favor, take profit, resolution vb.) anladığı terimleri güvenle eşlesin; "mapping'de yok" diye sanci sektirmesin.
> **Domain terimleri:** [docs/glossary.md](glossary.md) — session, time range, entry, exit.

---

## 0. Definments (Bounded Context)

Kullanıcı bunları tanımlamalı veya agent sormalı. Varsayılanlar:

| Definment | Açıklama | Default | Örnek |
| :--- | :--- | :--- | :--- |
| `platform` | Prediction market platformu | polymarket | polymarket |
| `topic` | Konu | crypto | crypto |
| `pair` | Çift | btc | btc |
| `timeframe` | Session süresi tipi (market_type) | 15m | 5m, 15m, 1hr, 4hr, 24hr |
| `token` | Varsayılan yön (UP/DOWN) | up | up, down |
| `data_range` | Varsayılan time range | last 30 days | last 7 days, last 30 days |
| `data_platform` | Veri kaynağı | polybacktest | polybacktest |

---

## 1. Session (market_type)

**Domain:** Session süresi hangi tipte? (Glossary: Session = tek market’in ömrü; `market_type` süreyi belirler.)

| User ifadesi | Domain alanı | Slot / API |
| :--- | :--- | :--- |
| "5 minutes", "5min", "5m" | market_type | `5m` |
| "15 minutes", "15m", "quarter hour" | market_type | `15m` |
| "1 hour", "hourly", "1hr" | market_type | `1hr` |
| "4 hours", "4hr" | market_type | `4hr` |
| "daily", "24 hours", "24hr", "1 day" | market_type | `24hr` |

Belirtilmezse → definments.timeframe (default 15m).

---

## 2. Time range (start_time, end_time)

**Domain:** Backtest hangi takvim aralığındaki session’lara baksın? (Glossary: Time range.)

| User ifadesi | Domain alanı | Hesaplama |
| :--- | :--- | :--- |
| "last N days", "past N days", "over the last N days" | start_time, end_time | start = today − N gün, end = today (YYYY-MM-DD). N 1–31. |
| "past week", "this week" | start_time, end_time | start = today − 7, end = today |
| "past month", "last month" | start_time, end_time | start = today − 30, end = today |
| "since yesterday" | start_time, end_time | start = dün 00:00 UTC, end = now |
| "today" | start_time, end_time | start = bugün 00:00 UTC, end = now |
| "since {date}", "between {date1} and {date2}" | start_time, end_time | Verilen tarihler (ISO8601). |

**Kural:** end_time verilmezse = now. **Limit:** En fazla 31 gün; daha eski istek reddedilir.  
**Belirtilmezse:** definments.data_range (örn. last 30 days). **Referans tarih:** LLM’e “Today’s date” context’te verilir; yıl tahmin edilmez.

---

## 3. Token (yön)

**Domain:** Hangi token (UP/DOWN)? (Glossary: Token.)

| User ifadesi | Domain alanı | Slot |
| :--- | :--- | :--- |
| "up", "UP", "goes up", "rises", "buy up", "bullish" | token | `up` → price_up |
| "down", "DOWN", "goes down", "drops", "buy down", "bearish" | token | `down` → price_down |

Belirtilmezse → definments.token (default up).  
**Not:** UP = BTC yukarı bahsi, DOWN = aşağı; fiyat 0–1 (olasılık).

---

## 4. Entry condition (buy_triggers[].condition)

**Domain:** Giriş koşulu — hangi fiyat/BTC koşulunda alınacak? (Glossary: Entry condition.)

| User ifadesi | Domain alanı | Koşul (örnek, UP için) |
| :--- | :--- | :--- |
| "above 0.XX", "price > 0.XX", "crosses 0.XX" | entry condition | `price_up > 0.XX` |
| "below 0.XX", "under 0.XX", "price < 0.XX" | entry condition | `price_up < 0.XX` |
| "price 0.XX", "at 0.XX", "if price 0.XX" (above/below yok) | entry condition | `price_up >= 0.XX` (giriş fiyat 0.XX’e gelince) |
| "X cent", "touch X cent", "first touch 6 cent" | entry condition | `price_up <= 0.0X` (6 cent → 0.06) |
| "when cheap", "when low" | entry condition | `price_up < 0.40` |
| "when expensive", "when high" | entry condition | `price_up > 0.60` |
| "around 0.50" | entry condition | `0.48 <= price_up <= 0.52` |

DOWN için `price_up` → `price_down`.  
**Çoklu koşul (trigger list):** "Follow BTC X%" → iki trigger (btc_pct >= X → up, btc_pct <= -X → down); "opposite BTC" → aynı koşullar, token’lar ters. İlk tetiklenen kazanır.

---

## 5. Entry window (opsiyonel)

**Domain:** Session içinde sadece belli bir zaman aralığında mı giriş yapılsın? (Glossary: Entry window.)

| User ifadesi | Domain alanı | Not |
| :--- | :--- | :--- |
| "in the last minute", "last N minutes of the session" | entry window | Session’ın bitimine göre. **Slot:** `entry_window_minutes=N`, `entry_window_anchor="end"`. |
| "in the first minute", "first N minutes of the session" | entry window | Session’ın başlangıcına göre. **Slot:** `entry_window_minutes=N`, `entry_window_anchor="start"`. |

Bu alan için tek eşleme kaynağı: glossary’deki “Kullanıcı ifadeleri → hangi kavram” (entry window = session’a göre, veri aralığı değil).

---

## 6. Exit (sell_condition)

**Domain:** Ne zaman satılacak? (Glossary: Exit, market_end.)

| User ifadesi | Domain alanı | Slot |
| :--- | :--- | :--- |
| "at close", "market end", "resolution", "session end", "sell at close" | exit | `sell_condition = "market_end"` |
| "sell immediately", "exit right away", "hemen sat" | exit | `sell_condition = "immediate"` |
| "sell when price above 0.XX" | exit | `sell_condition = "price_up > 0.XX"` (veya price_down) |
| "2x from filling/entry", "giriş fiyatının 2 katı", "double from entry", "when price 2x from fill" | exit | `sell_condition = "price_up >= 2 * entry_price"` (DOWN için price_down) |

**Çıkış koşulunda giriş fiyatı:** Kullanıcı "filling price’tan X kat", "entry’den 2x" derse koşulun **sağ tarafında** mutlaka `entry_price` kullan; anlık fiyat alanı (`price_up` / `price_down`) sadece **sol tarafta** olsun. Örnek: `price_up >= 2 * entry_price`. Yanlış: `price_up >= 2 * price_up`.

Belirtilmezse → `market_end`.

**Exit on % move (exit_on_pct_move, exit_pct_move_direction):** Giriş fiyatından X% hareket olunca çık.

| User ifadesi | Domain alanı | Slot |
| :--- | :--- | :--- |
| "sell after 0.2% move", "exit when price moves X%", "sell when it moves X%" | exit_on_pct_move | sayı (örn. 0.2) |
| "moves opposite side", "when it moves against us", "sell when it goes against" | exit_pct_move_direction | `against` |
| "in our favor", "when it moves in favor" | exit_pct_move_direction | `favor` |
| Yön belirtilmezse | exit_pct_move_direction | `any` |
| "when BTC moves X%" | exit_pct_move_ref | `btc` (yoksa `token`) |

**Direction / opposite (giriş):** "Opposite side", "fade BTC", "opposite of BTC" → hangi taraf alınacak: BTC’nin tersi (Opposite BTC trigger listesi; token’lar swap).

---

## 7. Entry mantığı (scan, first trigger wins)

**Domain:** Entry = ilk snapshot (zaman sırasına göre) where entry condition (ve varsa entry window) sağlanır. Session başından taranır; cap market timeframe’e göre. Koşul hiç sağlanmazsa o market’te işlem yok. **Trigger list:** Birden fazla `{ condition, token }` varsa sırayla değerlendirilir; ilk true olan giriş token’ını ve girişi belirler.

---

## 8. Endpoint seçimi

| Kullanıcı niyeti | Kural | API akışı |
| :--- | :--- | :--- |
| "list markets", "which markets" | List | `GET /v1/markets?market_type=...&resolved=...` |
| Belirli tarih + timeframe | Tek market | `GET /v1/markets/by-slug/...` |
| "backtest", "what if I bought", "test strategy" | Backtest | `GET /v1/markets` (resolved) → her market için `GET /v1/markets/{id}/snapshots` → entry/exit koşulları uygula |
| "right now", "at that exact time" | Snapshot-at | `GET /v1/markets/{id}/snapshot-at/{timestamp}` |

---

## 9. Exit fiyatı (market_end)

**sell_condition = market_end** ise çıkış fiyatı **market.winner**’dan: kazanan token = 1.0, kaybeden = 0.0. Snapshot’ta winner yok; market objesinden okunur.

---

## 10. Örnek: User sorusu → domain + akış

| User sorusu | Time range | Session | Token | Entry condition | Exit | Akış |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| "What if I bought UP above 0.60 in 15m over the last 7 days and sold at close?" | last 7 days | 15m | up | price_up > 0.60 | market_end | Backtest: list markets → snapshots → first trigger |
| "Buy first touch 6 cent, sell at session end" | (definments) | (definments) | up | price_up <= 0.06 | market_end | Aynı |
| "What’s the current UP price in 1hr market?" | — | 1hr | up | — | — | Snapshot-at now |

---

## 11. Hata / eksiklik

| Durum | Agent davranışı |
| :--- | :--- |
| Eksik definment (örn. timeframe yok) | Sor: "Hangi timeframe? (5m, 15m, 1hr, 4hr, 24hr)" |
| 31 günden eski istek | Uyar: "En fazla 31 gün veri destekleniyor." |
| Belirsiz koşul | Default kullan, kullanıcıyı bilgilendir |
| API 401 / 404 / 429 | İlgili hata mesajı (key, not found, rate limit) |
