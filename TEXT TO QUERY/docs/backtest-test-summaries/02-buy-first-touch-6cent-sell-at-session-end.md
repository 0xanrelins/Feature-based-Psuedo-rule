# Test 2: Buy first price touch to 6 cent, sell at end of session

**Tarih:** 2026-02-27

## Soru (user query)
"buy first price touch to 6cent and go to end to the session"

## Parse sonucu
| Alan | Değer |
|------|--------|
| action | backtest |
| timeframe | 15m |
| token | up |
| range | 2026-01-28 → 2026-02-27 (default 30 gün) |
| buy_when | price_up <= 0.06 |
| sell_when | market_end |

## Yorum
- "6 cent" → 0.06 (parser’a X cent → 0.0X kuralı eklendi).
- "First price touch to 6 cent" → ilk fiyat 0.06’ya (veya altına) dokunduğunda al.
- "Go to end of session" → kapanışta sat (market_end).
- Token belirtilmedi → default UP (price_up <= 0.06).

## Veri kaynağı
- Local cache: `data/15m_30d_snapshots/`
- Resolved market listesi: API (list_markets)
- **Sonuçlar için:** Son 7 günle çalıştırıldı (671 market, hepsi diskte; 30 gün 2847 market + eksik cache yüzünden uzun sürüyordu).

## Sonuçlar (son 7 gün: 2026-02-20 → 2026-02-27)

**Not:** Kapanışta exit fiyatı artık `market.winner` ile hesaplanıyor (kazanan token = 1.0, kaybeden = 0.0). Önceden son snapshot’ın fiyatı kullanılıyordu; bu yüzden bazı UP kazanan market’ler yanlışlıkla “kayıp” sayılıyordu (exit 0.22 gibi). Winner kullanınca gerçek kazanan sayısı çıkıyor.

| Metrik | Değer |
|--------|--------|
| Total Trades | 329 |
| Wins | 17 |
| Losses | 312 |
| Win Rate | 5.2% |
| Total P&L | -1.8900 |
| Avg P&L | -0.0057 |

Özet: UP 0.06 veya altında ilk dokunuşta al, kapanışta sat. 7 günde 329 trade; 17 trade’te UP kazandı (exit = 1.0), 312’de DOWN kazandı (exit = 0.0).
