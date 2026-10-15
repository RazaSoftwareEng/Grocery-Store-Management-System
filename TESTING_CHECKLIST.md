# Testing & Verification Checklist

This checklist verifies all critical workflows of the **Grocery Store Management System**, covering POS billing, inventory deduction, barcode scanning, stock adjustments, supplier purchases, store credit, returns, and financial reports.

---

## 🛒 1. Point of Sale (POS) Billing Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 1.1 | **Product Search** | On POS page, press `F2` or click search. Type `Rice` or `Dalda`. | Product grid filters in real-time. Matches display selling price in PKR, stock, and category. | Verified ✅ |
| 1.2 | **Barcode Scanner Simulation** | Scan or type barcode (e.g. `896400010011` for Basmati Rice 5kg) followed by Enter. | Product is instantly added to cart. Success toast appears. | Verified ✅ |
| 1.3 | **Quantity Stepper & Direct Entry** | Click `+` and `-` on cart item, or type numeric quantity `5`. | Cart line total updates immediately. Subtotal and grand total recalculate. | Verified ✅ |
| 1.4 | **Line Item Discount** | Click `Discount` on cart item. Enter `50`. | Item line total reduces by Rs. 50. Total payable updates. | Verified ✅ |
| 1.5 | **Cart Bill Discount** | Click `(edit)` next to bill discount in cart footer. Enter `100`. | Bill total reduces by Rs. 100. | Verified ✅ |
| 1.6 | **Customer Selector** | Click `Change` in cart header. Select `Muhammad Usman` (Khata balance customer). | Customer name attaches to invoice. Shows outstanding credit balance. | Verified ✅ |
| 1.7 | **Cash Tendered & Change** | Click `Pay & Checkout` (or press `F8`). Enter Cash Tendered greater than bill total (or click `+1,000`). | Change to return is calculated automatically and highlighted in bold green. | Verified ✅ |
| 1.8 | **Stock Deduction & Concurrency Lock** | Complete checkout. Check `Products` page. | Stock of purchased items decreases by the exact quantity sold. Record appears in `StockMovements`. | Verified ✅ |
| 1.9 | **Overselling Prevention** | Try to add more items to cart than current stock (when `allowNegativeStock` is false). | System warns that requested quantity exceeds available stock and blocks overselling. | Verified ✅ |
| 1.10 | **Receipt Generation & Thermal Print** | Complete checkout. | Receipt Modal appears with store branding, itemized table, totals, tendered cash, change returned, and formatted thermal receipt layout. | Verified ✅ |

---

## 📦 2. Product & Inventory Management Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 2.1 | **Add New Product** | Go to `Products` > Click `Add Product`. Enter title, category, cost price, selling price, and stock. | Product is created and saved to database with unique SKU and initial stock movement log. | Verified ✅ |
| 2.2 | **Edit Product** | Click `Edit` on a product. Change selling price. | Price updates in catalog and POS immediately. | Verified ✅ |
| 2.3 | **Manual Stock Adjustment** | Click `Stock` button on a product. Select `Subtract (-)`, quantity `2`, reason `Damaged Goods / Spoilage`. | Current stock decreases by 2. Audit entry is added to `Inventory Movement History`. | Verified ✅ |
| 2.4 | **Low Stock Alerts** | Adjust a product stock below its minimum threshold. | Product displays amber warning badge in catalog, appears in Header notification bell, and on Dashboard. | Verified ✅ |
| 2.5 | **Deactivate Product** | Click `Deactivate` on a product. | Product is marked `INACTIVE` and hidden from the POS register. Can be restored anytime. | Verified ✅ |

---

## 🚚 3. Purchases & Supplier Management Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 3.1 | **Create Purchase Order** | Go to `Purchases` > Click `New Purchase Order`. Select supplier, add 2 products with quantities and unit costs. | Purchase order created with status `PENDING`. Stock is NOT yet increased. | Verified ✅ |
| 3.2 | **Confirm Purchase Order** | Click `Confirm` on the pending purchase order. | Stock of all order items is automatically increased in inventory! Movement type `PURCHASE` is logged. | Verified ✅ |
| 3.3 | **Supplier Credit Balance** | In purchase order with remaining balance, confirm order. Check `Suppliers`. | Supplier's outstanding balance increases by the unpaid balance amount. | Verified ✅ |
| 3.4 | **Record Supplier Payment** | Go to `Suppliers` > Click `Pay` on supplier with balance. Enter payment amount. | Outstanding balance decreases by payment amount. | Verified ✅ |

---

## 🧾 4. Sales Invoices & Returns Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 4.1 | **Invoice Lookup & Filter** | Go to `Sales & Invoices`. Filter by Payment Method or search invoice number. | Table displays matched transaction records with cashier and total. | Verified ✅ |
| 4.2 | **Reprint Receipt** | Click `Invoice` button on any completed sale. | Generates printable thermal receipt matching the original transaction. | Verified ✅ |
| 4.3 | **Return & Restock Reversal** | Click `Return` on completed sale. Enter return reason. | Sale status updates to `CANCELLED`. Inventory of all items is automatically restored back to stock! | Verified ✅ |

---

## 📊 5. Financial Reports & Profit Analysis Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 5.1 | **Accurate Gross Profit** | Go to `Reports & Profit`. Check Gross Profit metric. | Gross Profit = `Sales Revenue - COGS` (using cost prices captured at time of sale). | Verified ✅ |
| 5.2 | **Net Profit Estimate** | Add a test expense in `Expenses` (e.g. Electricity Rs. 5,000). Return to `Reports`. | Net Profit = `Gross Profit - Total Operating Expenses`. | Verified ✅ |
| 5.3 | **Date Range Filtering** | Click `Today`, `Last 7 Days`, or select custom date range. | KPIs and Recharts charts update to reflect the selected date window. | Verified ✅ |
| 5.4 | **Stock Valuation** | Check Store Inventory Valuation card. | Accurately calculates total retail inventory value and wholesale cost value across all active stock. | Verified ✅ |
| 5.5 | **CSV Exports** | Click `Export` on Products, Sales, Expenses, and Reports. | Clean, formatted `.csv` files download directly to browser. | Verified ✅ |

---

## ⚙️ 6. Settings & Integration Testing

| # | Test Case | Steps to Test | Expected Result | Status |
|---|-----------|---------------|-----------------|--------|
| 6.1 | **Store Profile Updates** | Update store name, phone, address, or currency in `Settings`. | App updates instantly across header, receipts, and POS. | Verified ✅ |
| 6.2 | **Connection Test** | In `Settings` > `Google Sheets Integration`, test invalid and valid Apps Script URLs. | Validates connection status and reports clear error/success messages. | Verified ✅ |
| 6.3 | **1-Click Local Demo Reset** | Click `Reset Demo Data` in Settings. | Restores clean initial sample products, categories, suppliers, and customers. | Verified ✅ |
