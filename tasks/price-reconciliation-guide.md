# JobRunner → NANCY Price Reconciliation Guide

## Why this exists

NANCY is replacing JobRunner. When NANCY quotes an existing JobRunner customer, the prices are sometimes different from what JobRunner quoted them. That's a trust problem — we promised customer X a price, they expect it to carry forward.

**Goal:** make sure NANCY charges the same prices JobRunner charged, for every existing customer. Where it doesn't, fix NANCY's Pricing Contract data to match JobRunner.

---

## What we already know (don't redo this)

1. **Customer ID mapping is solved.** The file `Keys Costar to Job Runner ID Store 2 (1).xlsx` (in `/Users/william/NANCY/`) has 1,410 rows mapping JobRunner Customer ID → Costar Property ID. NANCY stores `costar_id` on each customer, so joining is just a two-hop lookup.

2. **Product ID mapping is NOT solved.** JobRunner and NANCY have separate internal product IDs with no direct link. This is the main piece of work.

3. **Tava Waters is a proven test customer.** JobRunner customer #2177 = NANCY customer #5653. Five of the products on their old quote (PDF #224670) match perfectly between systems on unit prices. One (Metal Stair Nosing $19.00) is missing from NANCY's contract entirely. Use Tava as your smoke test throughout.

---

## The overall plan

1. Export minimum data from JobRunner
2. Check if NANCY has a hidden product-ID link already (30 seconds)
3. Build a product name mapping (only if step 2 came up empty)
4. Run the comparison script
5. Fix the mismatches in NANCY
6. Verify with real PDFs

---

## Phase 1 — Ask JobRunner for this CSV

One spreadsheet, four columns, one row per (customer, product):

| Column | Example |
|---|---|
| jobrunner_customer_id | 2177 |
| product_name | Marvel E227 |
| unit_price | 7.00 |
| unit_of_measure | SqYd |

Expect ~40-50k rows for Store 2 (1,410 customers × roughly 30 items each).

**Don't ask for:** order history, quote numbers, totals, tax, line items. None of that is needed for price reconciliation. You're reconciling the *price list*, not old invoices.

If JobRunner only gives PDFs, this whole effort becomes 100x more painful. Push for a data export.

---

## Phase 2 — Check NANCY's DB for a legacy link (fast win)

Run this against the `GeoffERP` database:

```sql
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE COLUMN_NAME LIKE '%legacy%'
   OR COLUMN_NAME LIKE '%jobrunner%'
   OR COLUMN_NAME LIKE '%source_id%'
   OR COLUMN_NAME LIKE '%import_id%'
   OR COLUMN_NAME LIKE '%old_id%'
   OR COLUMN_NAME LIKE '%external_id%'
ORDER BY TABLE_NAME, COLUMN_NAME;
```

**If any hits show up on product/item/inventory tables:** those are your join columns. JobRunner's product IDs are already inside NANCY. Skip Phase 3 entirely.

**If nothing useful comes back:** no shortcut exists. Continue to Phase 3.

---

## Phase 3 — Build a product-name mapping (only if Phase 2 failed)

### 3a. Auto-match by name (handles ~80% of items for free)

A lot of products are manufacturer-branded and have identical names in both systems:

- "Marvel E227" → NANCY style "Marvel E227"
- "Azure 803" → NANCY color "Azure 803"
- "Cumberland EH002 8 mil" → NANCY style "Cumberland EH002 8 mil"

Run a fuzzy-match script (Python `difflib.get_close_matches`, ratio > 0.9) against NANCY's product catalog. Anything that matches cleanly → auto-mapped.

### 3b. Manual-match the rest (labor, stairs, add-ons)

Examples from the Tava PDF where auto-match breaks:

| JobRunner name | NANCY name |
|---|---|
| 10 Unit Stretch in Installation With New Pad and Tear Out | Carpet Stretch in Installation with Tear Out |
| 31 Stairs Hollywood | Hollywood Step |
| Pad 3 - 5 lb 3/8 in | Pad 3 |
| Metal Stair Nosing - Carpet | *(not in NANCY — add it)* |

Someone who knows both systems sits down with the unmatched list and fills in the NANCY equivalent. Budget: half a day to a full day.

**Recommended person:** Maureen Quarles or similar senior salesperson. They've quoted in both systems and know the renaming.

**Output format:**

```csv
jobrunner_product_name, nancy_product_id, nancy_product_name, match_type
Marvel E227, 12934, Marvel E227, auto
10 Unit Stretch in Installation..., 881, Carpet Stretch in Installation with Tear Out, manual
Metal Stair Nosing - Carpet, NULL, MISSING IN NANCY, add-required
```

Save as `tasks/product-mapping.csv` so we can version-control the decisions.

---

## Phase 4 — Run the comparison

For every row in JobRunner's CSV:

1. Look up NANCY customer:
   - JobRunner `custid` → Excel → `PropertyID`
   - `PropertyID` → NANCY `customer` table (via `costar_id`) → NANCY `customer_id`

2. Look up NANCY product:
   - JobRunner `product_name` → mapping CSV → NANCY `product_id`

