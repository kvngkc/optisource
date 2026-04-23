# Optisource — AI Context & Handoff Prompt
*Last updated: 2026-04-23 | Session: Inventory Normalization Initiative*

---

## 1. Role & Mission

You are the **Lead AI Software Engineer and Product Manager** for **Optisource** — a multi-tenant B2B platform for Optical Suppliers and retail Opticians. Your mission is to maintain, upgrade, and troubleshoot the platform while ensuring absolute data integrity across inventory, sales, and debt management workflows.

---

## 2. Technical Stack (hard constraints — do not deviate)

| Layer | Technology |
|---|---|
| Frontend | React (Vite) + React Router + TailwindCSS |
| Backend/DB | Supabase (PostgreSQL) + Row Level Security (RLS) |
| Architecture | Client-side SPA — business logic in Supabase client or PostgreSQL functions |
| Tenancy | Strictly isolated by `company_id` on every query |
| Auth | Supabase Auth — roles: `company_admin`, `super_admin`, `staff`, `manager`, `optician` |

**Key files to read before any task:**
- `src/utils/specs.js` — all spec value arrays and formatters
- `src/supabase.js` — global client
- `src/pages/operations/Inventory.jsx` — manual entry, transfer, import
- `src/pages/reports/StockQuery.jsx` — staff and optician stock queries
- `src/pages/operations/Sales.jsx` — sales entry + void
- `src/pages/reports/OrderDetail.jsx` — order dispatch + fulfillment
- `src/pages/admin/Products.jsx` — product management + admin import

---

## 3. Domain Logic (must internalize)

### Spec Types
| spec_type | SPH | CYL | Axis | ADD | Base |
|---|---|---|---|---|---|
| `sph_add` | ✓ | – | – | ✓ | – |
| `sph_cyl` | ✓ | ✓ | – | – | – |
| `sph_cyl_axis_add` | ✓ | ✓ | ✓ | ✓ | – |
| `base_only` | – | – | – | – | ✓ |
| `base_add` | – | – | – | ✓ | ✓ |
| `name_only` | – | – | – | – | – |

### Spec Value Formats (CRITICAL — enforced as of this session)
- **Base (sph column):** Stored as **unsigned whole numbers** — `"Plano"`, `"100"`, `"200"` … `"1200"`. `"Plano"` is valid for zero-power blanks. **Never `"+200"`**.
- **SPH (regular lenses):** Signed strings — `"Plano"`, `"+200"`, `"-075"`.
- **CYL:** Signed strings — `"-025"`, `"+000"`, etc.
- **ADD:** Signed strings — `"+100"`, `"+125"`, etc. **Always retains `+` prefix.**
- **Axis:** Unsigned — `"90"`, `"180"`.

### Visibility Rules
- Opticians see **In Stock / Out of Stock only** — never raw quantities.
- Supplier privacy: opticians must enter a company code to connect.
- Staff are restricted to their assigned `location_id`.

### Transaction Integrity
- Every stock mutation writes a `transactions` row and an `audit_log` row.
- Overselling is blocked at both frontend and backend level.
- Void of a sale/inventory-add returns qty to stock and writes a `*_VOID` transaction.

---

## 4. What Was Completed This Session

### A. Base Value Normalization (DONE ✅)
The system had fragmented stock rows caused by inconsistent storage of Base values — some rows stored `"+400"`, others `"400"`. This caused query mismatches and phantom duplicates.

**Fixes applied:**
1. **`src/utils/specs.js`** — `dbFormatBase()` now **strips** `+` (was adding it). `normalizeBase` alias added. `BASE_VALUES` now includes `"Plano"` as first item.
2. **`src/pages/operations/Inventory.jsx`:**
   - `InventoryEntryTab.getSpecValues()` — normalizes base sph before DB write
   - `InventoryTransferTab.getSpecValues()` — same
   - `buildImportSpecs()` — strips `+` from base column on CSV import
   - `prefillFromLog()` — reuses actual log values when user clicks a row; normalizes legacy `+` prefix
   - `handleVoid()` — idempotency guard (checks for existing `INVENTORY_VOID` before proceeding)
   - `specsComplete` computed value — Transfer FROM panel shows contextual hint when spec incomplete
   - Inline duplicate-stock warning (amber banner below spec selector)
3. **`src/pages/reports/StockQuery.jsx`:**
   - Both `getSpecs()` functions normalize base sph before querying
   - Optician `useEffect` — resets all spec filters to `'all'` when product changes (was incorrectly defaulting to `'100'`)
   - Staff query dropdowns — class and product start with `"— Select —"` placeholders
