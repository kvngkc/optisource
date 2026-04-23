# Next AI Handoff Prompt: Inventory Addition Normalisation & Sales Bug Fixes

Hello! You are picking up right where I left off. We are working on Optisource (a B2B platform for Optical Suppliers and Opticians). Please read the `AI_CONTEXT.md` file first to understand the tech stack and domain rules.

We have two primary issues to solve in this session. The user has explicitly forbidden me from changing the code so you can handle it from a clean slate. 

Here is exactly what you need to do:

### 1. Fix the `Sales.jsx` Transaction/Debtors Bug
**The Bug:** The user made a manual credit sale for a semi-finished blank. The stock was successfully deducted, but the "Units Sold" on the dashboard didn't increase, and the sale didn't reflect in the Debtors tab.
**The Root Cause:** Because "Units Sold" didn't increase, we know the `supabase.from('transactions').insert(...)` call in `Sales.jsx` failed silently or threw an error that didn't rollback the stock deduction. Since the frontend makes separate API calls, the stock was deducted but the transaction/debtor record was never created.

**Your Tasks for Sales:**
- **Unit Price Validation:** Make `unit_price` strictly required in `Sales.jsx` before allowing submission. (The user manually entered a price because it didn't auto-fill, which might have caused a type error if left blank or malformed).
- **Customer Name Validation:** If `amount_paid < total_amount` (i.e., there is a debt/balance), `customer_name` must be strictly required. `customer_phone` can remain optional.
- **Investigate Debtors Logic:** Check how `debtors` records are actually created. Is there a Postgres trigger on `transactions`, or is `Sales.jsx` supposed to insert into `debtors` directly? (I couldn't find an explicit insert into `debtors` in `Sales.jsx`. If it's missing, you need to implement it or fix the trigger).
- **Error Handling:** Ensure that if the `transactions` insert fails, the UI throws a clear error so the user knows. (Ideally, stock updates and transaction inserts should be an RPC, but stick to the current frontend-driven architecture and just fix the validation/insertion logic).

### 2. Normalise `ADD` (Addition) Values for Semi-Finished Blanks
**The Bug:** The user imports base blanks with additions like `300` but manual entry saves them as `+300`. This creates fragmented stock records.
**The Rule:** For *semi-finished blanks* ONLY (products where `spec_type` is `base_add`), the `addition` value must NOT have a `+` sign. It should be stored and displayed as `100`, `200`, `300`. However, for *finished lenses* (e.g., `sph_add`, `sph_cyl_axis_add`), the `+` sign MUST remain (e.g., `+100`).

**Your Tasks for Additions:**
- **Update `src/utils/specs.js`:** You'll likely need a new array like `BASE_ADD_VALUES` (without `+` signs) for blanks, while keeping the original `ADD_VALUES` (with `+` signs) for finished lenses.
- **Update UI Dropdowns:** Update `Inventory.jsx`, `Sales.jsx`, `StockQuery.jsx`, and `Products.jsx` to use the unsigned addition values for `base_add` products. The frontend must display `300`, not `Add +300`.
- **SQL Migration:** Write a SQL migration script to find existing `base_add` stock rows that have a `+` in their `addition` column and strip it, then merge any duplicates. (The user confirmed there are no negative additions for blanks, they are all positive). Save this script in the `scratch/` directory for the user to run.

**Summary:**
Do not touch anything until you've read `AI_CONTEXT.md`. Start by investigating the `Sales.jsx` insertion failure and then implement the validations and the base addition normalisation.
