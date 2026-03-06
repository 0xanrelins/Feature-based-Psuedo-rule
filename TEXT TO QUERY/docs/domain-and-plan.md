# Domain + Geliştirme Planı (kısa özet)

## 1. Domain

**Backtest stratejisi tanımlama:** Kullanıcı doğal dille "hangi piyasada, hangi aralıkta, ne zaman alıp ne zaman satacağım?" tarif eder; sistem bunu yapılandırılmış modele çevirir.

**Ana kavramlar:**
- **Session (market):** Tek piyasanın ömrü (start_time → end_time; 15m, 1hr vb.).
- **Time range:** Backtest’in kapsadığı takvim aralığı (hangi session’lara bakıyoruz).
- **Token / yön:** UP veya DOWN.
- **Entry:** Ne zaman + hangi koşulla alınır.
  - Koşul: fiyat / BTC vb. (örn. price_up >= 0.90).
  - Entry window (opsiyonel): session’ın tamamı mı, sadece belli kısmı mı (örn. “session’ın son dakikasında”).
- **Exit:** Ne zaman satılır (session sonu, hemen sonraki snapshot, veya fiyat koşulu).

**Kaynaklar:** Polymarket → market/session/API; geleneksel backtest kaynakları → entry/exit, window, condition yapısı. Hazır “doğal dil → strateji modeli” kütüphanesi yok; domain modeli ve eşleme bizde.

**Polymarket referansları:** [Polymarket Docs](https://docs.polymarket.com/) (Markets & Events, Resolution, Orderbook) · [Polymarket CLI](https://github.com/Polymarket/polymarket-cli) (markets, clob price/book). Tek terim kaynağı: [docs/glossary.md](glossary.md).

---

## 2. Yapıyı bir kere kurmak

- **Tek domain modeli:** Yukarıdaki kavramlar tek yerde tanımlı; şema/slot’lar buna göre.
- **Tek glossary:** Session, time range, entry window, resolution vb. kısa tanımlar; LLM ve kurallar buna referans verir.
- **Tek eşleme kaynağı:** “last 7 days”, “in the last minute”, “price 0.90” → modele tek kural setiyle (örn. mapping-rules türevi) bağlansın; LLM prompt’u ve (varsa) rule-based aynı kaynağa göre davransın.
- **LLM rolü:** Domain + glossary’yi bilerek slot’ları doldurur; belirsizlikte “hangi kavram eksik?” diye sorar.

---

## 3. Geliştirme adımları (sıra önerisi)

1. **Glossary + domain model dokümanı** ✅  
   **[docs/glossary.md](glossary.md)** — Session, time range, entry (condition + window), exit; Polymarket terim eşlemesi; “kullanıcı ifadesi → hangi kavram” özeti.

2. **Eşleme kaynağını tekilleştirme**  
   mapping-rules (veya yeni doc) ile domain modelini eşle; “user ifadesi → domain alanı” kurallarını topla. LLM prompt’u ve rule-based bu kaynaktan beslenecek şekilde planla.

3. **Şema / slot’ları domain’e hizala**  
   Mevcut buy_triggers, sell_condition, start_time, end_time’ı domain kavramlarıyla eşle; eksikse entry_window gibi alanı modele göre ekle.

4. **LLM prompt’unu yapılandır**  
   Önce glossary + domain özeti, sonra şema, sonra eşleme kuralları (tek kaynaktan); dağınık örnek kuralları kaldır.

5. **Rule-based’i aynı kaynağa bağla**  
   Parser pattern’ları mümkün olduğunca tek eşleme dokümanından türetilebilir veya en azından onunla tutarlı olsun.

6. **Test + iterasyon**  
   Örnek kullanıcı cümleleriyle “doğal dil → domain model → backtest” akışını doğrula; eksik kavramları glossary/eşleme’ye ekle.

---

## 4. Sonraki adımlar

- **mapping-rules'ı glossary'ye göre tekilleştirmek** — User ifadesi → domain alanı; glossary kavramlarıyla aynı isimlendirme.
- **LLM prompt'a glossary özeti eklemek** — Önce kavramlar (session, time range, entry, entry window, exit), sonra şema, sonra eşleme.
- **Şema/slot'ları domain'e hizalamak** — Eksikse entry_window; start_time/end_time, buy_triggers glossary ile tutarlı.
