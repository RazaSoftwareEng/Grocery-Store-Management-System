# Grocery Store Management System

A modern, fast, responsive Grocery Store Management System tailored for local grocery stores and retail supermarkets. Built with **React, Vite, Tailwind CSS, React Router, Lucide React, and Recharts**, using **Google Sheets as the database** and **Google Apps Script as the backend API**.

---

## 🌟 Key Features

### 🛒 Point of Sale (POS) Billing
- Fast, keyboard-friendly retail billing (`F2` search, `F4` clear cart, `F8` checkout).
- **Hardware Barcode Scanner Support**: Automatic keystroke buffer listener for USB and Bluetooth handheld barcode scanners.
- Product catalog search by name, SKU, or barcode + aisle category filter tabs.
- Cart quantity steppers, item discounts, bill discounts, and clear cart confirmation.
- Multiple payment modes: **Cash** (with PKR denomination quick buttons and auto-change return calculator), **Card**, **Bank Transfer / Online**, and **Store Credit (Khata)**.
- **Concurrency Protection**: ScriptLock concurrency locking ensures zero race conditions or overselling.
- **Thermal Receipt & Invoice Printing**: Automatic layout preview formatted for 58mm/80mm thermal receipt printers and standard A4 invoices.

### 📦 Products & Inventory Management
- Full CRUD catalog with SKU auto-generator and barcode scanner input.
- Real-time stock counts with color-coded badges for Healthy, Low Stock, and Out of Stock.
- **Inventory Movement Audit Trail**: Logs every stock addition, counter deduction, supplier delivery, and manual audit correction.
- **Manual Stock Adjustments**: Adjust stock with recorded reasons (Damaged goods, expired stock, inventory audit correction).
- Low-stock notification bell and dashboard alerts.
- Product deactivation and soft delete.
- Catalog export to CSV.

### 🗂️ Product Categories
- Category organization with real-time product count badges.
- Filter inventory catalog and POS grid by category aisles.

### 🚚 Purchases & Suppliers
- Manage wholesale vendors, distributors, and delivery contacts.
- Multi-item purchase order generation with cost price and quantity inputs.
- **Confirm Delivery Workflow**: Automatically updates product stock levels and logs stock movements upon confirmation.
- Track supplier payments and outstanding credit balances.

### 🧾 Sales & Invoices
- Search and filter completed transactions by date, cashier, payment method, or invoice number.
- Instant reprint of customer receipts and tax invoices.
- **Authorized Returns & Cancellations**: Reverses inventory back into stock automatically, updates ledger, and logs reversal movement.

### 👥 Customer CRM & Store Credit (Khata)
- Customer directory with contact details and credit limits.
- Customer debt ledger for local neighborhood accounts.
- Debt payment settlement modal.

### 💼 Operating Expenses
- Categorized expense recording: Shop Rent, Commercial Electricity & Utilities (LESCO/WAPDA), Staff Wages, Transport & Freight, Packaging Bags, Maintenance, and Miscellaneous.
- Monthly expense summary and CSV export.

### 📈 Financial Reports & Profit Analytics
- Date Range filters (Today, Yesterday, Last 7 Days, Last 30 Days, Custom Range).
- **Accurate Financial Calculations**:
  - **Gross Sales Revenue**: Total completed transactions.
  - **Cost of Goods Sold (COGS)**: Snapshot wholesale cost prices captured at time of sale.
  - **Gross Profit**: `Revenue - COGS`.
  - **Operating Expenses**: Sum of utility bills, rent, and overheads.
  - **Estimated Net Profit**: `Gross Profit - Total Expenses`.
  - **Store Stock Valuation**: Current wholesale inventory value vs potential retail value.
- Visual charts (Recharts): Weekly sales trend area chart, payment method pie chart, expense category breakdown bar chart.
- Export financial reports to CSV.

