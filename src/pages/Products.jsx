import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { ProductModal } from '../components/inventory/ProductModal';
import { StockAdjustModal } from '../components/inventory/StockAdjustModal';
import {
  Package,
  Plus,
  Download,
  Edit,
  ArrowLeftRight,
  AlertTriangle,
  Barcode,
  Layers,
  Trash2,
  CheckCircle2,
  PlusCircle,
  MinusCircle
} from 'lucide-react';

export function Products() {
  const {
    products,
    categories,
    currencySymbol,
    refreshAllData,
    deleteProductOptimistic,
    quickAdjustStock,
  } = useStore();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockFilter, setStockFilter] = useState(
    searchParams.get('filter') === 'low_stock' ? 'LOW_STOCK' : 'ALL'
  );

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState(null);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState(null);

  // Filtered dataset
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Category filter
      if (categoryFilter !== 'ALL' && p.categoryId !== categoryFilter) return false;

      // Stock filter
      const stock = Number(p.currentStock) || 0;
      const minStock = Number(p.minimumStock) || 0;
      if (stockFilter === 'LOW_STOCK' && (stock > minStock || stock <= 0)) return false;
      if (stockFilter === 'OUT_OF_STOCK' && stock > 0) return false;
      if (stockFilter === 'IN_STOCK' && stock <= 0) return false;

      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.includes(q) ||
          p.categoryName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, categoryFilter, stockFilter, search]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize) || 1;
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleOpenAdd = () => {
    setSelectedProductForEdit(null);
    setIsProductModalOpen(true);
  };

  const handleOpenEdit = (prod) => {
    setSelectedProductForEdit(prod);
    setIsProductModalOpen(true);
  };

  const handleOpenAdjust = (prod) => {
    setSelectedProductForStock(prod);
    setIsStockModalOpen(true);
  };

  const handleToggleDeactivate = async (prod) => {
    const isAct = prod.status !== 'INACTIVE';
    const confirmMsg = isAct
      ? `Deactivate "${prod.name}"? It will be hidden from the POS register.`
      : `Re-activate "${prod.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      if (isAct) {
        await api.deleteProduct(prod.productId, false);
        showToast('Product deactivated', 'info');
      } else {
        await api.saveProduct({ ...prod, status: 'ACTIVE' });
        showToast('Product activated', 'success');
      }
      await refreshAllData();
    } catch {
      showToast('Action failed', 'error');
    }
  };

  const handleDeletePermanent = async (prod) => {
    if (!window.confirm(`Permanently delete "${prod.name}" from Google Sheet database? This cannot be undone.`)) {
      return;
    }
    try {
      showToast(`Deleting "${prod.name}"...`, 'info');
      await deleteProductOptimistic(prod.productId, true);
      showToast('Product deleted from Google Sheet', 'success');
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  const handleClearDummyData = () => {
    if (!window.confirm('Remove all dummy items? You will start with an empty catalog ready for your Google Sheet.')) {
      return;
    }
    api.clearAllDummyData();
    refreshAllData();
    showToast('All dummy products removed. Catalog is clean.', 'success');
  };

  const handleExportCsv = () => {
    const headers = [
      { key: 'productId', label: 'Product ID' },
      { key: 'name', label: 'Product Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'barcode', label: 'Barcode' },
      { key: 'categoryName', label: 'Category' },
      { key: 'unit', label: 'Unit' },
      { key: 'costPrice', label: 'Cost Price' },
      { key: 'sellingPrice', label: 'Selling Price' },
      { key: 'currentStock', label: 'Current Stock' },
      { key: 'minimumStock', label: 'Min Stock' },
      { key: 'status', label: 'Status' },
    ];
    exportToCsv('Grocery_Inventory_Catalog', headers, filteredProducts);
  };

  const columns = [
    {
      header: 'Product Name & SKU',
      key: 'name',
      render: (row) => (
        <div className="min-w-[200px]">
          <div className="font-bold text-slate-900 leading-snug">{row.name}</div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
            <span>{row.sku}</span>
            {row.barcode && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Barcode className="w-3 h-3 text-slate-400" />
                  {row.barcode}
                </span>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'categoryName',
      render: (row) => (
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
          {row.categoryName || 'General'}
        </span>
      ),
    },
    {
      header: 'Cost Price',
      key: 'costPrice',
      render: (row) => (
        <span className="text-xs text-slate-600 font-medium">
          {formatCurrency(row.costPrice, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Selling Price',
      key: 'sellingPrice',
      render: (row) => (
        <div>
          <span className="font-bold text-slate-900">
            {formatCurrency(row.sellingPrice, currencySymbol)}
          </span>
          <span className="text-[10px] text-slate-400 ml-1">/ {row.unit}</span>
        </div>
      ),
    },
    {
      header: 'Stock on Hand',
      key: 'currentStock',
      render: (row) => {
        const stock = Number(row.currentStock) || 0;
        const minStock = Number(row.minimumStock) || 0;

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              {stock <= 0 ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                  🔴 Out of Stock ({stock})
                </span>
              ) : stock <= minStock ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                  ⚠️ Low: {stock} {row.unit}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                  📦 {stock} {row.unit}
                </span>
              )}
            </div>

            {/* Quick 1-Click Stepper Buttons directly on table */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, 1)}
                className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 rounded transition-colors"
                title="Quick add +1 to stock"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, 5)}
                className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 rounded transition-colors"
                title="Quick add +5 to stock"
              >
                +5
              </button>
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, -1)}
                className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-rose-100 hover:text-rose-800 text-slate-700 rounded transition-colors"
                title="Quick subtract -1 from stock"
              >
                -1
              </button>
            </div>
          </div>
        );
      },
    },
    {
      header: 'Status',
      key: 'status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : 'neutral'} size="xs">
          {row.status || 'ACTIVE'}
        </Badge>
      ),
    },
    {
      header: 'Actions',
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAdjust(row)}
            icon={ArrowLeftRight}
            title="Adjust inventory stock audit"
            className="px-2 py-1 text-xs"
          >
            Audit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            icon={Edit}
            title="Edit product"
            className="px-2 py-1 text-xs"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleDeactivate(row)}
            title={row.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}
            className="text-slate-400 hover:text-slate-700 px-2 py-1 text-xs"
          >
            {row.status === 'ACTIVE' ? 'Deactivate' : 'Restore'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePermanent(row)}
            icon={Trash2}
            title="Permanently delete from Google Sheet"
            className="text-slate-400 hover:text-rose-600 px-1.5 py-1 text-xs"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Product & Inventory Catalog
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your store's products, barcode tags, selling prices, and stock counts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="md"
            icon={Trash2}
            onClick={handleClearDummyData}
            className="text-rose-700 hover:bg-rose-50 border-rose-200 text-xs font-semibold"
            title="Remove all sample products to start with empty catalog"
          >
            Clear Dummy Data
          </Button>
          <Button
            variant="outline"
            size="md"
            icon={Download}
            onClick={handleExportCsv}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={Plus}
            onClick={handleOpenAdd}
            className="font-bold shadow-sm"
          >
            Add Product
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search product by title, SKU or barcode..."
          className="flex-1 w-full"
        />

        <div className="flex items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Filter */}
          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">All Stock Levels</option>
            <option value="LOW_STOCK">Low Stock Only</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="IN_STOCK">In Stock</option>
          </select>
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedProducts}
          keyField="productId"
          emptyMessage="No products match your filter criteria."
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredProducts.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        product={selectedProductForEdit}
      />

      <StockAdjustModal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        product={selectedProductForStock}
      />
    </div>
  );
}