3. Query NANCY's customer-pricing table:
   ```sql
   SELECT price FROM CustomerPricing
   WHERE customer_id = ? AND product_id = ?
   ```
   (Replace table/column names with the real ones — need to confirm against schema)

4. Compare the numbers:
   - Equal → ✅ skip
   - Different → ⚠️ write to `price-mismatches.csv`
   - NANCY has no row → ❌ write to `price-missing.csv`

Output two CSVs:
- **price-mismatches.csv** — NANCY charges wrong price, needs UPDATE
- **price-missing.csv** — NANCY doesn't have a contract line for this, needs INSERT

---

## Phase 5 — Fix the mismatches

For each row in `price-mismatches.csv`, generate an SQL UPDATE. For each row in `price-missing.csv`, generate an INSERT.

**Before running anything:**
- Dry-run the updates (`SELECT` what would change, don't actually change)
- Show the dry-run output to someone with authority to approve — probably a store manager
- Back up the pricing tables first (`BACKUP DATABASE` or table-level snapshot)
- Run the updates inside a transaction

After the update, re-run Phase 4. Everything that showed up in the first pass should now be clean.

---

## Phase 6 — Verify with real PDFs

Pricing reconciliation at the unit-price level is necessary but not sufficient. You also want to prove that rebuilt quotes come out to the same total.

**Process:**

1. Grab 5-10 random JobRunner PDFs (mix of small orders and big ones)
2. For each one:
   - Look up the customer in NANCY (via Excel)
   - Go to "Place An Order" in the admin UI
   - Enter the same unit, same rooms, same quantities as the PDF
   - Let NANCY calculate the total
3. Compare NANCY's total to the PDF total
4. Acceptable: within $1-2 (rounding)
5. Unacceptable: more than $5 off → investigate

**If totals still don't match after unit prices are reconciled**, look at:
- Tax rate differences (2023 tax rate ≠ 2026 tax rate)
- Waste/cut multipliers
- Pad coverage calculations
- Rounding rules (per-line vs final-total rounding)

---

## Decisions you need to make before starting

1. **Store scope.** The Excel is Store 2 only. Are there other stores needing the same treatment? If yes, need the equivalent Excel per store.

2. **Date cutoff.** Only reconcile customers active in the last 2 years, or all 1,410 in the Excel?

3. **Who approves manual product matches?** Needs to be someone who knows both systems — suggest Maureen Quarles or store manager.

4. **Tax treatment.** Do you want to reconcile taxable totals, or just pre-tax unit prices? Pre-tax is simpler and probably all that's needed.

5. **Future pricing.** NANCY's Pricing Contract shows "Future Cost 1" and "Future Cost 2" columns. Confirm which column is the live one before comparing — if you compare against the wrong column the whole thing is garbage.

---

## Known gaps and pitfalls

- **Metal Stair Nosing missing from Tava's contract** — this is one item, but likely many such items missing across customers. Phase 4 will surface all of them in `price-missing.csv`.

- **Manufacturer renaming** — if JobRunner stored it as "Engineered Floors" and NANCY stored it as "EF", string matching fails. Use style+color as the composite key rather than manufacturer name.

- **JobRunner may have customer-specific overrides** — some customers negotiated discounts on top of the base price. Confirm the CSV export includes those, not just base catalog prices.

- **NANCY's order builder may apply multipliers** — even if the unit price in the contract is $7.00, the order generator might add a 5% waste factor. That's not a pricing bug, that's a calculation rule. Phase 6 will expose it.

- **The Excel is Store 2 only.** Other stores are out of scope until an equivalent Excel is produced.

---

## Minimum viable first pass (half-day spike)

If you want to size the problem before committing to the full project:

1. Get Tava Waters' full JobRunner price list (just customer 2177, ~30 rows)
2. Export Tava's full NANCY Pricing Contract (same scope)
3. Diff them in Excel side-by-side
4. Count: how many items match? How many differ? How many are missing?

If 90%+ match: the problem is narrow, fix Tava's gaps and pick another customer. If 50% match: the problem is systemic, commit to the full project.

Tava has been partially compared already (5 items, 4 match, 1 missing). Extending that to all ~30 of Tava's items is the smallest meaningful test.

---

## Success criteria

The project is done when:

- For every customer in the Excel, every product they're priced on in JobRunner has an equal-priced entry in NANCY's Pricing Contract
- A random sample of 10 old JobRunner PDFs, re-quoted in NANCY, all produce totals within $2 of the original
- Stakeholders (store managers) have reviewed and approved the mismatch report before updates ran
- All updates are in version control (SQL migrations) so the changes are auditable

---

## Current status

- [x] Confirmed customer mapping works (Tava Waters test)
- [x] Confirmed NANCY's Pricing Contract has matching unit prices for 4/5 Tava items
- [ ] Ask JobRunner for price-list CSV export (Phase 1)
- [ ] Run legacy-column check on NANCY DB (Phase 2)
- [ ] Build product-name mapping (Phase 3, only if Phase 2 empty)
- [ ] Write comparison script (Phase 4)
- [ ] Run mismatch report
- [ ] Approve and apply fixes (Phase 5)
- [ ] Verify with 10 PDFs (Phase 6)
