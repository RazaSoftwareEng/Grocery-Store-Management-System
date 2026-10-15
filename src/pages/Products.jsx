import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/formatters';
import { exportToCsv } from '../utils/exportCsv';
import { Table } from '../components/common/Table';
import { Pagination } from '../components/common/Pagination';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { SearchInput } from '../components/common/SearchInput';
import { PageHeader } from '../components/common/Card';
import { ProductModal } from '../components/inventory/ProductModal';
import { StockAdjustModal } from '../components/inventory/StockAdjustModal';
import {
  Plus,
  Download,
  Edit,
  ArrowLeftRight,
  Barcode,
  Trash2,
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
  const confirm = useConfirm();
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
      ? 'It will be hidden from the POS register until you re-activate it.'
      : 'It will show up in the POS register again.';

    if (!(await confirm({ title: isAct ? `Deactivate "${prod.name}"?` : `Re-activate "${prod.name}"?`, message: confirmMsg, confirmText: isAct ? 'Deactivate' : 'Re-activate', tone: isAct ? 'warning' : 'info' }))) return;

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
    if (!(await confirm({ title: `Delete "${prod.name}"?`, message: 'The product is removed permanently. Past sales keep their records. This cannot be undone.', confirmText: 'Delete product', tone: 'danger' }))) {
      return;
    }
    try {
      showToast(`Deleting "${prod.name}"...`, 'info');
      await deleteProductOptimistic(prod.productId, true);
      showToast(`"${prod.name}" deleted`, 'success');
    } catch {
      showToast('Failed to delete product', 'error');
    }
  };

  const handleClearDummyData = async () => {
    if (!(await confirm({ title: 'Remove all sample products?', message: 'You will start with an empty catalog. This cannot be undone.', confirmText: 'Remove samples', tone: 'danger' }))) {
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

  const stepBtn =
    'h-6 min-w-7 px-1.5 text-xs font-medium tabular rounded-md border border-slate-200 bg-white text-slate-600 transition-colors';

  const columns = [
    {
      header: 'Product',
      key: 'name',
      render: (row) => (
        <div className="min-w-[200px]">
          <div className="font-medium text-slate-900 leading-snug">{row.name}</div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono">
            <span>{row.sku}</span>
            {row.barcode && (
              <span className="flex items-center gap-1">
                <Barcode className="w-3 h-3 text-slate-400" />
                {row.barcode}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Category',
      key: 'categoryName',
      render: (row) => <span className="text-[13px] text-slate-600">{row.categoryName || 'General'}</span>,
    },
    {
      header: 'Cost',
      key: 'costPrice',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <span className="text-[13px] text-slate-500 tabular">{formatCurrency(row.costPrice, currencySymbol)}</span>
      ),
    },
    {
      header: 'Price',
      key: 'sellingPrice',
      headerClassName: 'text-right',
      className: 'text-right',
      render: (row) => (
        <div className="tabular">
          <span className="font-semibold text-slate-900">{formatCurrency(row.sellingPrice, currencySymbol)}</span>
          <span className="text-xs text-slate-400 ml-1">/ {row.unit}</span>
        </div>
      ),
    },
    {
      header: 'Stock',
      key: 'currentStock',
      render: (row) => {
        const stock = Number(row.currentStock) || 0;
        const minStock = Number(row.minimumStock) || 0;
        const variant = stock <= 0 ? 'danger' : stock <= minStock ? 'warning' : 'success';
        const label = stock <= 0 ? 'Out of stock' : `${stock} ${row.unit}${stock <= minStock ? ' · low' : ''}`;

        return (
          <div className="flex items-center gap-2">
            <Badge variant={variant} size="xs" className="tabular min-w-[92px]">
              {label}
            </Badge>
            <div className="flex items-center gap-1 opacity-60 hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, -1)}
                className={`${stepBtn} hover:border-rose-300 hover:text-rose-700`}
                title="Remove 1 from stock"
                aria-label={`Remove 1 ${row.name}`}
              >
                −1
              </button>
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, 1)}
                className={`${stepBtn} hover:border-brand-300 hover:text-brand-700`}
                title="Add 1 to stock"
                aria-label={`Add 1 ${row.name}`}
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => quickAdjustStock(row.productId, 5)}
                className={`${stepBtn} hover:border-brand-300 hover:text-brand-700`}
                title="Add 5 to stock"
                aria-label={`Add 5 ${row.name}`}
              >
                +5
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
      header: <span className="sr-only">Actions</span>,
      key: 'actions',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenAdjust(row)}
            icon={ArrowLeftRight}
            title="Adjust stock"
          >
            Adjust
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleOpenEdit(row)}
            icon={Edit}
            title="Edit product"
            aria-label={`Edit ${row.name}`}
            className="w-[30px] px-0"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleDeactivate(row)}
            title={row.status === 'ACTIVE' ? 'Hide from POS' : 'Show in POS again'}
          >
            {row.status === 'ACTIVE' ? 'Deactivate' : 'Restore'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeletePermanent(row)}
            icon={Trash2}
            title="Delete product"
            aria-label={`Delete ${row.name}`}
            className="w-[30px] px-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
          />
        </div>
      ),
    },
  ];

  const filterSelect =
    'h-[38px] pl-3 pr-9 text-[13px] bg-white border border-slate-300 rounded-xl text-slate-700 hover:border-slate-400 focus:outline-none focus:border-brand-600 focus:ring-[3px] focus:ring-brand-600/20 appearance-none cursor-pointer ' +
    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%236e7370' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m4 6 4 4 4-4'/%3E%3C/svg%3E\")] bg-no-repeat bg-[position:right_10px_center]";

  const hasFilters = search || categoryFilter !== 'ALL' || stockFilter !== 'ALL';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Products"
        description={`${products.length} items in your catalog`}
        actions={
          <>
            <Button
              variant="ghost"
              icon={Trash2}
              onClick={handleClearDummyData}
              className="text-slate-500 hover:text-rose-700 hover:bg-rose-50"
              title="Remove all sample products"
            >
              Clear samples
            </Button>
            <Button variant="secondary" icon={Download} onClick={handleExportCsv}>
              Export
            </Button>
            <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
              Add product
            </Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setCurrentPage(1);
          }}
          placeholder="Search by name, SKU or barcode"
          className="flex-1 w-full md:max-w-md"
        />

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by category"
            className={filterSelect}
          >
            <option value="ALL">All categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by stock level"
            className={filterSelect}
          >
            <option value="ALL">All stock levels</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="IN_STOCK">In stock</option>
          </select>

          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
                setStockFilter('ALL');
                setCurrentPage(1);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Products Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <Table
          columns={columns}
          data={paginatedProducts}
          keyField="productId"
          emptyMessage={hasFilters ? 'No products match these filters' : 'No products yet'}
          emptyDescription={hasFilters ? 'Try a different search or clear the filters.' : 'Add your first product to start selling.'}
          emptyAction={!hasFilters && <Button size="sm" icon={Plus} onClick={handleOpenAdd}>Add product</Button>}
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
