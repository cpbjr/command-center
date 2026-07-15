# Mobile Redesign — Within the WPA Brand

**Date:** 2026-07-15 · **Branch:** `feature/mobile-improvements` · **Trigger:** GitHub issue #9
**Status:** ✅ Complete (2026-07-15)

## Context

The Command Center is a one-person agency's operations console. Issue #9 escalated from
"fix 3 bugs" to a full mobile design pass that leans the app into its own existing WPA brand
(documented in `.agent/SOPs/wpa-brand.css`, mapped to shadcn tokens in `src/index.css`).
The brand is currently under-used. **No new palette or typefaces** — the brand file IS the brief.

## Design plan (compact token system)

**Subject:** a field operations console — one operator (Christopher) working leads → clients on
his phone between site visits. The page's job: let him triage and act fast with one thumb.

**Color (from brand, deployed for a dashboard not a brochure):**
- `--parchment #FDFBF7` — app canvas (never pure white)
- `--pine-deep #1A3328` → `--pine-forest #24453A` — workspace chrome (sidebar, headers, bottom nav)
- `--ridge #C17F4E` (terracotta) — reserved for the **single primary action** per view. Scarcity = signal.
- `--needle #5B8C5A` — positive/active state accents only
- `--sand #C4B5A3` / `--stone` — meta text, dividers
- Status semantics keep their existing green/amber/red dots.

**Type (3 roles, already loaded):**
- Display: **Libre Baskerville** serif — page + entity names. Editorial, not neutral.
- Body: **DM Sans** — all UI text.
- Utility: **JetBrains Mono** — the `.text-meta` device (10px, uppercase, tracked). This is the signature.

**Layout concept:** pine chrome frames a parchment worksheet. On mobile, tables collapse to
tap-card stacks; the desktop sidebar becomes a **pine bottom tab bar** (thumb-reachable). Detail
opens as a **full-height bottom sheet** (drawer that respects `dvh`), not a cramped right rail.

```
 mobile                       detail sheet
┌──────────────┐            ┌──────────────┐
│ ☰  Leads   CB│ header     │ ══ grip ══   │
├──────────────┤            │ Business name│ serif
│ [search]     │            │ STATUS·SCORE │ meta
│ ┌──────────┐ │            ├──────────────┤
│ │ Card     │ │ tap-card   │ scrollable   │
│ │ meta·tel │ │            │ (dvh)        │
│ └──────────┘ │            │ notes(typed) │
│ ┌──────────┐ │            │ contact/tel  │
├──────────────┤            └──────────────┘
│◎ ○ ○ ○ ○  ○ │ pine tabs
└──────────────┘
```

**Signature element:** the **mono-uppercase meta line** (`.text-meta`) used as a consistent
structural rail across every card and section header — category · city · score · date rendered as
a single tracked monospace string, like a field label on surveyor's equipment. It encodes real
operational metadata (not decoration), ties directly to the "White Pine / ridge / survey" brand
world, and appears nowhere in the generic cream-serif-terracotta template because those are
marketing pages, not dense operator tools.

## Self-critique vs. generic AI defaults

The palette (cream + serif + terracotta) equals AI-default look #1 — but it is the **client's
documented pre-existing brand**, and the skill says the brief's own words win. Differentiation is
in *deployment*: pine as functional chrome, ridge rationed to one action per view, and the mono
meta-rail as the load-bearing structural device on a data-dense console. Not a brochure. Kept.

## Workstreams

**A. Issue #9 defects**
1. Scroll bug — `h-screen`+`overflow-hidden` → `h-dvh`; Sheet/ScrollArea resolve to full dynamic viewport.
2. `formatPhone()` (US, graceful) in `src/lib/format.ts`, TDD. Apply at LeadDetail, LeadTable,
   ContactList, ClientCard (+ make ClientCard phone a `tel:` link).
3. LeadDetail notes → typed structured entries (mirrors `ContactNotes` pattern) instead of one blob.

**B. Stay-logged-in** — checkbox on login; persistent (localStorage) vs session-only (sessionStorage)
storage on the Supabase client. Restyle login to the brand.

**C. Full mobile pass** — bottom tab bar, full-height bottom sheet, ≥44px targets, tables→cards,
brand hierarchy (serif headers, meta rails, rationed ridge).

**D. Keep desktop coherent** — mobile changes gated behind breakpoints; desktop layout unchanged.

## Verification

- Screenshots at 390×844 across every page + open detail sheet (scroll to bottom proves the fix).
- `npm run build` green.
- Revert `.env` `VITE_REQUIRE_AUTH=true` before done.

---

## Work completed (2026-07-15)

**Defects (issue #9)**
1. **Scroll** — `AppShell` `h-screen`→`h-dvh`; detail Sheet rebuilt as a `92dvh` bottom
   drawer with a sticky header + flex `ScrollArea`. Verified programmatically: viewport
   `scrollHeight 1231 / clientHeight 591`, scrolls to `atBottom:true`; last section (Discovery) reachable.
2. **Phone** — added `formatPhone()` (`src/lib/format.ts`) US-formatting, graceful on odd input,
   preserves extensions. **6 vitest cases (TDD, red→green).** Applied in LeadDetail, LeadTable,
   ContactList, ClientCard — and ClientCard phone converted from plain text to a `tel:` link.
3. **Notes** — the freeform blob is now a clearly-labeled **"Standing Notes"** field (auto-save kept),
   visually distinct from the already-structured `ActivityFeed` typed event log below it. No teardown
   of working code; the structured pattern already existed for events.

**Feature — Stay logged in**
- Custom `auth.storage` adapter in `src/lib/supabase.ts` routes the session to `localStorage`
  (persistent, default) or `sessionStorage` (this-tab-only) per a flag set by the login checkbox.
  Verified: checked→localStorage only, unchecked→sessionStorage only, both log in.

**Mobile redesign (within WPA brand)**
- New **pine bottom tab bar** (`BottomNav.tsx`) — 5 primary destinations, needle-green active tick,
  safe-area padding; desktop sidebar unchanged (`md:` gated).
- Login screen rebuilt: pine field, serif WPA wordmark, mono tagline, ridge primary button.
- Signature device shipped: `.meta-rail` / `.section-eyebrow` mono-uppercase treatments used across
  the detail drawer and page section headers; snake_case categories now Title-Cased.
- Tasks FAB recolored to **ridge** (the rationed primary accent) and lifted clear of the bottom nav.
- Added `--color-needle-light/ridge-light/bark-light` token mappings; added Discovery to Header titles.
- Per-page brand-hierarchy polish (Clients/Costs/Discovery/Projects widgets) via subagent — class-only
  swaps to `.section-eyebrow`/`.text-meta`, off-brand blue link→pine.

**Quality gates:** `vitest run` 6/6 pass · `tsc -b` clean · `npm run build` succeeds.
**Note:** GitHub issue #9 to be closed manually by Christopher (external-write denied to the agent).
**New dev dep:** `vitest` (test runner; added for the phone-formatter TDD).
