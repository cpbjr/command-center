# Active Tasks

**Last Updated**: 2026-07-15 (follow-up: ConvertToClientDialog audited safe, VITE_REQUIRE_AUTH secret confirmed, ridge logged as potential-issue)

## Mobile Redesign — Cleanup & Focus Pass
> *Branch `feature/mobile-improvements` · PR #10 open. Refinement on top of shipped work — tighten, don't add scope.*

- [x] **Fix TaskForm mobile scroll (2026-07-15).** Task edit dialog was a plain shadcn `Dialog` (never rebuilt like LeadDetail) — vertically centered with no max-height/overflow, so on a phone the tall form clipped its Title off the top with no way to scroll. Made `DialogContent` a bounded (`max-h-[92dvh]`) flex column with an internal `overflow-y-auto` body. Title now visible at top; form scrolls. Verified via mobile puppeteer screenshot.
- [ ] **Add dark mode.** Site is currently light-only. Phones with OS/Chrome "force dark" auto-invert it into a muddy, cramped render (see task edit form). Add real dark-theme tokens (or, minimum viable: `color-scheme` opt-out to stop auto-inversion) so the site is intentional in dark mode. Every component/color needs a dark variant if going full dark mode. **Priority — Christopher flagged this from mobile.**
- [x] **Fix meta-rail wrapping orphan bullet (2026-07-15).** On a long lead name (e.g. "Native Landscape Services"), the mono meta-rail wrapped `· GARDEN CITY` to a second line with a dangling leading `·`. The `·` separator was a `::before` on each non-first item, so it wrapped with the item. Moved it to `::after` on each non-last item (`src/index.css`) — separator now trails the first line naturally, wrapped item starts clean. Verified in isolated render.
- [ ] **Unify drawer child-component headers.** `ContactList.tsx:101`, `ActivityFeed.tsx:64` (and EntityTaskList) use sans `text-sm font-semibold` headers, while `LeadDetail`'s own sections use the mono `.section-eyebrow`. Reconcile to one signature inside the drawer.
- [x] **Promote durable brand devices to canonical CSS (2026-07-15).** Added `.meta-rail` and the `.wordmark`/`.wordmark-tagline` lockup to `.agent/SOPs/wpa-brand.css` (post-v1.0, `.wpa-brand`-namespaced, using the file's tokens). Eyebrow was FOLDED into the existing sans `.overline` per Christopher (no new mono `.section-eyebrow` in the brand file; app keeps its own bare version). `.drawer-grip` + bottom-nav chrome stay app-only (touch/safe-area plumbing). Refactored the login wordmark out of inline JSX in `AuthGate.tsx` into bare `.wordmark`/`.wordmark-tagline` classes (added to `src/index.css`) — verified zero visual change on the login screen. tsc + build clean.
- [ ] **General focus / decoration audit.** Remove anything reading as decoration not signal; confirm ridge (terracotta) appears once per view; verify tap targets ≥44px everywhere.
- [ ] **Potential issue — ridge applied inconsistently by absence (needs in-app eval).** App-wide, ridge (terracotta) appears in exactly two places: the login CTA (`AuthGate.tsx:122`) and the tasks FAB (`TaskBoard.tsx:135`), each on a different view — so "one ridge per view" is NOT violated by doubling. The open question: Clients / Projects / Discovery / Leads have NO ridge primary action at all, so the rule is applied inconsistently *by absence*. Decide whether those views should each get one rationed ridge primary CTA (their main Add/New action) or whether ridge is deliberately reserved for just login + tasks. **Design-intent call — Christopher to evaluate in-app when time allows.** Load frontend-design skill before touching.

---

## Issues Reported
> *Imported from GitHub Issues on session start.*

### #9 - Mobile site needs improvements
**Source:** [GitHub #9](https://github.com/cpbjr/command-center/issues/9)
**Imported:** 2026-07-15

Cannot see or scroll to full page.

Also telephone numbers should be clickable to dial on mobile and be properly formatted. Notes section should also have some structure. ![image](https://github.com/user-attachments/assets/44475ae2-0ae6-4e2b-9f5e-fa8598b3188f)

---
