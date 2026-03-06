# Strategy Demystify - Geliştirme Planı

## 1. Mevcut Durum Analizi

### Var Olanlar
- Next.js 15 + React 19 + Tailwind CSS v4
- StrategyInput (chat input + RUN button)
- OutputPanel (basit output alanı)
- StrategyTable (sabit strateji listesi)
- Dark theme with orange accents

### Eksikler
- Chat history yönetimi yok
- AI agent entegrasyonu yok (mock)
- Interactive chat list yok
- Expand/collapse özelliği yok
- Dynamic sorting yok

---

## 2. Hedef Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Strategy Demystify                        │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│   ┌──────────────────┐   │   ┌──────────────────────────┐    │
│   │  Chat Input      │   │   │    Chat List            │    │
│   │  [textarea]      │   │   │    (Sorted by Total)     │    │
│   │  [RUN button]    │   │   │                          │    │
│   └──────────────────┘   │   │   ┌────────────────────┐   │    │
│                          │   │   │ Chat Item #1      │   │    │
│   ┌──────────────────┐   │   │   │ Q: Buy the dip... │   │    │
│   │  Chat Output     │   │   │   │ Total: 87 [▼]     │   │    │
│   │                  │   │   │   └────────────────────┘   │    │
│   │  ┌────────────┐  │   │   │   ┌────────────────────┐   │    │
│   │  │ AI Response│  │   │   │   │ Chat Item #2      │   │    │
│   │  │ + Scores   │  │   │   │   │ Q: Low risk...    │   │    │
│   │  └────────────┘  │   │   │   │ Total: 59 [▼]     │   │    │
│   │                  │   │   │   └────────────────────┘   │    │
│   └──────────────────┘   │   │                            │    │
│                          │   └──────────────────────────┘    │
└──────────────────────────┴──────────────────────────────────┘
```

---

## 3. Veri Yapıları (Interfaces)

### ChatMessage
```typescript
interface ChatMessage {
  id: string;                    // unique id (timestamp-based)
  question: string;              // user input
  answer: string;                // AI response
  scores: ScoreBreakdown;        // scoring framework
  timestamp: number;             // created at
  isExpanded: boolean;          // UI state
}

interface ScoreBreakdown {
  pt: number;      // Profit Target
  pro: number;     // Probability
  sr: number;      // Strike Rate
  card: number;    // Card (Risk/Reward)
  ae: number;      // Average Expectancy
  total: number;   // Weighted Total
}
```

### ChatList State
```typescript
const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
const [currentChat, setCurrentChat] = useState<ChatMessage | null>(null);
```

---

## 4. Bileşen Değişiklikleri

### A. StrategyInput (Güncelleme - Hafif)
- Props: `onSubmit: (question: string) => void`
- Loading state ekle (isAnalyzing)
- Aynı textarea + RUN button

### B. OutputPanel → ChatOutput (Yeniden Adlandır + Güncelle)
- Props: `chat: ChatMessage | null`
- AI response formatter:
  - Başlık: "Strategy Analysis"
  - Skor tablosu (PT, PRO, SR, CARD, AE, TOTAL)
  - Yorum/öneri metni
  - Zaman damgası
- Empty state: "Ask a question to get started"

### C. StrategyTable → ChatList (Yeniden Tasarla)
- Props: `chats: ChatMessage[], onToggleExpand: (id: string)`
- **Sort**: TOTAL'a göre desc (yüksekten düşüğe)
- **List Item UI**:
  ```
  ┌─────────────────────────────────────────┐
  │ Q: "Buy the dip..."           Total: 87 │
  │ Asked: 2 min ago                [▼]     │
  ├─────────────────────────────────────────┤
  │ [Expanded Content]                      │
  │ Full question + answer preview          │
  │ PT: 3.5 | PRO: 35% | SR: 1.0            │
  └─────────────────────────────────────────┘
  ```
- Expand/Collapse animasyonu
- Max height ile scrollable içerik
- Click anywhere to toggle
- Active/focus state styling

---

## 5. AI Mock Service

### mockAIResponse(question: string): Promise<ChatMessage>

```typescript
// Gerçek API yerine mock data döner
// Her soru için benzersiz ama tutarlı skorlar üretir
// Basit hash-based logic

const mockAIResponse = async (question: string): Promise<ChatMessage> => {
  // 1.5s delay (simulated network)
  // Generate deterministic scores based on question length/content
  // Return formatted response
}
```

### Yanıt Formatı (Markdown)
```markdown
## Strategy Analysis

