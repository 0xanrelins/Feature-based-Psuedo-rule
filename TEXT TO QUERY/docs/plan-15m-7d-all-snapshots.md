# Plan: 15m BTC — Last 7 Days, Every Market’s Full Snapshots (Minimum Time)

**Goal:** Fetch all snapshots for every 15m BTC market in the last 7 days, as fast as rate limits allow.

---

## Scale

- **7 days, 15m** → 7 × 24 × 4 = **672 markets**
- **List:** ceil(672/100) = **7 requests**
- **Snapshots per market:** ~7–8 requests (≈7000 snapshots per 15m market, 1000 per request)
- **Total snapshot requests:** 672 × 8 ≈ **5376**
- **Total requests:** 7 + 5376 ≈ **5383**
- **Rate limit:** 2000/minute → **ceil(5383/2000) = 3 minutes** (3 rate-limit windows)

---

## Strategy (En Kısa Süre)

1. **Market listesi**  
   `GET /v1/markets?market_type=15m&limit=100&offset=0,100,...`  
   Sadece `start_time` son 7 gün içinde olanları al. ≈7 istek.

2. **Her market için tüm snapshot’lar**  
   Market listesini sırayla dolaş; her biri için:  
   `GET /v1/markets/{market_id}/snapshots?limit=1000&offset=0,1000,...`  
   Tekrar 1000’den az gelene kadar offset artır. Böylece her market tamamen biter.

3. **Pacing**  
   - **Burst:** Saniyede en fazla 100 istek → 2000 istek ≈ 20 saniyede.  
   - **Dakika:** Bir dakikada 2000 istekten sonra bir sonraki dakika penceresine kadar bekle, sonra kalan istekleri at.

4. **Kayıt**  
   Her market için ayrı dosya: `data/15m_7d_snapshots/{market_id}.json`  
   (İstersen tek büyük dosya da yapılabilir; ayrı dosya resume ve kontrol için kolay.)

---

## Tahmini Süre

- **Dakika 1:** 7 (liste) + 1993 (snapshot) = 2000 istek → ~20 saniye (burst’e uygun)
- **Dakika 2:** 2000 istek → ~20 saniye
- **Dakika 3:** 1383 istek → ~14 saniye  

**Toplam duvar saati:** ~3 dakika (rate pencereleri nedeniyle; gerçek istek süresi ~1 dakika, kalan süre bekleme).
