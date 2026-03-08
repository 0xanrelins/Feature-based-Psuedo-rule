# Strategy Demystify - Development plan

## 1. Current state

### What exists
- Next.js 15 + React 19 + Tailwind CSS v4
- StrategyInput (chat input + RUN button)
- OutputPanel (simple output area)
- StrategyTable (sabit strateji listesi)
- Dark theme with orange accents

### Missing
- No chat history management
- No AI agent integration (mock)
- No interactive chat list
- No expand/collapse
- No dynamic sorting

---

## 2. Target architecture

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

## 3. Data structures (interfaces)

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

## 4. Component changes

### A. StrategyInput (light update)
- Props: `onSubmit: (question: string) => void`
- Add loading state (isAnalyzing)
- Same textarea + RUN button

### B. OutputPanel → ChatOutput (rename + update)
- Props: `chat: ChatMessage | null`
- AI response formatter:
  - Title: "Strategy Analysis"
  - Score table (PT, PRO, SR, CARD, AE, TOTAL)
  - Comment/recommendation text
  - Timestamp
- Empty state: "Ask a question to get started"

### C. StrategyTable → ChatList (redesign)
- Props: `chats: ChatMessage[], onToggleExpand: (id: string)`
- **Sort**: by TOTAL desc (high to low)
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
- Expand/Collapse animation
- Scrollable content with max height
- Click anywhere to toggle
- Active/focus state styling

---

## 5. AI Mock Service

### mockAIResponse(question: string): Promise<ChatMessage>

```typescript
// Returns mock data instead of real API
// Produces unique but consistent scores per question
// Basit hash-based logic

const mockAIResponse = async (question: string): Promise<ChatMessage> => {
  // 1.5s delay (simulated network)
  // Generate deterministic scores based on question length/content
  // Return formatted response
}
```

### Response format (Markdown)
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

### Color coding (by score)
- **90-100**: Excellent (Green) 🟢
- **70-89**: Good (Light Green) 
- **50-69**: Moderate (Yellow) 🟡
- **30-49**: Weak (Orange) 🟠
- **0-29**: Poor (Red) 🔴

### Animations
- List expand: 200ms ease-out
- New item: Slide in from top
- Sort change: 300ms transition
- Loading: Pulse animation on RUN button

### Empty states
- Chat list empty: "No analyzed strategies yet. Ask your first question!"
- Output empty: Terminal prompt style "➜ Waiting for input..."

---

## 7. Step-by-step implementation

### Phase 1: Data structure & state (30 min)
1. [ ] Define TypeScript interfaces (ChatMessage, ScoreBreakdown)
2. [ ] Create mock AI service
3. [ ] Update Page.tsx state structure

### Phase 2: ChatOutput component (45 min)
1. [ ] OutputPanel → ChatOutput rename
2. [ ] Write AI response formatter
3. [ ] Markdown-to-JSX rendering (simple)
4. [ ] Score table component

### Phase 3: ChatList component (60 min)
1. [ ] StrategyTable → ChatList rename
2. [ ] Sort logic (by total score)
3. [ ] Expand/Collapse mechanism
4. [ ] List item UI redesign
5. [ ] Add empty state

### Phase 4: Input & integration (30 min)
1. [ ] StrategyInput loading state
2. [ ] Wire onSubmit handler
3. [ ] New chat add flow
4. [ ] Auto-sort triggers

### Phase 5: Polish (30 min)
1. [ ] Animasyonlar (Tailwind transitions)
2. [ ] Responsive adjustments
3. [ ] Color coding implementasyonu
4. [ ] Test & debug

**Total estimated time: ~3 hours**

---

## 8. Target file structure

```
app/
├── components/
│   ├── ChatInput.tsx         (renamed from StrategyInput)
│   ├── ChatOutput.tsx        (renamed from OutputPanel)
│   ├── ChatList.tsx          (renamed from StrategyTable)
│   ├── ScoreTable.tsx        (new - skor tablosu)
│   └── ChatListItem.tsx      (new - list item)
├── services/
│   └── mockAI.ts             (new - mock AI)
├── types/
│   └── index.ts              (new - interfaces)
├── page.tsx                  (updated)
├── layout.tsx
└── globals.css
```

---

## 9. Example user flow

1. User types "Buy the dip strategy?" → RUN
2. Loading state (1.5s)
3. AI response arrives → shown in ChatOutput
4. Chat is added to ChatList automatically
5. ChatList sorted by TOTAL
6. New item goes to #1
7. User clicks item #2 in ChatList
8. Item expands, details visible
9. User asks another question
10. Process repeats, list grows

---

## 10. Teknik Notlar

- **Sorting**: Re-sort on each add with Array.sort()
- **ID generation**: `Date.now()` + `Math.random()` hex string
- **Storage**: State only for now (localStorage in next phase)
- **Mock AI**: Deterministic scores via simple hash
- **Performance**: max 100 chat items (old ones removed)

---

## Pending approval

After you approve this plan I'll start with **Phase 1**.
I'll ask you to check after each phase is done.

Anything you want to change?
