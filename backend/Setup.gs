/**
 * Grocery Store Management System - Database Initialization
 * Run this function once from the Google Apps Script Editor:
 * Select "setupDatabase" in the toolbar and click "Run".
 */

function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet schemas: Name -> Array of Column Headers
  const schemas = {
    Products: [
      'productId', 'name', 'sku', 'barcode', 'categoryId', 'unit', 
      'costPrice', 'sellingPrice', 'currentStock', 'minimumStock', 
      'expiryDate', 'status', 'createdAt', 'updatedAt'
    ],
    Categories: [
      'categoryId', 'name', 'description', 'status', 'createdAt', 'updatedAt'
    ],
    Sales: [
      'saleId', 'invoiceNumber', 'date', 'cashierId', 'cashierName', 
      'customerId', 'customerName', 'subtotal', 'discount', 'tax', 
      'total', 'amountPaid', 'change', 'paymentMethod', 'paymentStatus', 
      'status', 'notes', 'createdAt'
    ],
    SaleItems: [
      'saleItemId', 'saleId', 'productId', 'productName', 'quantity', 
      'unit', 'unitPrice', 'unitCost', 'discount', 'lineTotal', 'createdAt'
    ],
    Purchases: [
      'purchaseId', 'purchaseNumber', 'date', 'supplierId', 'supplierName', 
      'subtotal', 'tax', 'total', 'amountPaid', 'outstandingBalance', 
      'status', 'notes', 'createdAt'
    ],
    PurchaseItems: [
      'purchaseItemId', 'purchaseId', 'productId', 'productName', 
      'quantity', 'unitCost', 'lineTotal', 'createdAt'
    ],
    Suppliers: [
      'supplierId', 'name', 'contactPerson', 'phone', 'email', 
      'address', 'outstandingBalance', 'status', 'createdAt', 'updatedAt'
    ],
    Customers: [
      'customerId', 'name', 'phone', 'email', 'address', 
      'outstandingBalance', 'creditLimit', 'status', 'notes', 'createdAt', 'updatedAt'
    ],
    Expenses: [
      'expenseId', 'title', 'category', 'amount', 'date', 
      'paymentMethod', 'reference', 'notes', 'createdBy', 'createdAt'
    ],
    StockMovements: [
      'movementId', 'productId', 'movementType', 'quantity', 
      'previousStock', 'newStock', 'referenceType', 'referenceId', 
      'reason', 'createdBy', 'createdAt'
    ],
    Users: [
      'userId', 'username', 'fullName', 'role', 'email', 
      'passwordHash', 'status', 'createdAt'
    ],
    Settings: [
      'key', 'value', 'description', 'updatedAt'
    ],
    AuditLogs: [
      'logId', 'timestamp', 'userId', 'userName', 'action', 
      'entity', 'entityId', 'details'
    ]
  };

  const headerBgColor = '#065F46'; // Professional emerald green
  const headerFontColor = '#FFFFFF';

  for (const [sheetName, headers] of Object.entries(schemas)) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // Set headers in row 1
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setBackground(headerBgColor);
    headerRange.setFontColor(headerFontColor);
    headerRange.setFontWeight('bold');
    headerRange.setFontFamily('Arial');
    sheet.setFrozenRows(1);

    // Auto resize columns
    sheet.autoResizeColumns(1, headers.length);
  }

  // Remove default 'Sheet1' if it exists and is empty
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && defaultSheet.getLastRow() === 0 && ss.getSheets().length > 1) {
    try {
      ss.deleteSheet(defaultSheet);
    } catch (e) {
      // Ignore if cannot delete
    }
  }

  // Populate default Settings if empty
  const settingsSheet = ss.getSheetByName('Settings');
  if (settingsSheet && settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['storeName', 'Bismillah Grocery & Supermarket', 'Store Trading Name', new Date().toISOString()],
      ['tagline', 'Quality Fresh Groceries & Everyday Essentials', 'Store Subtitle', new Date().toISOString()],
      ['phone', '+92 300 1234567', 'Contact phone number', new Date().toISOString()],
      ['address', 'Shop # 12, Commercial Market, Main Boulevard, Lahore', 'Physical store location', new Date().toISOString()],
      ['currency', 'PKR', 'ISO Currency Code', new Date().toISOString()],
      ['currencySymbol', 'Rs.', 'Display Currency Symbol', new Date().toISOString()],
      ['taxRate', '0', 'Sales Tax Percentage', new Date().toISOString()],
      ['allowNegativeStock', 'false', 'Allow selling items below zero inventory', new Date().toISOString()],
      ['lowStockDefaultThreshold', '5', 'Default minimum stock alert threshold', new Date().toISOString()],
      ['receiptType', 'thermal80', 'Receipt print format (thermal58, thermal80, a4)', new Date().toISOString()],
      ['receiptFooter', 'Thank you for shopping with us! Freshness Guaranteed.', 'Receipt bottom note', new Date().toISOString()]
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 4).setValues(defaultSettings);
  }

  // Populate default Admin User if empty
  const usersSheet = ss.getSheetByName('Users');
  if (usersSheet && usersSheet.getLastRow() <= 1) {
    const defaultUser = [
      ['USR-ADMIN', 'admin', 'Store Manager', 'ADMIN', 'admin@grocery.local', 'sha256_mock_hash', 'ACTIVE', new Date().toISOString()],
      ['USR-CASHIER', 'cashier1', 'Primary Cashier', 'CASHIER', 'cashier@grocery.local', 'sha256_mock_hash', 'ACTIVE', new Date().toISOString()]
    ];
    usersSheet.getRange(2, 1, defaultUser.length, 8).setValues(defaultUser);
  }

  // Populate default Walk-in Customer
  const custSheet = ss.getSheetByName('Customers');
  if (custSheet && custSheet.getLastRow() <= 1) {
    const defaultCustomer = [
      ['WALK-IN', 'Walk-in Customer', '0000000000', '', 'Counter Sales', 0, 0, 'ACTIVE', 'Default customer for cash sales', new Date().toISOString(), new Date().toISOString()]
    ];
    custSheet.getRange(2, 1, defaultCustomer.length, 11).setValues(defaultCustomer);
  }

  Logger.log('Setup completed successfully! 13 sheets initialized.');
  return { success: true, message: 'Database setup completed successfully! 13 sheets initialized with headers and default configurations.' };
}
