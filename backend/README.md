# Google Apps Script Backend Guide

This directory contains the complete backend for the **Grocery Store Management System**. It uses Google Sheets as the relational database and Google Apps Script as the serverless REST API.

---

## 📁 Files in this Directory

- `Code.gs`: The primary API router with `doGet` and `doPost` handlers, LockService concurrency locking, stock deduction, sequential invoice generation, and financial reports.
- `Setup.gs`: The one-click database initialisation script that builds all 13 sheets with formatted headers, styles, and initial settings.
- `SeedData.gs`: Populates 28+ realistic grocery store products across 8 categories, plus suppliers, customers, and expenses.
- `appsscript.json`: Project manifest specifying execution timezone and Web App deployment permissions.

---

## 🚀 Step-by-Step Google Sheets & Apps Script Setup

### Step 1: Create a New Google Spreadsheet
1. Go to [Google Sheets](https://sheets.new) in your browser.
2. Rename the spreadsheet to: `Grocery Store Database`.

### Step 2: Open the Apps Script Editor
1. In Google Sheets, click on the top menu: **Extensions** > **Apps Script**.
2. A new tab will open with the code editor. Rename the project to `Grocery Store API`.

### Step 3: Copy the Code Files
1. In the Apps Script editor, open the existing `Code.gs` file.
2. Select all and replace its contents with the code from [`backend/Code.gs`](file:///d:/Programming/Ali/Grocery%20Store%20Management%20System/backend/Code.gs).
3. Click the **+** (Add a file) icon next to *Files* on the left panel, choose **Script**, and name it `Setup`.
4. Paste the contents of [`backend/Setup.gs`](file:///d:/Programming/Ali/Grocery%20Store%20Management%20System/backend/Setup.gs) into it.
5. Click the **+** icon again, choose **Script**, and name it `SeedData`.
6. Paste the contents of [`backend/SeedData.gs`](file:///d:/Programming/Ali/Grocery%20Store%20Management%20System/backend/SeedData.gs) into it.
7. Click the **Save** floppy disk icon (or press `Ctrl + S`).

### Step 4: Run Initial Setup
1. In the top toolbar of Apps Script, find the function dropdown (where it says `myFunction` or `doGet`).
2. Select **`setupDatabase`**.
3. Click the **Run** button.
4. Google will prompt: *"Authorization required"*. Click **Review permissions**.
5. Select your Google account.
6. Click **Advanced** > **Go to Grocery Store API (unsafe)** > Click **Allow**.
7. In the execution log, you should see:
   `Setup completed successfully! 13 sheets initialized.`
8. *(Optional)* To populate sample grocery products immediately, select **`seedDemoData`** in the dropdown and click **Run**.
9. Switch back to your Google Spreadsheet tab — you will see all 13 formatted sheets created with emerald green headers!

### Step 5: Deploy as Web App
1. At the top right of the Apps Script window, click the blue **Deploy** button > **New deployment**.
2. Click the gear icon ⚙️ next to *Select type* and choose **Web app**.
3. Fill in the deployment details:
   - **Description**: `Grocery Store API Production v1`
   - **Execute as**: **Me (your-email@gmail.com)** *(MANDATORY: so the script has permission to write to your spreadsheet)*
   - **Who has access**: **Anyone** *(MANDATORY: so the React frontend can send requests without Google login popups)*
4. Click **Deploy**.
5. Copy the generated **Web app URL** (it looks like `https://script.google.com/macros/s/AKfycbx.../exec`).

### Step 6: Connect to React Frontend
You can connect your Google Sheet in either of two ways:
1. **Via `.env` file**:
   Create a `.env` file in the root folder with:
   ```env
   VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
   ```
2. **Via the App Settings Page**:
   Open the application in your browser, go to **Settings** > **Google Sheets Integration**, paste the Web App URL, and click **Test Connection** & **Save**.

---

## 🔒 Security & Concurrency Design

- **`LockService.getScriptLock()`**: Used on all checkout, purchase, and stock adjustments. This queues incoming requests for up to 30 seconds to prevent race conditions (such as two cashiers scanning the last packet of rice simultaneously).
- **Snapshot Cost Accounting**: Each sale item saves the exact `costPrice` at the time of transaction. Even if supplier prices change tomorrow, your historical Gross Profit and COGS reports remain 100% accurate.
- **Idempotency & Reversals**: Sales can never be deleted from the database. Cancelled sales are marked as `CANCELLED` and reverse stock automatically with logged `SALE_RETURN` movements.
