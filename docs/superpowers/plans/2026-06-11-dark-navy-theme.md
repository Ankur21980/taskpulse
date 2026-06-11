# Dark Navy Color Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace TaskPulse's light pastel theme with the approved dark navy palette (Color Hunt `#111844` / `#4B5694` / `#7288AE` / `#EAE0CF`) and add a subtle mesh gradient page background.

**Architecture:** All color changes flow through CSS custom properties in `frontend/src/index.css`. Six palette variables (four user anchors + two derived elevation shades) map to shadcn semantic tokens. Components already consume semantic Tailwind utilities — no `.tsx` color edits except removing one blocking `bg-background` class from `Layout.tsx`. Verification is manual visual review across three screens.

**Tech Stack:** React 19, Vite 8, Tailwind CSS v4 (`@theme inline`), shadcn/ui (base-nova), CSS custom properties

**Design spec:** `docs/superpowers/specs/2026-06-11-dark-navy-theme-design.md`

---

## File Map

| File | Responsibility |
|---|---|
| `frontend/src/index.css` | Palette variables, semantic token map, body mesh gradient |
| `frontend/src/components/Layout.tsx` | Root layout wrapper — must not paint over body gradient |

No other files need changes. Grep confirms zero hardcoded hex values in `frontend/src/**/*.tsx`.

---

### Task 1: Replace palette and semantic tokens

**Files:**
- Modify: `frontend/src/index.css:8-133`

- [ ] **Step 1: Update the palette comment and replace the `:root` block**

Replace lines 8 and 65–133 in `frontend/src/index.css` with:

```css
/* Color Hunt palette: https://colorhunt.co/palette/1118444b56947288aeeae0cf */
```

```css
:root {
  /* Anchor colors (user-specified) */
  --palette-primary-bg: #111844;
  --palette-secondary-bg: #4b5694;
  --palette-border: #7288ae;
  --palette-text: #eae0cf;

  /* Derived elevation shades */
  --palette-deep-bg: #0e1440;
  --palette-card-bg: #1a2255;

  --background: var(--palette-primary-bg);
  --foreground: var(--palette-text);

  --card: var(--palette-card-bg);
  --card-foreground: var(--palette-text);

  --popover: var(--palette-card-bg);
  --popover-foreground: var(--palette-text);

  /* CTAs — cream fill with navy label */
  --primary: var(--palette-text);
  --primary-foreground: var(--palette-primary-bg);

  --highlight: var(--palette-text);
  --highlight-foreground: var(--palette-primary-bg);

  --secondary: var(--palette-secondary-bg);
  --secondary-foreground: var(--palette-text);

  --muted: var(--palette-card-bg);
  --muted-foreground: rgba(234, 224, 207, 0.55);

  --accent: var(--palette-secondary-bg);
  --accent-foreground: var(--palette-text);

  --destructive: #c0505a;
  --destructive-foreground: var(--palette-text);

  --success: #5aaa85;
  --success-foreground: var(--palette-primary-bg);

  --warning: #c4984a;
  --warning-foreground: var(--palette-primary-bg);

  --border: var(--palette-border);
  --input: var(--palette-border);
  --ring: var(--palette-border);

  --chart-1: var(--palette-border);
  --chart-2: var(--palette-secondary-bg);
  --chart-3: var(--palette-text);
  --chart-4: #5aaa85;
  --chart-5: #c4984a;

  --radius: 0.625rem;

  --sidebar: var(--palette-deep-bg);
  --sidebar-foreground: var(--palette-text);
  --sidebar-primary: var(--palette-text);
  --sidebar-primary-foreground: var(--palette-primary-bg);
  --sidebar-accent: var(--palette-secondary-bg);
  --sidebar-accent-foreground: var(--palette-text);
  --sidebar-border: var(--palette-border);
  --sidebar-ring: var(--palette-border);
}
```

Leave the `@theme inline { ... }` block (lines 9–63) unchanged — it already maps semantic tokens to Tailwind color utilities.

- [ ] **Step 2: Verify dev server picks up changes**

Run (from `frontend/`):

```bash
npm run dev
```

Open `http://localhost:5173`. Expected: dark navy page background, cream text, cream CTA buttons, blue-gray borders. Gradient is not visible yet (Task 2).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: apply dark navy color palette tokens"
```

---

### Task 2: Add mesh gradient background on body

**Files:**
- Modify: `frontend/src/index.css:135-151`

- [ ] **Step 1: Replace the `body` rule inside `@layer base`**

Change the existing `body` block from:

```css
  body {
    @apply bg-background text-foreground antialiased;
  }
```

To:

```css
  body {
    @apply text-foreground antialiased;
    background-color: var(--background);
    background-image:
      radial-gradient(ellipse 80% 60% at 85% 10%, rgba(75, 86, 148, 0.35) 0%, transparent 60%),
      radial-gradient(ellipse 60% 50% at 10% 90%, rgba(114, 136, 174, 0.15) 0%, transparent 55%);
    background-attachment: fixed;
  }