**Overall Score: 87/100** ⭐

### Score Breakdown
| Metric | Value | Rating |
|--------|-------|--------|
| PT (Profit Target) | 3.5% | Good |
| PRO (Probability) | 35% | Moderate |
| SR (Strike Rate) | 1.0 | Excellent |
| CARD | 22 | Low Risk |
| AE (Avg Expectancy) | 35% | Strong |

### Recommendation
This strategy shows strong potential with a high strike rate and 
excellent average expectancy. Consider position sizing at 2-3% risk.
```

---

## 6. UI/UX Detayları

### Renk Kodlaması (Skorlara Göre)
- **90-100**: Excellent (Green) 🟢
- **70-89**: Good (Light Green) 
- **50-69**: Moderate (Yellow) 🟡
- **30-49**: Weak (Orange) 🟠
- **0-29**: Poor (Red) 🔴

### Animasyonlar
- List expand: 200ms ease-out
- New item: Slide in from top
- Sort change: 300ms transition
- Loading: Pulse animation on RUN button

### Boş Durumlar
- Chat List boş: "No analyzed strategies yet. Ask your first question!"
- Output boş: Terminal prompt style "➜ Waiting for input..."

---

## 7. Adım Adım Implementasyon

### Phase 1: Veri Yapısı & State (30 dk)
1. [ ] TypeScript interfaces tanımla (ChatMessage, ScoreBreakdown)
2. [ ] Mock AI service oluştur
3. [ ] Page.tsx state yapısını güncelle

### Phase 2: ChatOutput Bileşeni (45 dk)
1. [ ] OutputPanel → ChatOutput rename
2. [ ] AI yanıt formatter'ı yaz
3. [ ] Markdown-to-JSX rendering (basit)
4. [ ] Skor tablosu component'i

### Phase 3: ChatList Bileşeni (60 dk)
1. [ ] StrategyTable → ChatList rename
2. [ ] Sort logic (by total score)
3. [ ] Expand/Collapse mekanizması
4. [ ] List item UI redesign
5. [ ] Empty state ekle

### Phase 4: Input & Integration (30 dk)
1. [ ] StrategyInput loading state
2. [ ] onSubmit handler bağla
3. [ ] Yeni chat ekleme flow'u
4. [ ] Auto-sort trigger'ları

### Phase 5: Polish (30 dk)
1. [ ] Animasyonlar (Tailwind transitions)
2. [ ] Responsive adjustments
3. [ ] Color coding implementasyonu
4. [ ] Test & debug

**Toplam Tahmini Süre: ~3 saat**

---

## 8. Dosya Yapısı (Hedef)

```
app/
├── components/
│   ├── ChatInput.tsx         (renamed from StrategyInput)
│   ├── ChatOutput.tsx        (renamed from OutputPanel)
│   ├── ChatList.tsx          (renamed from StrategyTable)
│   ├── ScoreTable.tsx        (new - skor tablosu)
│   └── ChatListItem.tsx      (new - list item component)
├── services/
│   └── mockAI.ts             (new - mock AI service)
├── types/
│   └── index.ts              (new - TypeScript interfaces)
├── page.tsx                  (updated)
├── layout.tsx
└── globals.css
```

---

## 9. Örnek Kullanıcı Akışı

1. User "Buy the dip strategy?" yazar → RUN
2. Loading state (1.5s)
3. AI response gelir → ChatOutput'ta göster
4. Chat otomatik ChatList'e eklenir
5. ChatList TOTAL'a göre sıralanır
6. Yeni item #1 sıraya yerleşir
7. User ChatList'teki item #2'ye tıklar
8. Item expands, detaylar görünür
9. User başka soru sorar
10. Süreç tekrarlanır, list büyür

---

## 10. Teknik Notlar

- **Sorting**: Array.sort() ile her eklemede yeniden sırala
- **ID Generation**: `Date.now()` + `Math.random()` hex string
- **Storage**: Şimdilik sadece state (localStorage sonraki phase)
- **Mock AI**: Basit hash function ile deterministic scores
- **Performance**: max 100 chat item (eski silinir)

---

## Onay Bekleniyor

Bu planı onayladıktan sonra **Phase 1** ile başlayacağım.
Her phase tamamlandığında kontrol etmenizi isteyeceğim.

Değiştirmek istediğiniz yer var mı?
