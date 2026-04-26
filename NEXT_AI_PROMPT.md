# NEXT AI TASK: Comprehensive System Testing

The system has just undergone significant structural normalization, fixing several critical bugs related to spec formatting (Base values, Additions), decimal quantities, and sales/debt linkage. Your goal is to run a comprehensive, end-to-end testing suite to verify these fixes and ensure complete data integrity across all core modules.

Please execute the following test cases manually or instruct the user to execute them and verify the exact results against the expected behavior outlined below.

---

## 1. Inventory Module (All Tabs)

### Test A: Decimal Manual Entry
- **Action:** Go to "Inventory" -> "Add Stock". Select a product (e.g. `sph_cyl`), choose SPH `+100`, CYL `-025`. Enter Qty as `10.5` and submit.
- **Expected Result:** 
  - Submits successfully. 
  - Audit log shows `10.5` added. so if 
  - Stock Query shows exact matching decimal increase.

### Test B: Base Add Normalization in Entry
- **Action:** Select a `base_add` semi-finished blank.
- **Expected Result:** 
  - Base dropdown starts at `Plano`, `100`, `200` (NO `+` signs).
  - Addition dropdown shows `25`, `50`, `75` (NO `+` signs).
- **Action:** Enter a quantity and submit.
- **Expected Result:** Saves successfully. Does not create a fragmented row (check Stock Query for duplicates).

### Test C: Inventory Transfer
- **Action:** Go to "Transfer Stock". Select a location and a product with decimal stock. Transfer `2.5` units.
- **Expected Result:** Submits successfully. Source location reduces by `2.5`, destination increases by `2.5`.

---

## 2. Sales Module

### Test A: Credit Sale & Debt Linkage
- **Action:** Go to Sales. Select a product. Enter a valid Qty. 
- **Action:** Leave `unit_price` blank or 0 and attempt to submit.
- **Expected Result:** Blocks submission with "Unit price is required".
- **Action:** Enter `unit_price` = `1000`. Set `amount_paid` = `0`. Leave `customer_name` blank. Submit.
- **Expected Result:** Blocks submission with "Customer name is required for credit sales".
- **Action:** Enter `customer_name` = "Test Debt User". Submit.
- **Expected Result:** 
  - Sale succeeds.
  - Stock is deducted correctly.

### Test B: Over-sell & Duplicate Stock Handling
- **Action:** In Sales, select a product where you know there are duplicate stock rows (if any still exist, or artificially create one) or just select any product. Enter a qty higher than total available stock.
- **Expected Result:** Blocks submission with "Oversell blocked".
- **Action:** Enter exact available stock. Submit.
- **Expected Result:** Success. Stock fully depletes.

---

## 3. Debtors Module

### Test A: Debt Verification
- **Action:** Navigate to Debtors page.
- **Expected Result:** The credit sale from `Sales Test A` ("Test Debt User") is listed with the correct total amount, 0 paid, and full balance due.

---

## 4. Voiding & Recovery

### Test A: Sales Void & Debt Clearance
- **Action:** Go to Sales -> Recent Sales. Find the credit sale made in `Sales Test A`. Click Void.
- **Expected Result:**
  - Prompt confirms the void.
  - Returns the exact qty back to stock (Verify via Stock Query).
  - Debtors table is automatically updated: The debt record for this transaction now shows `Balance = 0` and is marked as settled (or cleared from the active debts list).

### Test B: Inventory Add Void Idempotency
- **Action:** Go to Inventory -> Recent logs. Void a recent manual addition.
- **Expected Result:** Qty is correctly deducted from stock. Attempting to click Void again or re-firing the request fails (Idempotency guard triggers).

---

## 5. Stock Query (Staff & Optician)

### Test A: Staff Stock Query
- **Action:** Go to Stock Query. Select a `base_add` product. 
- **Expected Result:** The dropdowns for Base and Addition contain NO `+` signs.
- **Action:** Search for the exact specs you entered in `Inventory Test B`.
- **Expected Result:** Returns a single consolidated row with the correct total quantity.

### Test B: Optician Stock Query
- **Action:** Navigate to the Optician Portal. Enter a supplier code.
- **Action:** Go to Stock Query, select a `base_add` product.
- **Expected Result:** 
  - Base and Addition dropdowns do NOT have `+` signs.
  - Clicking "Check availability" correctly returns In Stock / Out of Stock without crashing. (Crash bug was fixed).

---

## 6. Dashboard

### Test A: Analytics Verification
- **Action:** View Dashboard metrics.
- **Expected Result:**
  - Units Sold reflects the exact number of units sold minus voided sales.
  - Total Revenue reflects only actual sales (ignoring voids).
  - "Total Debtors" correctly calculates outstanding balances.

---
**Instructions for the Next AI:**
Work with the user to run these scenarios. If any test fails, use your diagnostic skills to trace the flow from `AI_CONTEXT.md` -> UI component -> `specs.js` -> Supabase DB and patch the regression. Ensure zero `+` signs re-enter the database for base products.


read ai_context.md file

i have some  issues with the following

1. sales

after filliing the fields and submit; it gets s in ' recording' ; the stock is deducted, but the trx does't show up in 'recent sales'; does not update dashboard, does not reflect in debtors 

check code, sql, etc          

ask 5 questions or more to clarify