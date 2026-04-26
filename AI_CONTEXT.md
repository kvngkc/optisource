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

### A. Decimal Qty DB Migration (DONE ✅)
The database was successfully updated to support `numeric(10,2)` for `stock.qty`, `stock.allocated_qty`, `transactions.qty`, and `optician_order_items.qty`.

### B. Base Spec Normalization (DONE ✅)
Base values are now unsigned `400` instead of `+400`. `BASE_VALUES` and `dbFormatBase()` ensure write-time and read-time normalization.

### C. Base Addition Normalization (DONE ✅)
The system had fragmented stock rows due to `+` prefixed addition values for semi-finished blanks (e.g. `+300` vs `300`). 
**Fixes applied:**
1. `src/utils/specs.js`: Added `BASE_ADD_VALUES` (unsigned additions) and `dbFormatAddition(v, isBase)`.
2. UI Dropdowns: `Sales`, `Inventory`, `StockQuery` now explicitly use `BASE_ADD_VALUES` for `base_add` products. Finished products (`sph_add`) retain the `+` sign.
3. SQL Migration: Merged duplicate duplicate rows across all spec variants and stripped `+` from existing `stock` and `transactions` tables.

### D. Sales Module Enhancements & Bug Fixes (DONE ✅)
1. **Validation**: `unit_price` is now strictly required. If `balance > 0`, `customer_name` is mandatory for debt tracking.
2. **Debtors Insert**: Credit sales now correctly auto-insert records into the `debtors` table, linking to the `transaction_id`.
3. **Transaction Error Safety**: If a transaction `insert` fails, the stock deduction is immediately rolled back.
4. **Idempotency Guard**: `handleVoid` now checks for existing `SALE_VOID` records to prevent double-voiding.
5. **Void Spec Normalization**: `handleVoid` defensively strips `+` from specs before querying stock to ensure proper returns.
6. **Void Debt Clearance**: Voiding a sale automatically updates the linked `debtors` record to `is_settled: true, balance: 0` and alerts the user if manual cash refunds are required.
7. **Stock Aggregate Lookup**: Replaced `maybeSingle()` with `.select()` and aggregate reduction in `checkStock` and `handleSubmit` to prevent "Out of Stock" errors when multiple matching rows (duplicates) exist in the DB.

### E. Stock Query Fixes (DONE ✅)
Fixed the Optician stock query page crash caused by a mismatched state variable (`selForm.addition` -> `form.addition`).

---

## 5. Known Issues / Pending Tasks
*Currently stable. Next phase is feature expansion and testing.*

---

## 6. Feature Roadmap (not yet started)

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