### ⚙️ Settings & Database Manager
- Store Profile: Name, Tagline, Phone, Address, Currency (`PKR`, `Rs.`), Tax Rate, Receipt Footer message.
- Google Apps Script Integration Manager: Connection tester, live endpoint switcher, and database setup instructions.
- Local Demo Mode fallback: Out-of-the-box local storage loaded with 28 realistic Pakistani and regional grocery items.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 19 with Vite |
| **Styling** | Tailwind CSS v4 |
| **Routing** | React Router v7 |
| **Icons** | Lucide React |
| **Analytics & Charts** | Recharts |
| **Database** | Google Sheets (13 formatted sheets) |
| **Backend API** | Google Apps Script (`doGet` / `doPost` Web App) |
| **Concurrency Control** | Google Apps Script `LockService` |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Local Development Server
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

> [!NOTE]
> Out of the box, the application runs in **Local Demo Mode** pre-seeded with 28 grocery items across 8 categories, sample suppliers, customers, and expenses. You can immediately test the POS, barcode scanner, inventory adjustments, and reports!

### 3. Connect to Google Sheets & Apps Script
Follow the step-by-step instructions in [DEPLOYMENT.md](file:///d:/Programming/Ali/Grocery%20Store%20Management%20System/DEPLOYMENT.md) or open the **Settings & DB** > **Google Sheets Integration** tab inside the app to paste your deployed Google Apps Script Web App URL.

---

## 📁 Project Structure

```
Grocery Store Management System/
├── backend/
│   ├── Code.gs             # Google Apps Script main API router & LockService logic
│   ├── Setup.gs            # Database initializer creating all 13 sheets with formatting
│   ├── SeedData.gs         # 28+ realistic grocery items, suppliers, customers, and expenses
│   ├── appsscript.json     # Manifest file for Web App deployment
│   └── README.md           # Backend setup documentation
├── src/
│   ├── components/
│   │   ├── common/         # Button, Input, Select, Modal, ConfirmDialog, Badge, Card, Table, Pagination, SearchInput
│   │   ├── layout/         # AppLayout, Sidebar, Header
│   │   ├── pos/            # ProductCard, CartItem, PaymentModal, CustomerSelectModal, ReceiptModal
│   │   ├── inventory/      # ProductModal, StockAdjustModal
│   │   └── purchases/      # PurchaseModal
│   ├── context/
│   │   ├── StoreContext.jsx# Global reactive store state, catalog, cart, and cashier
│   │   └── ToastContext.jsx# Notification alerts system
│   ├── pages/
│   │   ├── Dashboard.jsx   # Live KPIs, 7-day sales trend, stock alerts, recent sales
│   │   ├── PosBilling.jsx  # Fast POS register with barcode scanner listener
│   │   ├── Products.jsx    # Inventory catalog, margins, stock status filters
│   │   ├── Categories.jsx  # Category management and product counters
│   │   ├── Inventory.jsx   # Stock movement audit history log
│   │   ├── Purchases.jsx   # Stock purchases & delivery confirmations
│   │   ├── Suppliers.jsx   # Vendor directory & debt payments
│   │   ├── Sales.jsx       # Invoices, reprint receipts, returns & restock
│   │   ├── Customers.jsx   # Customer CRM & Khata credit tracking
│   │   ├── Expenses.jsx    # Operating costs & utility bill recording
│   │   ├── Reports.jsx     # Financial statements, COGS, Net Profit, charts
│   │   └── Settings.jsx    # Store profile & Google Sheets connection hub
│   ├── services/
│   │   ├── api.js          # Unified API router with automatic live/local fallback
│   │   ├── appsScriptService.js # Direct HTTP client for Google Apps Script Web App
│   │   └── mockDataService.js   # Local storage database mirroring all 13 sheets
│   ├── utils/
│   │   ├── barcode.js      # Hardware barcode scanner listener
│   │   ├── exportCsv.js    # CSV downloader utility
│   │   └── formatters.js   # PKR currency, dates, and number formatters
│   ├── App.jsx             # React Router route definitions
│   ├── main.jsx            # React root entrypoint
│   └── index.css           # Tailwind CSS imports & thermal receipt print styles
├── DEPLOYMENT.md           # Step-by-step Google Sheets deployment walkthrough
├── TESTING_CHECKLIST.md    # Comprehensive verification test cases
└── .env.example            # Environment configuration template
```

---

## 📄 License
MIT License. Built for grocery store owners and retail operations.