```

Do not change the `*`, `html`, or `h1–h4` rules.

- [ ] **Step 2: Verify gradient is visible**

Refresh `http://localhost:5173`. Expected: subtle purple glow top-right and faint blue glow bottom-left over the navy base. Scroll the page — gradient stays fixed (does not scroll with content).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: add mesh gradient page background"
```

---

### Task 3: Expose body gradient through layout wrapper

**Files:**
- Modify: `frontend/src/components/Layout.tsx:19`

- [ ] **Step 1: Remove `bg-background` from root div**

Change line 19 from:

```tsx
    <div className="min-h-screen bg-background">
```

To:

```tsx
    <div className="min-h-screen">
```

The header (`bg-card`) and main content areas keep their own backgrounds. Only the page canvas behind them should show the body gradient.

- [ ] **Step 2: Verify gradient shows in content margins**

Refresh all three routes:
- `http://localhost:5173/` (Upload)
- `http://localhost:5173/review` (Review Board)
- `http://localhost:5173/my-tasks` (My Tasks)

Expected: mesh gradient visible in areas not covered by header or cards (page margins, space between sections).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Layout.tsx
git commit -m "fix: let body mesh gradient show through layout wrapper"
```

---

### Task 4: Visual verification across all screens

**Files:**
- Verify only (no code changes unless Step 6 adjustment is needed)

- [ ] **Step 1: Confirm no hardcoded colors in components**

Run from repo root:

```bash
rg '#[0-9a-fA-F]{3,8}' frontend/src --glob '*.tsx'
```

Expected: no matches.

- [ ] **Step 2: Upload page checklist**

Navigate to `/`. Verify:

| Element | Expected |
|---|---|
| Page background | Navy with subtle mesh gradient |
| "TaskPulse" heading | Cream (`#EAE0CF`) |
| Header bar | Dark card surface (`#1a2255`), border `#7288AE` |
| Active nav pill | Cream background, navy text |
| Inactive nav links | Subdued cream (~55% opacity) |
| "Extract Tasks" button | Cream fill, navy label |
| Textarea / file drop zone | Navy inset inside card, blue-gray border |
| Focus ring on inputs | `#7288AE` |

- [ ] **Step 3: Review Board checklist**

Navigate to `/review`. Open the history sidebar if available. Verify:

| Element | Expected |
|---|---|
| Task cards | `#1a2255` surface, `#7288AE` border |
| Assignee dropdown | Matches card/input styling |
| Sidebar (if open) | `#0e1440` background — darker than page |
| Sidebar active item | Cream highlight |
| Secondary / ghost buttons | Blue (`#4B5694`) or bordered, readable cream text |

- [ ] **Step 4: My Tasks checklist**

Navigate to `/my-tasks`. Verify:

| Element | Expected |
|---|---|
| Tab bar | Inactive tabs subdued cream |
| Active tab | Cream text on card/secondary surface |
| Task list items | Card elevation visible against gradient page |

- [ ] **Step 5: Trigger success toast (if possible)**

Complete an assign action or any flow that shows the toast in `Layout.tsx`. Verify:

- Toast background: teal tint (`bg-success/20`)
- Toast border: `border-success/40`
- Text readable on dark navy

- [ ] **Step 6: Adjust muted text contrast only if needed**

If placeholder or inactive nav text is too faint, update one line in `frontend/src/index.css`:

```css
  --muted-foreground: rgba(234, 224, 207, 0.65);
```

Re-check Upload and Review Board inactive states. Skip this step if 55% opacity is readable.

If changed, commit:

```bash
git add frontend/src/index.css
git commit -m "fix: increase muted text contrast on dark navy theme"
```

---

### Task 5: Build verification

**Files:**
- Verify only

- [ ] **Step 1: Run production build**

Run from `frontend/`:

```bash
npm run build
```

Expected: exit code 0, no CSS or TypeScript errors.

- [ ] **Step 2: Final commit (only if uncommitted fixes remain)**

```bash
git status
```

If working tree is clean, no action needed.

---

## Spec Coverage Checklist

| Spec requirement | Task |
|---|---|
| Four anchor colors | Task 1 |
| Two derived elevation shades | Task 1 |
| Semantic token map (all tokens) | Task 1 |
| Status colors (destructive/success/warning) | Task 1 |
| Chart color tokens | Task 1 |
| Mesh gradient on body | Task 2 |
| Remove `bg-background` from Layout | Task 3 |
| No dark mode block | N/A — intentionally skipped |
| Manual screen verification | Task 4 |
| Muted contrast adjustment | Task 4 Step 6 (conditional) |
| Out of scope items untouched | No tasks reference them |

## Success Criteria

- App uses `#111844`, `#4B5694`, `#7288AE`, `#EAE0CF` as the four anchor colors
- Cards/header elevated via `#1a2255` / `#0e1440`
- CTAs are cream with navy text
- Pages show subtle mesh gradient, not flat navy
- All three screens pass visual checklist
- `npm run build` succeeds
