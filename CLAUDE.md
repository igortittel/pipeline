# Product Pipeline — CLAUDE.md

## Čo je tento projekt
Kanban-style task management app pre interné tímy. Tmavý UI, real-time sync cez Supabase, drag & drop reorder, file attachments, komentáre, notifikácie.

## Stack
- **React 19** + **TypeScript 6** + **Vite 8**
- **Tailwind CSS 4** (bez config súboru — inline v `index.css` cez `@import "tailwindcss"`)
- **Framer Motion** — animácie (drawer, greeting overlay, notifikácie)
- **dnd-kit** (`@dnd-kit/core`, `sortable`, `utilities`) — drag & drop reorder taskov
- **Supabase JS v2** — databáza + real-time + file storage
- **canvas-confetti** — konfety pri presune tasku do "Hotovo"
- **lucide-react** — ikony

## Súborová štruktúra
```
src/
├── App.tsx               # Root: auth gate, greeting overlay, notification detection
├── store.ts              # SINGLE SOURCE OF STATE — useAppStore() hook
├── types.ts              # Všetky TypeScript typy
├── lib/supabase.ts       # Supabase client (env vars)
├── index.css             # Tailwind + globálne štýly
└── components/
    ├── Auth.tsx           # Password auth, useAuth hook, PASSWORD_KEY
    ├── Sidebar.tsx        # Pipeline list, CRUD pipeline
    ├── PipelineView.tsx   # Kanban board (4 stĺpce), drag & drop
    ├── TaskCard.tsx       # Karta tasku v board
    ├── TaskDrawer.tsx     # Right-side drawer: detail tasku, komentáre, súbory
    └── NotificationCenter.tsx  # Bell ikona + zoznam notifikácií
```

## Databáza (Supabase)
### Tabuľky
| Tabuľka | Kľúčové stĺpce |
|---|---|
| `pipelines` | `id`, `name`, `created_at` |
| `tasks` | `id`, `pipeline_id`, `title`, `description`, `status`, `priority`, `order_index`, `assignee`, `deadline`, `asset_links[]`, `created_at`, `completed_at`, `archived` |
| `comments` | `id`, `task_id`, `author`, `body`, `created_at` |
| `task_files` | `id`, `task_id`, `name`, `url`, `size`, `created_at` |

### Storage bucket
- `task-attachments` — file prílohy k taskom
- Path pattern: `{taskId}/{uuid}.{ext}`

### Real-time
Supabase `postgres_changes` subscription na všetky 4 tabuľky → debounce 150ms → `fetchAll()`

## Typy a konštanty (types.ts)
```ts
type Status   = 'Nový' | 'Pracujem na tom' | 'Na kontrole' | 'Hotovo'
type Priority = 'low' | 'medium' | 'high'
```
Kanban stĺpce = 4 hodnoty Status, v tomto poradí.

### Status mapping (DB → UI)
Staré hodnoty z DB sa automaticky normalizujú:
- `backlog`, `todo` → `Nový`
- `in-progress` → `Pracujem na tom`
- `review` → `Na kontrole`
- `done` → `Hotovo`

## store.ts — useAppStore()
**Jediný zdroj pravdy.** Všetky mutácie = optimistic update v `setState` + async Supabase zápis.

### Kľúčové správanie
- **Auto-archive**: tasky v stave `Hotovo` sa automaticky archivujú po 3 dňoch od `completed_at`
- **completedAt**: nastavuje sa automaticky pri `updateTask` keď `status === 'Hotovo'`
- **order**: `order_index` v DB, pri reorder sa updatujú všetky tasky v pipeline naraz
- **Active pipeline**: ukladá sa do `localStorage` pod kľúčom `pp-active-pipeline`

### Dostupné akcie
```ts
createPipeline(name)
renamePipeline(id, name)
deletePipeline(id)
createTask(title, pipelineId)
updateTask(taskId, patch, pipelineId)   // patch = Partial<Task>
deleteTask(taskId, pipelineId)
archiveTask(taskId, pipelineId)
reorderTasks(orderedIds[], pipelineId)
addComment(taskId, author, body, pipelineId)
uploadFile(taskId, file, pipelineId)
deleteFile(taskId, fileId, fileUrl, pipelineId)
```

## Auth (Auth.tsx)
- Jednoduchá password auth — heslo uložené v `localStorage` pod `PASSWORD_KEY`
- `useAuth()` hook vracia boolean (je prihlásený?)
- Po prihlásení sa zobrazí `GreetingOverlay` s náhodnou hláškou (3s, dismissible)
- Greeting správy sú v `App.tsx` v poli `GREETINGS`

## Notifikácie (App.tsx — detectNotifications)
Generujú sa pri každej zmene `store.state.pipelines`:
- **Status change**: `prevTask.status !== task.status`
- **Nový komentár**: `task.comments.length > prevTask.comments.length`
- **Deadline**: pri initial load — ak deadline je dnes alebo zajtra
- Max 50 notifikácií v pamäti (slice)

## UI / Design systém
- **Bg**: `#0f0f0f` (app), `#0a0a0a` (sidebar), `#161616` (karty)
- **Borders**: `#1e1e1e` (jemné), `#2a2a2a` (karty), `#3a3a3a` (hover)
- **Text**: `white` (primary), `#888` (secondary), `#555` (muted)
- **Tmavý design** — žiadne shadcn/ui, žiadne svetlé témy
- Tailwind 4 — utility-first, `@apply` minimálne

## ENV premenné (src/.env)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Príkazy
```bash
npm run dev      # dev server
npm run build    # production build (tsc + vite)
npm run lint     # ESLint
```

## Časté úpravy a kde ich nájsť
| Čo chceš zmeniť | Kde |
|---|---|
| Pridať nový stĺpec (Status) | `types.ts` → `Status` typ + `PipelineView.tsx` |
| Zmeniť greeting správy | `App.tsx` → `GREETINGS[]` |
| Zmeniť dobu auto-archive | `store.ts` → `THREE_DAYS_MS` |
| Pridať pole k tasku | `types.ts` → `Task`, `store.ts` → `updateTask` dbPatch, `TaskDrawer.tsx` |
| Zmeniť farby UI | Priamo v komponentoch (inline Tailwind) |
| Pridať nový typ notifikácie | `types.ts` → `Notification.type`, `App.tsx` → `detectNotifications` |