4. **`src/pages/operations/Sales.jsx`:**
   - `normSph()` helper added — normalizes base sph in `getSpecs()`, `checkStock()`, `loadDefaultPrice()`
   - All dropdowns start with placeholder options (no auto-selected defaults)
   - Spec validation before submit (blocks if required fields are empty)
5. **`src/pages/reports/OrderDetail.jsx`:**
   - Dispatch deduction normalizes `spec_details.sph` before querying stock
   - Dispatch location dropdown has placeholder
6. **`src/pages/admin/Products.jsx`:**
   - Manual import mode uses `BASE_VALUES` for base templates (was using `SPH_VALUES`)
   - All spec dropdowns start with placeholders
   - CSV template examples updated to unsigned base values

### B. SQL Migration (DONE ✅ — user confirmed 0 rows remaining)
File: `C:\Users\hp14\.gemini\antigravity\brain\c5b79f24-8e08-48b6-ab55-3d2a5a84fe57\scratch\base_normalization_migration.sql`

Merged and normalized 9 fragmented stock rows:
- FUSE AR: `+400` → `400` (6 rows)
- FUSE PHOTO: `+600` → `600` (2 rows)
- INV AR: `+400` → `400` (1 row)

### C. UX: No Default Selections (DONE ✅)
All spec dropdowns across all pages now start with `"— Select X —"` placeholders. Users must consciously select every field. Spec-required validation blocks submit if any required field is empty.

---

## 5. ⚠️ PENDING — Must Complete Next Session

### P1 — CRITICAL: Decimal Qty DB Migration (NOT YET RUN)
**Error currently active:** `invalid input syntax for type integer: "30.5"`

The frontend accepts decimal quantities (step 0.5) but the DB columns are still `INTEGER`. Run this SQL in Supabase SQL Editor **immediately**:

```sql
-- Fix decimal quantity support
ALTER TABLE stock
  ALTER COLUMN qty TYPE NUMERIC(10,2) USING qty::NUMERIC;

ALTER TABLE stock
  ALTER COLUMN allocated_qty TYPE NUMERIC(10,2) USING COALESCE(allocated_qty, 0)::NUMERIC;

ALTER TABLE transactions
  ALTER COLUMN qty TYPE NUMERIC(10,2) USING qty::NUMERIC;

ALTER TABLE optician_order_items
  ALTER COLUMN qty TYPE NUMERIC(10,2) USING qty::NUMERIC;
```

Verify after with:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE column_name = 'qty'
  AND table_name IN ('stock', 'transactions', 'optician_order_items');
-- All should show data_type = 'numeric'
```

Full migration file: `C:\Users\hp14\.gemini\antigravity\brain\c5b79f24-8e08-48b6-ab55-3d2a5a84fe57\scratch\decimal_qty_migration.sql`

---

## 6. Known Issues to Investigate Next

| # | Issue | Suspected cause |
|---|---|---|
| 1 | Decimal qty error (`30.5` → integer error) | DB columns still INTEGER — **run P1 migration** |
| 2 | Sales.jsx void (`handleVoid`) — no idempotency guard yet | Should add same guard as `Inventory.jsx` handleVoid |
| 3 | `OrderDetail.jsx` dispatch void — no idempotency guard | Items can be double-dispatched if user clicks twice |
| 4 | `Products.jsx` `ManualMode` — no validation before adding row | User can add row with no sph selected |

---

## 7. Feature Roadmap (not yet started)

1. **Purchase Orders module** — COGS/margin calculation
2. **PDF invoice generation** — auto-generated on dispatch
3. **Stock reorder alerts** — low-stock threshold notifications
4. **Debtors module enhancements** — advanced filter/export
5. **Admin-approval workflow** — pending optician registrations

---

## 8. Operational Protocols

- **File edits:** Always read the target file before editing. Use `multi_replace_file_content` for non-adjacent changes.
- **Styling:** Slate color family, `rounded-xl` containers, Inter typeface. No inline styles.
- **Safety:** Trace full data flow across `AI_CONTEXT.md → specs.js → relevant page` before altering inventory or financial logic.
- **After every major task:** Ask 5 targeted clarifying questions.
- **DB queries:** Always scope by `company_id`. Never bypass RLS.
- **No regressions:** Test regular SPH/CYL products after any Base-related change — they must be unaffected.

---

## 9. Initialization Sequence for Next AI

1. Read this file in full.
2. Read `src/utils/specs.js` — confirm `BASE_VALUES` includes `"Plano"` and `dbFormatBase` strips `+`.
3. Read `src/pages/operations/Inventory.jsx` — confirm `SpecSelector` has placeholder options.
4. **Immediately ask the user**: "Has the decimal qty SQL migration been run yet?" If not, paste the SQL from section P1 above.
5. State readiness and request first task.