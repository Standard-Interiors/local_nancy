# Customer Priority Feature — Scheduler QA Report

**Scope:** Scheduler only. This report covers the downstream Scheduler behavior when it consumes Customer Priority data from local NANCY. NANCY admin/import/process-order behavior is tracked separately in [QA-Report-Customer-Priority.md](./QA-Report-Customer-Priority.md).
**Tested workspaces:** after-state from `/Users/william/csr-scheduler` on `feature/local-scheduler-bringup`; clean comparison workspace `/Users/william/csr-scheduler-customer-priority` on `feature/scheduler-customer-priority`
**Base revision:** both workspaces started from `9b8aa4e`
**QA environment:** Local Scheduler only, pointed at local NANCY. No AWS services were used.
**Tested by:** Codex (live local Scheduler UIs + local DB / test verification already completed during bring-up)
**Refresh date:** 2026-04-22 (MDT)
**Status:** **GREEN — the local Scheduler before/after proof is clear and the priority UI behavior is visible.**

---

## 1. What Changed

### 1.1 Business goal
Scheduler is the downstream planning board. The goal here is simple:

1. show **NEW customers** first
2. show **priority properties** right after that
3. make those jobs visually obvious in the Scheduler UI

### 1.2 What Scheduler now does
The local after-state Scheduler now:
- stores `priority_number`
- stores `is_new_customer`
- sorts `NEW` rows first
- then sorts priority rows by ascending priority number
- shows a real **Priority** column in the table
- uses strong visuals so dispatch can see the important jobs immediately

### 1.3 Visual behavior

| Rule | Visual treatment |
|---|---|
| NEW customer | orange-tinted row, `NEW CUSTOMER` label, thin pulsing edge |
| Priority customer | blue-tinted row, `PRIORITY N` label, thin pulsing edge |
| Insufficient material | red key text remains visible |
| Everyone else | normal row styling, `Standard` in priority column |

Important precedence:
- priority visuals do **not** erase the older insufficient-material warning
- if a row has a shortage-style material note, the key text stays red even if the row is also priority-colored

---

## 2. How To Reproduce / Use

### 2.1 Local URLs
- Before UI: `http://localhost:3002`
- After UI: `http://localhost:3001`
- Login: `janedoe / secret`

### 2.2 Denver proof
1. Open both before and after UIs.
2. Log in on both sides.
3. Set:
   - warehouse = `Denver`
   - date = `06 Apr`
4. Compare the top rows.

Expected:
- before: ordinary jobs like `Airie Denver` and `Rock Peak` sit above the TAVA jobs
- after: `TAVA Waters` jobs move to the top and show `PRIORITY 1` in the Priority column

### 2.3 Phoenix proof
1. Open both before and after UIs.
2. Set:
   - warehouse = `Phoenix`
   - date = `06 Apr`
3. Compare the top rows.

Expected:
- before: `Waterford Place` is still mixed into the regular list
- after: `Vetra Chandler` and `Waterford Place` group at the top as `NEW CUSTOMER`

### 2.4 Material-warning proof
1. Open the after-state Scheduler UI.
2. Find a row with a shortage-style material note.
3. Confirm the row can still show the priority styling while the key text remains red.

---

## 3. Test Evidence

### S1 — Denver before vs after shows property priority
Observed local before/after behavior:

Before top rows:
- `1010739` `Airie Denver`
- `1010743` `Rock Peak`
- `1010744` `Pines at Broadmoor Bluffs`

After top rows:
- `1010750` `TAVA Waters` `PRIORITY 1`
- `1010751` `TAVA Waters` `PRIORITY 1`
- `1010764` `TAVA Waters` `PRIORITY 1`

Artifact:
- [Focused Denver before/after board](../demo-assets/scheduler-customer-priority/focused-side-by-side-denver-2026-04-06.png)

### S2 — Phoenix before vs after shows NEW customers grouped together
Observed local before/after behavior:

Before:
- `Waterford Place` was still lower in the list with no strong visual cue

After:
- `Vetra Chandler` and `Waterford Place` moved to the top together as `NEW CUSTOMER`

Artifact:
- [Focused Phoenix before/after board](../demo-assets/scheduler-customer-priority/focused-side-by-side-phoenix-2026-04-06.png)

### S3 — Priority is visible as a real table column
The after-state Scheduler no longer relies only on row tint. The table visibly shows:
- `NEW CUSTOMER`
- `PRIORITY 1`
- `Standard`

That matters because dispatch can now read the reason a row is important without guessing from color alone.

### S4 — Stronger color treatment is visible
The after-state uses:
- stronger orange / blue row treatment
- a thin pulsing edge
- boxed labels in the Priority column

This makes the important jobs pop instead of disappearing into a normal list.

### S5 — Insufficient-material red styling is preserved
The older red warning state still survives the new priority visuals. A row can be priority-highlighted and still keep red key text when it has a shortage-style material note.

Verification for this behavior was already completed in the focused local Scheduler test pass:
- `npm test -- --runInBand --watch=false src/__tests__/pages/home/components/JobTable.spec.tsx`

---

## 4. Known Limitations & Caveats

1. **This report is local-only.** It proves Scheduler behavior against local NANCY, not staging or production.

2. **AWS-backed paths remain intentionally out of scope.** Attachments, CloudWatch, and other AWS-dependent behavior are not part of this Customer Priority QA handoff.

3. **The comparison uses two local workspaces.** The before-state UI came from the clean comparison workspace, while the after-state came from the local testing workspace that also contains the local bring-up changes needed to run Scheduler end to end on this machine.

4. **This report does not re-test NANCY ownership.** The upstream priority import, Existing Orders coloring, and Process Orders / BC release proof live in the NANCY report.

---

## 5. Sign-off Checklist

- [x] Scheduler scope split cleanly away from NANCY QA
- [x] Local before/after Denver proof documented
- [x] Local before/after Phoenix proof documented
- [x] Priority column visibility documented
- [x] Strong visual treatment documented
- [x] Insufficient-material red styling explicitly preserved
- [x] Local-only / no-AWS scope called out

**Recommendation:** use this report as the Scheduler-team handoff. It is the clean downstream companion to the NANCY QA report and keeps ownership boundaries clear.
