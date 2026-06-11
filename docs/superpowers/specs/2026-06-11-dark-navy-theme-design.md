# Dark Navy Color Theme — Design Spec

**Date:** 2026-06-11  
**Status:** Approved for planning  
**Source:** [Color Hunt palette](https://colorhunt.co/palette/1118444b56947288aeeae0cf)  
**Approach:** B — Derived shade palette with mesh gradient background

## Goal

Replace TaskPulse's current light pastel theme with a dark navy palette anchored on four user-specified colors. All text, highlights, and CTAs use cream (`#EAE0CF`). Pages gain subtle depth via a CSS mesh gradient — no image assets.

## Anchor Colors (User-Specified)

| Role | Hex |
|---|---|
| Primary background (pages) | `#111844` |
| Secondary background | `#4B5694` |
| Borders / dividers / focus rings | `#7288AE` |
| Text / highlights / CTAs | `#EAE0CF` |

## Derived Palette (Elevation Only)

Two intermediate tones support surface hierarchy without introducing new brand colors:

| Variable | Hex | Role |
|---|---|---|
| `--palette-deep-bg` | `#0e1440` | Sidebar, modal scrims — slightly darker than page |
| `--palette-card-bg` | `#1a2255` | Cards, panels, inputs — between primary and secondary |

## Semantic Token Map

All tokens live in `frontend/src/index.css` under `:root`. Components consume semantic tokens via Tailwind utilities (`bg-background`, `text-foreground`, etc.) — no component-level color changes expected.

| Token | Value | Notes |
|---|---|---|
| `--background` | `primary-bg` (`#111844`) | Page canvas |
| `--foreground` | `text` (`#EAE0CF`) | Body copy |
| `--card` / `--popover` | `card-bg` (`#1a2255`) | Elevated surfaces |
| `--card-foreground` | `text` | |
| `--primary` | `text` (`#EAE0CF`) | CTA buttons — cream fill |
| `--primary-foreground` | `primary-bg` (`#111844`) | Label text inside CTAs |
| `--secondary` | `secondary-bg` (`#4B5694`) | Secondary buttons |
| `--secondary-foreground` | `text` | |
| `--muted` | `card-bg` | Disabled / subdued backgrounds |
| `--muted-foreground` | `rgba(234,224,207,0.55)` | Placeholders, meta text |
| `--accent` | `secondary-bg` | Hover states, active highlights |
| `--accent-foreground` | `text` | |
| `--border` / `--input` / `--ring` | `border` (`#7288AE`) | All edges and focus indicators |
| `--highlight` | `text` | `h1–h4` headings |
| `--highlight-foreground` | `primary-bg` | |
| `--sidebar` | `deep-bg` (`#0e1440`) | Sidebar background |
| `--sidebar-primary` | `text` | Active nav item |
| `--sidebar-primary-foreground` | `primary-bg` | |
| `--sidebar-accent` | `secondary-bg` | Sidebar hover |
| `--sidebar-accent-foreground` | `text` | |
| `--sidebar-border` | `border` | |

### Status Colors (On-Brand Derivatives)

Status colors cannot come from the four anchor colors. Use muted tones that read clearly on dark navy:

| Token | Hex | Use |
|---|---|---|
| `--destructive` | `#c0505a` | Errors, delete actions |
| `--destructive-foreground` | `#EAE0CF` | |
| `--success` | `#5aaa85` | Success toasts, confirmations |
| `--success-foreground` | `#111844` | |
| `--warning` | `#c4984a` | Warnings |
| `--warning-foreground` | `#111844` | |

### Chart Colors

Reuse palette anchors and status derivatives for any chart usage:

| Token | Value |
|---|---|
| `--chart-1` | `#7288AE` (border blue) |
| `--chart-2` | `#4B5694` (secondary bg) |
| `--chart-3` | `#EAE0CF` (text/cream) |
| `--chart-4` | `#5aaa85` (success) |
| `--chart-5` | `#c4984a` (warning) |

## Subtle Page Background

Apply a fixed mesh gradient on `body` (via `@layer base` in `index.css`):

```css
background-color: var(--background);
background-image:
  radial-gradient(ellipse 80% 60% at 85% 10%, rgba(75, 86, 148, 0.35) 0%, transparent 60%),
  radial-gradient(ellipse 60% 50% at 10% 90%, rgba(114, 136, 174, 0.15) 0%, transparent 55%);
background-attachment: fixed;
```

- Top-right glow uses `secondary-bg` at 35% opacity
- Bottom-left glow uses `border` at 15% opacity
- `background-attachment: fixed` keeps the gradient stable during scroll
- No texture images or external assets

`Layout.tsx` currently sets `bg-background` on the root wrapper. Remove that class so the body gradient is visible; keep `min-h-screen` for layout height.

## Component Impact

| Area | Change |
|---|---|
| `index.css` | Replace palette variables, semantic tokens, add body gradient |
| `Layout.tsx` | Remove `bg-background` from root `div` (one-line change) |
| shadcn UI components | None — they already use semantic tokens |
| Page components | None — no hardcoded hex values in `.tsx` files |

### Expected Visual Behavior

- **Header** (`bg-card`): sits on `#1a2255`, clearly elevated above the gradient page
- **Active nav** (`bg-primary text-primary-foreground`): cream pill with navy label
- **Inactive nav** (`text-muted-foreground`): subdued cream at 55%
- **Task cards** (`bg-card border-border`): card surface with blue-gray borders
- **CTA buttons** (`variant="default"`): cream background, navy text
- **Secondary buttons** (`variant="secondary"`): `#4B5694` background, cream text
- **Inputs** (`border-input bg-background`): navy page bg inside card contexts; border `#7288AE`
- **Focus rings** (`ring-ring`): `#7288AE` — visible on all surfaces
- **Success toast** (`bg-success/20 border-success/40`): teal tint on navy

## Dark Mode

No `.dark` theme block is added. This palette is inherently dark. The existing `@custom-variant dark` stub remains untouched.

## Out of Scope

- Dark/light mode toggle
- Per-page custom backgrounds
- Logo or favicon color updates
- Chart component implementation (tokens are set for future use)
- `App.css` cleanup (legacy Vite scaffold, unused by app)

## Error Handling & Edge Cases

| Concern | Mitigation |
|---|---|
| Low contrast on muted text | `muted-foreground` at 55% opacity — verify WCAG AA on `#111844` and `#1a2255`; bump to 65% if needed during implementation |
| CTA cream on cream | `primary` is cream; `secondary` is blue — visually distinct; ghost/outline buttons use border token |
| Input fields on card vs page | Inputs inherit `bg-background` (navy); on cards this creates inset effect — acceptable; switch to `bg-card` on inputs only if contrast is poor |
| Gradient on short pages | `min-h-screen` on layout ensures gradient covers viewport |
| `dark:` variants in shadcn tabs | Existing `dark:data-active:*` rules are inert without `.dark` class — no action needed |

## Testing & Verification

Manual visual check on all three screens after implementation:

1. **Upload** — paste area, file drop zone, primary CTA
2. **Review Board** — task cards, assignee dropdowns, sidebar (if open)
3. **My Tasks** — tab active/inactive states

Checklist:

- [ ] Page background shows subtle mesh gradient (not flat navy)
- [ ] Header and cards are visually elevated above page
- [ ] Active nav and primary buttons are cream with navy text
- [ ] Body text, headings, and labels are `#EAE0CF`
- [ ] Borders and focus rings are `#7288AE`
- [ ] Muted/placeholder text is readable but clearly subdued
- [ ] Success toast, destructive actions, and warnings are distinguishable
- [ ] No regressions from hardcoded colors (grep confirms none in `.tsx`)

## Files Changed

| File | Change |
|---|---|
| `frontend/src/index.css` | Palette, semantic tokens, body gradient |
| `frontend/src/components/Layout.tsx` | Remove `bg-background` from root wrapper |

## Success Criteria

The app reads as a cohesive dark navy product using exactly the four specified anchor colors, with derived shades only for elevation. Pages feel premium via the mesh gradient. All existing screens work without component edits.
