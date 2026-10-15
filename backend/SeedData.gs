/**
 * Grocery Store Management System - Realistic Seed Data
 * Optional helper script to populate realistic grocery data into your Google Sheets.
 */

function seedDemoData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Make sure tables are initialized
  setupDatabase();

  const now = new Date().toISOString();

  // 1. Categories
  const categories = [
    ['CAT-GRAINS', 'Grains, Rice & Flour', 'Basmati rice, wheat flour, pulses and lentils', 'ACTIVE', now, now],
    ['CAT-OIL', 'Cooking Oils & Ghee', 'Canola oil, sunflower oil, vegetable ghee, olive oil', 'ACTIVE', now, now],
    ['CAT-DAIRY', 'Dairy & Eggs', 'Milk, butter, yogurt, cheeses, farm fresh eggs', 'ACTIVE', now, now],
    ['CAT-SPICES', 'Spices & Seasonings', 'Whole spices, ground masala, salt, recipe mixes', 'ACTIVE', now, now],
    ['CAT-BEV', 'Beverages & Tea', 'Black tea, green tea, cold drinks, juices, mineral water', 'ACTIVE', now, now],
    ['CAT-SNACKS', 'Snacks & Biscuits', 'Chips, cookies, chocolates, wafers, rusks', 'ACTIVE', now, now],
    ['CAT-BAKERY', 'Bakery & Bread', 'Sliced bread, buns, pita, cakes, morning rusks', 'ACTIVE', now, now],
    ['CAT-HYGIENE', 'Personal & Home Care', 'Soaps, detergents, dishwashers, shampoo, tissues', 'ACTIVE', now, now]
  ];

  const catSheet = ss.getSheetByName('Categories');
  if (catSheet.getLastRow() <= 1) {
    catSheet.getRange(2, 1, categories.length, 6).setValues(categories);
  }

  // 2. Suppliers
  const suppliers = [
    ['SUPP-METRO', 'National Wholesale Distributors', 'Haji Farooq', '+92 301 5551122', 'farooq@natdist.pk', 'Badami Bagh Wholesale Market, Lahore', 15000, 'ACTIVE', now, now],
    ['SUPP-ENGRO', 'Engro Foods Supply Corp', 'Salman Tariq', '+92 321 8884433', 'salman@engrofoods.com', 'Ferozepur Road Industrial Area, Lahore', 0, 'ACTIVE', now, now],
    ['SUPP-SHAN', 'Shan & Tapal Direct Agency', 'Imran Butt', '+92 333 4447788', 'imran@spicetraders.pk', 'Shah Alam Market, Lahore', 8500, 'ACTIVE', now, now],
    ['SUPP-UNILEVER', 'Unilever & FMCG Distribution Hub', 'Kashif Mehmood', '+92 312 9993322', 'kashif@fmcghub.pk', 'Multan Road Distribution Center, Lahore', 0, 'ACTIVE', now, now]
  ];

  const suppSheet = ss.getSheetByName('Suppliers');
  if (suppSheet.getLastRow() <= 1) {
    suppSheet.getRange(2, 1, suppliers.length, 10).setValues(suppliers);
  }

  // 3. Customers
  const customers = [
    ['CUST-1001', 'Muhammad Usman', '+92 300 9876543', 'usman@gmail.com', 'House 45, Street 8, Sector C', 2450, 15000, 'ACTIVE', 'Regular neighborhood customer', now, now],
    ['CUST-1002', 'Dr. Tariq Mahmood', '+92 321 4567890', 'tariq.doc@yahoo.com', 'House 12-A, Main Avenue', 0, 20000, 'ACTIVE', 'Always pays by credit card', now, now],
    ['CUST-1003', 'Mrs. Rashida Begum', '+92 333 1122334', '', 'Flat 302, Green Heights', 1200, 10000, 'ACTIVE', 'Monthly grocery buyer', now, now],
    ['CUST-1004', 'Ali Raza', '+92 345 6677889', 'ali.raza@outlook.com', 'Shop 4, Commercial Market', 0, 5000, 'ACTIVE', 'Local shop assistant', now, now]
  ];

  const custSheet = ss.getSheetByName('Customers');
  if (custSheet.getLastRow() <= 2) { // 1 header + 1 walk-in
    custSheet.getRange(custSheet.getLastRow() + 1, 1, customers.length, 11).setValues(customers);
  }

  // 4. Products (Name, SKU, Barcode, Cat, Unit, CostPrice, SellingPrice, CurrentStock, MinStock, Expiry)
  const products = [
    // Grains & Flours
    ['PROD-RICE-01', 'Super Kernel Basmati Rice 5kg', 'SKU-RICE-5K', '896400010011', 'CAT-GRAINS', 'packet', 1350, 1650, 35, 10, '2027-12-31', 'ACTIVE', now, now],
    ['PROD-FLOUR-01', 'Sunridge Chakki Atta 10kg', 'SKU-ATTA-10K', '896400010028', 'CAT-GRAINS', 'packet', 1280, 1420, 24, 8, '2027-06-30', 'ACTIVE', now, now],
    ['PROD-DAAL-01', 'Daal Chana Premium 1kg', 'SKU-DAAL-CH', '896400010035', 'CAT-GRAINS', 'kg', 240, 290, 45, 15, '2027-12-31', 'ACTIVE', now, now],
    ['PROD-DAAL-02', 'Daal Masoor Washed 1kg', 'SKU-DAAL-MS', '896400010042', 'CAT-GRAINS', 'kg', 280, 340, 30, 10, '2027-12-31', 'ACTIVE', now, now],
    ['PROD-SUGAR-01', 'Refined White Sugar 1kg', 'SKU-SUGAR-1K', '896400010059', 'CAT-GRAINS', 'kg', 135, 155, 120, 25, '', 'ACTIVE', now, now],
    
    // Cooking Oils
    ['PROD-OIL-01', 'Dalda Cooking Oil Pouch 1L', 'SKU-DALDA-1L', '896400020010', 'CAT-OIL', 'packet', 490, 545, 40, 12, '2027-08-31', 'ACTIVE', now, now],
    ['PROD-OIL-02', 'Sufi Canola Cooking Oil 5L Bottle', 'SKU-SUFI-5L', '896400020027', 'CAT-OIL', 'bottle', 2450, 2750, 18, 5, '2027-09-30', 'ACTIVE', now, now],
    ['PROD-GHEE-01', 'Habib Banaspati Ghee 1kg Tin', 'SKU-HABIB-1K', '896400020034', 'CAT-OIL', 'packet', 485, 535, 22, 6, '2027-11-30', 'ACTIVE', now, now],

    // Dairy & Eggs
    ['PROD-MILK-01', 'Olper\'s Full Cream Milk 1L', 'SKU-OLP-1L', '896400030019', 'CAT-DAIRY', 'packet', 280, 310, 60, 20, '2027-04-15', 'ACTIVE', now, now],
    ['PROD-MILK-02', 'MilkPak UHT Milk 1L Tetra', 'SKU-MPK-1L', '896400030026', 'CAT-DAIRY', 'packet', 285, 315, 48, 15, '2027-04-20', 'ACTIVE', now, now],
    ['PROD-EGGS-01', 'Farm Fresh White Eggs (Dozen)', 'SKU-EGG-DOZ', '896400030033', 'CAT-DAIRY', 'carton', 280, 330, 25, 8, '2026-11-15', 'ACTIVE', now, now],
    ['PROD-BUTTER-01', 'Nurpur Butter 200g', 'SKU-NUR-200G', '896400030040', 'CAT-DAIRY', 'packet', 320, 370, 15, 6, '2027-03-31', 'ACTIVE', now, now],
    ['PROD-YOGURT-01', 'Nestle Sweet Yogurt 400g Cup', 'SKU-NES-YOG', '896400030057', 'CAT-DAIRY', 'cup', 140, 170, 3, 10, '2026-10-25', 'ACTIVE', now, now], // Low stock alert demo

    // Spices & Seasonings
    ['PROD-TEA-01', 'Tapal Danedar Tea 450g Pouch', 'SKU-TAP-450G', '896400040018', 'CAT-BEV', 'packet', 620, 695, 30, 10, '2027-12-31', 'ACTIVE', now, now],
    ['PROD-TEA-02', 'Lipton Yellow Label Tea 400g', 'SKU-LIP-400G', '896400040025', 'CAT-BEV', 'packet', 610, 680, 22, 8, '2027-12-31', 'ACTIVE', now, now],
    ['PROD-SPICE-01', 'Shan Bombay Biryani Masala 50g', 'SKU-SHAN-BIR', '896400050017', 'CAT-SPICES', 'packet', 95, 120, 65, 20, '2028-01-31', 'ACTIVE', now, now],
    ['PROD-SPICE-02', 'National Korma Masala 45g', 'SKU-NAT-KOR', '896400050024', 'CAT-SPICES', 'packet', 90, 115, 45, 15, '2028-01-31', 'ACTIVE', now, now],
    ['PROD-SALT-01', 'National Iodized Salt 800g', 'SKU-NAT-SALT', '896400050031', 'CAT-SPICES', 'packet', 50, 70, 80, 20, '', 'ACTIVE', now, now],

    // Beverages
    ['PROD-BEV-01', 'Rooh Afza Syrup 800ml Bottle', 'SKU-ROOH-800', '896400060016', 'CAT-BEV', 'bottle', 380, 440, 18, 6, '2028-06-30', 'ACTIVE', now, now],
    ['PROD-BEV-02', 'Nestle Pure Life Water 1.5L', 'SKU-WAT-1.5L', '896400060023', 'CAT-BEV', 'bottle', 85, 110, 70, 25, '2027-10-31', 'ACTIVE', now, now],
    ['PROD-BEV-03', 'Coca-Cola Regular 1.5L Bottle', 'SKU-COKE-1.5', '896400060030', 'CAT-BEV', 'bottle', 160, 190, 36, 12, '2027-04-30', 'ACTIVE', now, now],

    // Snacks & Biscuits
    ['PROD-SNACK-01', 'Lays Masala Chips Large 65g', 'SKU-LAYS-MAS', '896400070015', 'CAT-SNACKS', 'packet', 85, 100, 50, 15, '2027-02-28', 'ACTIVE', now, now],
    ['PROD-SNACK-02', 'LU Prince Chocolate Biscuits Half Roll', 'SKU-LU-PRN', '896400070022', 'CAT-SNACKS', 'packet', 42, 50, 60, 20, '2027-05-31', 'ACTIVE', now, now],
    ['PROD-SNACK-03', 'Peek Freans Sooper Biscuits Half Roll', 'SKU-SOOPER', '896400070039', 'CAT-SNACKS', 'packet', 42, 50, 75, 20, '2027-05-31', 'ACTIVE', now, now],

    // Bakery
    ['PROD-BAKE-01', 'Dawn Plain Bread Large 700g', 'SKU-DWN-BRD', '896400080014', 'CAT-BAKERY', 'piece', 185, 220, 14, 5, '2026-10-18', 'ACTIVE', now, now],
    ['PROD-BAKE-02', 'Dawn Milky Bread Large', 'SKU-DWN-MLK', '896400080021', 'CAT-BAKERY', 'piece', 195, 230, 2, 6, '2026-10-18', 'ACTIVE', now, now], // Low stock demo

    // Hygiene & Personal Care
    ['PROD-SOAP-01', 'Dettol Soap Original 135g', 'SKU-DET-SOAP', '896400090013', 'CAT-HYGIENE', 'piece', 135, 160, 45, 10, '2028-09-30', 'ACTIVE', now, now],
    ['PROD-SURF-01', 'Surf Excel Washing Powder 1kg Pouch', 'SKU-SURF-1K', '896400090020', 'CAT-HYGIENE', 'packet', 580, 670, 20, 8, '2028-12-31', 'ACTIVE', now, now],
    ['PROD-DISH-01', 'Vim Dishwashing Bar 300g', 'SKU-VIM-300G', '896400090037', 'CAT-HYGIENE', 'piece', 80, 100, 35, 10, '2028-12-31', 'ACTIVE', now, now]
  ];

  const prodSheet = ss.getSheetByName('Products');
  if (prodSheet.getLastRow() <= 1) {
    prodSheet.getRange(2, 1, products.length, 14).setValues(products);

    // Initial stock movements
    const movements = products.map(p => [
      'MOV-' + Utilities.getUuid().slice(0, 8),
      p[0], // productId
      'INITIAL_STOCK',
      p[8], // quantity
      0,    // previousStock
      p[8], // newStock
      'MANUAL',
      p[0],
      'Initial stock setup',
      'System Admin',
      now
    ]);

    const movSheet = ss.getSheetByName('StockMovements');
    if (movSheet.getLastRow() <= 1) {
      movSheet.getRange(2, 1, movements.length, 11).setValues(movements);
    }
  }

  // 5. Initial Sample Expenses
  const expenses = [
    ['EXP-101', 'Shop Monthly Rent - Advance', 'RENT', 45000, now.slice(0, 10), 'BANK_TRANSFER', 'TXN-998822', 'Commercial Shop 12', 'Admin', now],
    ['EXP-102', 'Commercial Electricity Bill (LESCO)', 'ELECTRICITY', 14200, now.slice(0, 10), 'ONLINE', 'LESCO-44331', 'Month of Sep/Oct', 'Admin', now],
    ['EXP-103', 'Store Assistant Helper Daily Wage', 'SALARIES', 1200, now.slice(0, 10), 'CASH', '', 'Daily counter help', 'Admin', now],
    ['EXP-104', 'Packaging Bags & Receipt Rolls', 'MISCELLANEOUS', 2500, now.slice(0, 10), 'CASH', 'INV-BAGS-4', 'Biodegradable carrier bags', 'Admin', now]
  ];

  const expSheet = ss.getSheetByName('Expenses');
  if (expSheet.getLastRow() <= 1) {
    expSheet.getRange(2, 1, expenses.length, 10).setValues(expenses);
  }

  Logger.log('Demo data seeded successfully with realistic grocery inventory!');
  return { success: true, message: 'Demo data seeded successfully with 28 grocery products, 8 categories, suppliers, customers, and expenses.' };
}
