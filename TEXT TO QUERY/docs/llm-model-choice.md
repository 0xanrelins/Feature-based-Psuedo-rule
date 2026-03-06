# LLM model seçimi — Backtest parsing

Bu projede doğal dil → yapılandırılmış strateji (ParsedQuery) dönüşümü **OpenRouter** üzerinden bir LLM ile yapılıyor. Şu an **Claude Sonnet 4.6** (`anthropic/claude-sonnet-4.6`) kullanılıyor. Perplexity modelleri bu iş için avantaj sağlar mı, kısa özet aşağıda.

---

## Mevcut kullanım

- **Görev:** Kullanıcı cümlesi + definments + glossary/mapping → **tek bir JSON** (action, market_type, buy_triggers, sell_condition, exit_on_pct_move, vb.).
- **Bağlam:** Sadece verdiğimiz metin (definments, “Today’s date”, user message). **Web araması yok.**
- **Çıktı:** Şemaya uygun, tutarlı slot doldurma; belirsizse `clarification_needed`.

Yani ihtiyacımız: **sınırlı bağlam + talimatları takip + yapılandırılmış çıktı**. Mikro geliştirme hızı büyük ölçüde **prompt/glossary/mapping** kalitesine ve modelin talimat/şema uyumuna bağlı.

---

## OpenRouter’da Perplexity modelleri (özet)

[OpenRouter – Perplexity](https://openrouter.ai/perplexity) sayfasındaki modeller kabaca şöyle:

| Model | Özellik | Fiyat (kabaca) | Bu proje için |
|--------|----------|----------------|----------------|
| **Sonar** | Hafif, hızlı, citation; web search opsiyonel | $1/M input, $1/M output | Düşük maliyet denemesi için uygun |
| **Sonar Pro** | Daha derin sorgular, daha fazla citation, büyük context | $3/M input, $15/M output + search maliyeti | Parsing için gereksiz pahalı |
| **Sonar Pro Search** | Çok adımlı arama + reasoning | $3/M input, $15/M output + **$18/1k request** | Arama odaklı; parsing için fazla |
| **Sonar Reasoning / Deep Research** | Çok adımlı araştırma, çok sayıda search | Ek search + reasoning ücreti | Araştırma raporu için; slot doldurma için değil |

Perplexity’nin güçlü yanı: **web’de arama yapıp güncel kaynaklarla cevap ve citation üretmek**. Bizim görevimiz ise **sabit domain (glossary + mapping)** ile slot doldurmak; dış dünyaya sormuyoruz.

---

## Perplexity, mikro geliştirme ve sistem geliştirme

- **Mikro geliştirme:** Her yeni ifade (“sell after 0.2% move”, “moves opposite side”) için önce **glossary + mapping-rules + LLM prompt’u** güncelleniyor. Burada asıl kazanç: dokümanların net olması ve modelin talimat/şemaya uyması. **Hangi model** kullandığınızdan çok **ne yazdığınız** (tek kaynak, tutarlı terimler) önemli.
- **Perplexity’ye geçmek** bu slot-filling görevini doğal olarak “daha kolay” yapmaz; çünkü:
  - Web araması kullanmıyoruz → Sonar Pro Search / Deep Research’ün artısı kullanılmaz.
  - Citation’a ihtiyacımız yok → Perplexity’nin o tarafı fazladan ödeme anlamına gelir (özellikle Pro/Search modellerde).
- **Avantaj sağlayabilecek senaryo:** İleride “stratejiyi web’de araştır”, “benzer stratejileri bul”, “analist yorumlarını özetle” gibi **dış bağlam + arama** eklenirse, o zaman **Perplexity (Sonar Pro / Sonar Pro Search)** anlamlı olur. Şu anki “text → ParsedQuery” pipeline’ı için zorunlu değil.

**Özet:** Sadece backtest strategy domain parsing için Perplexity’ye geçmek, sistem geliştirmeyi veya mikro geliştirmeyi tek başına kolaylaştırmaz. Asıl kaldıraç: glossary, mapping-rules ve prompt’un tek referans olarak sıkı tutulması.

---

## Ne zaman hangi model?

| Amaç | Öneri |
|------|--------|
| **Şu anki parsing (text → JSON slots)** | **Claude Sonnet 4.6** ile devam mantıklı; talimat ve yapılandırılmış çıktıda güçlü. |
| **Maliyet / hız denemesi** | **Perplexity Sonar** (`perplexity/sonar`) deneyebilirsin; OpenRouter üzerinden aynı API, sadece `OPENROUTER_MODEL` değişir. |
| **İleride “web’den strateji/piyasa bilgisi getir”** | O zaman **Sonar Pro** veya **Sonar Pro Search** ek bir katman olarak değerlendirilebilir. |

---

## Hızlı deneme: Perplexity Sonar

Aynı kod ve API; sadece ortam değişkeni:

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=perplexity/sonar
```

OpenRouter’daki güncel model listesi ve fiyatlar: [OpenRouter – Perplexity](https://openrouter.ai/perplexity).  
Sonar: hafif, ucuz, hızlı; slot-filling için yeterli olabilir. Tutarlılığı birkaç örnek cümleyle (entry window, exit on % move, opposite side vb.) test etmek faydalı olur.

---

## Kısa cevap

- **“Perplexity kullansak mikro geliştirme / sistem geliştirme daha mı kolay olur?”**  
  Bu projedeki **mevcut görev** (backtest strategy parsing, web yok) için **hayır**; kolaylaştırıcı ek avantaj bekleme. Avantaj, glossary + mapping + prompt’u tek kaynak yapmakta.
- **“Perplexity’yi ne zaman kullanalım?”**  
  İleride **web araması / dış kaynak / citation** istersen (ör. “bu stratejiye benzer ne var?”, “son hafta BTC yorumları”) Perplexity modelleri (Sonar Pro / Sonar Pro Search) o aşamada mantıklı ek bir seçenek olur.
