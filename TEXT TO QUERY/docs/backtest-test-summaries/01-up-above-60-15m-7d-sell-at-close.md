# Test 1: UP above 0.60, 15m, last 7 days, sell at close

**Tarih:** 2026-02-27

## Soru (user query)
"What if I bought UP above 0.60 in 15m markets over the last 7 days and sold at close?"

## Parse sonucu
| Alan | Değer |
|------|--------|
| action | backtest |
| timeframe | 15m |
| token | up |
| range | 2026-02-20 → 2026-02-27 |
| buy_when | price_up > 0.60 |
| sell_when | market_end |

## Veri kaynağı
- Local cache: `data/market_snapshot/` (disk)
- Resolved market listesi: API (list_markets)

## Sonuçlar
| Metrik | Değer |
|--------|--------|
| Total Trades | 542 |
| Wins | 11 |
| Losses | 531 |
| Win Rate | 2.0% |
| Total P&L | -319.6690 |
| Avg P&L | -0.5898 |

## Özet
Strateji: UP 0.60 üstü ilk gördüğünde al, market kapanışında sat. Son 7 günde 671 resolved market tarandı, 542 trade (koşul sağlanan + close bulunan). Çoğu trade’te market DOWN kazandı (exit 0.00–0.01); 11 trade’te UP kazandı.
