// src/pages/master-admin/InventoryManagement.jsx
import React, { useEffect, useState, useRef, useMemo } from "react";
import AdminSidebar from "../../components/MasterAdminSidebar";

import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import { getToken } from "../../lib/auth";
import {
  FiBox,
  FiPlus,
  FiUpload,
  FiDownload,
  FiX,
  FiLoader,
  FiFileText,
  FiAlertCircle,
  FiCheckCircle,
  FiRefreshCw,
  FiPackage,
  FiChevronDown,
  FiChevronUp,
  FiTrendingUp,
  FiHash,
  FiHome,
  FiActivity,
  FiCircle,
  FiClock,
  FiInfo,
  FiCheck,
  FiEdit3,
  FiBarChart2,
  FiAlertTriangle,
  FiCalendar,
  FiTrash2,
  FiArrowLeft,
  FiSearch,
  FiTag, // Added for Category
  FiMapPin, // Added for Plant
  FiLayers, // Added for Products overall
  FiDollarSign, // Added for MRP/Price
  FiPercent, // Added for GST
  FiShoppingBag, // Added for DB/RSS sections
  FiDatabase, // Added for Stock
} from "react-icons/fi";

/* ---------- API Helper - FIXED CLOSING BRACES ---------- */
async function apiRequest(path, { method = "GET", body = null } = {}) {
  const headers = {};
  const localToken = getToken();
  if (localToken) headers["Authorization"] = `Bearer ${localToken}`;

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isForm) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(`${API_HOST}${API_BASE}${path}`, {
      method,
      headers,
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    const err = new Error("Network error");
    err.body = networkErr;
    throw err;
  }
  /* The original error from the previous turn (missing a final closing brace for catch) is fixed here. */

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  } 

  if (!res.ok) {
    const msg = data?.detail || data?.message || data || res.statusText || `Request failed: ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = data;
    throw err;
  } 

  return data;
}

export default function InventoryManagement() {
  const { token } = useAuth(); // Assume useAuth provides token
  const toast = useToast(); // Assume useToast is available

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlant, setSelectedPlant] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Selection states
  const [selectedIds, setSelectedIds] = useState([]);
  const [deleting, setDeleting] = useState(false);

  // Modal states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Stock modal states
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productStock, setProductStock] = useState([]);
  const [loadingStock, setLoadingStock] = useState(false);
  const [allStockData, setAllStockData] = useState([]); // To store all stock data

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    lowStock: 0,
    outOfStock: 0,
  });

  /* ---------- Load Data (FIXED SYNTAX ERROR) ---------- */
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const productsData = await apiRequest("/v2/products/", { method: "GET" });
        const stockData = await apiRequest("/v2/stock/", { method: "GET" });

        if (!mounted) return;

        const prods = Array.isArray(productsData) ? productsData : [];
        const stocks = Array.isArray(stockData) ? stockData : [];
        
        setProducts(prods);
        setAllStockData(stocks);

        // Calculate stats
        const total = prods.length;
        const active = prods.filter((p) => p.active !== false).length;

        // NOTE: Low stock/Out of stock calculations are missing from the original logic, keeping them at 0
        setStats({ total, active, lowStock: 0, outOfStock: 0 }); 
      } catch (err) {
        console.error(err);
        toast(err.message || "Failed to load data", "error");
      } finally {
        if (mounted) setLoading(false);
      }
    } 
    
    loadData();
    return () => (mounted = false);
  }, [token]);

  /* ---------- Pagination Helpers (MISSING) ---------- */
  function handlePreviousPage() {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }

  function handleNextPage() {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }

  /* ---------- Refresh Data (FIXED CLOSING BRACE) ---------- */
  async function handleRefresh() {
    try {
      setLoading(true);
      const productsData = await apiRequest("/v2/products/", { method: "GET" });
      const stockData = await apiRequest("/v2/stock/", { method: "GET" });
      
      const prods = Array.isArray(productsData) ? productsData : [];
      const stocks = Array.isArray(stockData) ? stockData : [];
      
      setProducts(prods);
      setAllStockData(stocks);

      const total = prods.length;
      const active = prods.filter((p) => p.active !== false).length;
      setStats({ total, active, lowStock: 0, outOfStock: 0 });
      
      toast("Data refreshed", "success");
    } catch (err) {
      toast(err?.message || "Refresh failed", "error");
    } finally {
      setLoading(false);
    }
  }
  
  
  // Function to fetch stock for a product
  async function fetchProductStock(productId) {
    try {
      setLoadingStock(true);
      const stockData = await apiRequest(`/v2/stock/?product_id=${productId}`, { method: "GET" });
      setProductStock(Array.isArray(stockData) ? stockData : []);
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to load stock data", "error");
      setProductStock([]);
    } finally {
      setLoadingStock(false);
    }
  }
  
  
  // Function to handle stock modal open
  function handleOpenStockModal(product) {
    setSelectedProduct(product);
    setShowStockModal(true);
    fetchProductStock(product.id);
  }

  // Get unique plants and categories
  const plants = useMemo(() => {
    return [...new Set(products.map(p => p.plant_name).filter(Boolean))].sort();
  }, [products]);

  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.main_category).filter(Boolean))].sort();
  }, [products]);

  // Calculate stock quantity for each product
  const productsWithStock = useMemo(() => {
    return products.map(product => {
      const stockEntries = allStockData.filter(stock => stock.product_id === product.id);
      const totalStock = stockEntries.reduce((sum, stock) => sum + stock.quantity, 0);
      return {
        ...product,
        totalStock: totalStock,
        stockEntries: stockEntries
      };
    });
  }, [products, allStockData]);

  // Filter and Pagination logic (UPDATED to use productsWithStock)
  const filteredProducts = useMemo(() => {
    return productsWithStock.filter(product => {
      const matchesSearch = 
        product.product_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.product_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesPlant = !selectedPlant || product.plant_name === selectedPlant;
      const matchesCategory = !selectedCategory || product.main_category === selectedCategory;

      return matchesSearch && matchesPlant && matchesCategory;
    });
  }, [productsWithStock, searchQuery, selectedPlant, selectedCategory]);

  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / itemsPerPage);
  }, [filteredProducts, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  

  // Selection handlers (FIXED CLOSING BRACE)
  const toggleSelectAll = () => {
    const allCurrentIds = paginatedProducts.map(p => p.id);
    const allSelected = allCurrentIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !allCurrentIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...allCurrentIds])]);
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) 
        ? prev.filter(itemId => itemId !== id)
        : [...prev, id]
    );
  };

  /* ---------- Delete Single Product (FIXED CLOSING BRACES) ---------- */
  async function handleDeleteOne(product) {
    if (!window.confirm(`Are you sure you want to delete "${product.product_name}"?`)) {
      return;
    } 

    try {
      await apiRequest(`/v2/products/${product.id}`, { method: "DELETE" });
      setProducts(prev => prev.filter(p => p.id !== product.id));
      toast("Product deleted successfully", "success");
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to delete product", "error");
    } 
  }
  

  /* ---------- Delete Multiple Products (FIXED CLOSING BRACES) ---------- */
  async function handleBatchDelete() {
    if (selectedIds.length === 0) {
      toast("No products selected", "error");
      return;
    } 

    if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} product(s)? This action cannot be undone.`)) {
      return;
    } 

    setDeleting(true);
    try {
      // Delete each product
      const deletePromises = selectedIds.map(id => 
        apiRequest(`/v2/products/${id}`, { method: "DELETE" })
      );
      
      await Promise.all(deletePromises);
      
      setProducts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      toast(`${selectedIds.length} product(s) deleted successfully`, "success");
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to delete products", "error");
    } finally {
      setDeleting(false);
    }
  }
  

  /* ---------- Edit Product (UNCHANGED) ---------- */
  function handleEditProduct(product) {
    setEditingProduct(product);
    setShowAddProduct(true);
  }

  /* ---------- Save Product (FIXED CLOSING BRACE - NOTE: isEditing is not defined here) ---------- */
  // The original placeholder for this function is removed, as its implementation should be inside the Drawer component.


  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 transition-colors">
      <AdminSidebar />

      <div className="flex-1 p-6 md:p-8">
        {/* Header - FIXED JSX ATTRIBUTE CLOSING BRACES */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
              <FiPackage className="text-indigo-600 dark:text-indigo-300 w-7 h-7" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">
                Inventory Management
              </h1>
              <p className="text-md text-gray-500 dark:text-gray-400">
                Manage your product catalog, prices, and stock operations.
              </p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            <FiRefreshCw className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"} />
            Refresh Data
          </button>
        </div>

        {/* Stats Cards - FIXED JSX ATTRIBUTE CLOSING BRACES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={<FiLayers className="w-6 h-6" />}
            label="Total Products"
            value={stats.total}
            color="indigo"
          />
          <StatCard
            icon={<FiCheckCircle className="w-6 h-6" />}
            label="Active Products"
            value={stats.active}
            color="emerald"
          />
          <StatCard
            icon={<FiTag className="w-6 h-6" />}
            label="Unique Categories"
            value={categories.length}
            color="amber"
          />
          <StatCard
            icon={<FiMapPin className="w-6 h-6" />}
            label="Active Plants"
            value={plants.length}
            color="purple"
          />
        </div>

        {/* Action Buttons - FIXED JSX ATTRIBUTE CLOSING BRACES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <ActionCard
            icon={<FiPlus className="w-8 h-8" />}
            title="New Product"
            description="Add a single product with full details."
            buttonText="Add Product"
            color="blue"
            onClick={() => {
              setEditingProduct(null);
              setShowAddProduct(true);
            }}
          />

          <ActionCard
            icon={<FiUpload className="w-8 h-8" />}
            title="Bulk Import"
            description="Upload multiple products via CSV/Excel."
            buttonText="Upload File"
            color="purple"
            onClick={() => setShowBulkUpload(true)}
          />

          <ActionCard
            icon={<FiDownload className="w-8 h-8" />}
            title="Export Data"
            description="Download product inventory data."
            buttonText="Export Data"
            color="emerald"
            onClick={() => setShowExport(true)}
          />
        </div>

        {/* Search and Filters - FIXED SYNTAX ERROR ON LINE 467 AND OTHERS */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-1">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by code or name..."
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Custom Selects for better visual focus */}
            <div className="relative">
              <FiMapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={selectedPlant}
                onChange={(e) => {
                  setSelectedPlant(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">All Plants</option>
                {plants.map(plant => (
                  <option key={plant} value={plant}>{plant}</option>
                ))} {/* FIXED: Removed // <-- FIXED comment */}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <div className="relative">
              <FiTag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-10 pr-4 py-2.5 border rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))} {/* FIXED: Removed // <-- FIXED comment */}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedPlant("");
                setSelectedCategory("");
                setCurrentPage(1);
              }}
              className="px-4 py-2.5 border rounded-xl border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Clear Filters
            </button>
          </div>

          <div className="mt-5 flex items-center justify-between text-sm pt-4 border-t border-gray-100 dark:border-gray-700">
            <span className="text-gray-600 dark:text-gray-400 font-medium">
              Displaying <span className="font-semibold text-gray-800 dark:text-gray-200">{filteredProducts.length}</span> of {products.length} total products
            </span>
            
            {selectedIds.length > 0 && (
              <button
                onClick={handleBatchDelete}
                disabled={deleting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors shadow-md"
              >
                <FiTrash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
              </button>
            )} {/* FIXED: Removed // <-- FIXED comment */}
          </div>
        </div>

        {/* Products Table - FIXED JSX ATTRIBUTE CLOSING BRACES */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b-2 border-indigo-500 dark:border-indigo-400">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.includes(p.id))}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded-md border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <TableHeader label="Product Code" />
                  <TableHeader label="Product Name" />
                  <TableHeader label="MRP" icon={FiDollarSign} />
                  <TableHeader label="Quantity" icon={FiDatabase} />
                  <th className="px-6 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-md text-indigo-500 dark:text-indigo-400 font-medium">
                      <FiRefreshCw className="inline animate-spin mr-2 w-5 h-5" /> Loading Product Data...
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-md text-gray-500 dark:text-gray-400">
                      <FiAlertCircle className="inline mr-2 w-5 h-5" /> No products found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <tr 
                      key={product.id}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                        selectedIds.includes(product.id) ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(product.id)}
                          onChange={() => toggleSelectOne(product.id)}
                          className="h-4 w-4 rounded-md border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono">
                        {product.product_code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800 dark:text-gray-200">
                        <div className="max-w-xs truncate font-medium" title={product.product_name}>
                          {product.product_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                        ₹{product.mrp}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {product.totalStock || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => handleOpenStockModal(product)}
                            className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/40 transition-colors shadow-sm"
                            title="Stock"
                          >
                            <FiDatabase className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors shadow-sm"
                            title="Edit"
                          >
                            <FiEdit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOne(product)}
                            className="p-2 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors shadow-sm"
                            title="Delete"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )} {/* FIXED: Removed // <-- FIXED comment */}
              </tbody>
            </table>
          </div>

          {/* Pagination - FIXED JSX ATTRIBUTE CLOSING BRACES */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <button
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-l hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button
                className="px-4 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-r hover:bg-gray-100 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          )} {/* FIXED: Removed // <-- FIXED comment */}
        </div>
      </div>

      {/* Modals - Components below are updated to match new style - FIXED JSX ATTRIBUTE CLOSING BRACES */}
      {showAddProduct && (
        <AddProductDrawer
          product={editingProduct}
          onClose={() => {
            setShowAddProduct(false);
            setEditingProduct(null);
          }}
          onSuccess={() => {
            setShowAddProduct(false);
            setEditingProduct(null);
            handleRefresh();
          }}
        />
      )} {/* FIXED: Removed // <-- FIXED comment */}

      {showBulkUpload && (
        <BulkUploadModal
          onClose={() => setShowBulkUpload(false)}
          onSuccess={() => {
            setShowBulkUpload(false);
            handleRefresh();
          }}
        />
      )} {/* FIXED: Removed // <-- FIXED comment */}

      {showExport && (
        <ExportModal
          onClose={() => setShowExport(false)}
          products={products}
        />
      )} {/* FIXED: Removed // <-- FIXED comment */}

      {/* Stock Modal - FIXED JSX ATTRIBUTE CLOSING BRACES */}
      {showStockModal && (
        <StockModal
          product={selectedProduct}
          stockData={productStock}
          loading={loadingStock}
          onClose={() => setShowStockModal(false)}
          onRefresh={() => {
            if (selectedProduct) {
              fetchProductStock(selectedProduct.id);
              handleRefresh(); // Refresh main data as well
            } 
          }}
        />
      )} {/* FIXED: Removed // <-- FIXED comment */}
    </div>
  );
}


/* ---------- NEW Table Header Component (for minimalistic table) - FIXED CLOSING BRACE ---------- */
function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        indigo: 'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20',
        emerald: 'text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20',
        amber: 'text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20',
        purple: 'text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20',
    }[color] || {};

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 p-5 transition-transform hover:scale-[1.02]">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${colorClasses}`}>
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">{value}</p>
                </div>
            </div>
        </div>
    );
}

function TableHeader({ label, icon: Icon }) {
  return (
    <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
      {Icon && <Icon className="inline-block mr-1 w-4 h-4" />}
      {label}
    </th>
  );
}


/* ---------- Action Card Component - ENHANCED UI/UX - FIXED CLOSING BRACES ---------- */
function ActionCard({ icon, title, description, buttonText, color, onClick }) {
    const colorClasses = {
        blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconText: 'text-blue-600 dark:text-blue-300' },
        purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', iconBg: 'bg-purple-100 dark:bg-purple-900/30', iconText: 'text-purple-600 dark:text-purple-300' },
        emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconText: 'text-emerald-600 dark:text-emerald-300' },
    }[color] || {};

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl">
            <div className="flex flex-col items-start">
                <div className={`${colorClasses.iconBg} p-4 rounded-xl ${colorClasses.iconText} mb-4`}>
                    {icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex-1">
                    {description}
                </p>
                <button
                    onClick={onClick}
                    className={`w-full px-4 py-3 rounded-xl text-white font-semibold ${colorClasses.bg} ${colorClasses.hover} transition-colors shadow-lg dark:shadow-none`}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
}


/* ---------- Add/Edit Product Drawer Component - WIDER & HORIZONTAL LAYOUT ---------- */


function AddProductDrawer({ product, onClose, onSuccess }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const isEditing = !!product;
  
  // Form state
  const [form, setForm] = useState({
    product_code: product?.product_code || "",
    plant_name: product?.plant_name || "",
    pellet_size: product?.pellet_size ? String(product.pellet_size) : "",
    product_name: product?.product_name || "",
    mrp: product?.mrp ? String(product.mrp) : "",
    pcs_per_cb: product?.pcs_per_cb ? String(product.pcs_per_cb) : "",
    gst_rate: product?.gst_rate ? String(product.gst_rate) : "",
    weight: product?.weight || "",
    main_category: product?.main_category || "",
    life_of_product_in_months: product?.life_of_product_in_months ? String(product.life_of_product_in_months) : "",
    db_per_pcs_basic: product?.db_per_pcs_basic ? String(product.db_per_pcs_basic) : "",
    rss_per_pcs_basic: product?.rss_per_pcs_basic ? String(product.rss_per_pcs_basic) : "",
    per_pc_sale_price_basic: product?.per_pc_sale_price_basic ? String(product.per_pc_sale_price_basic) : "",
  });

  // Auto-calculated fields
  const calculated = useMemo(() => {
    const P = parseFloat(form.db_per_pcs_basic) || 0;
    const W = parseFloat(form.rss_per_pcs_basic) || 0;
    const F = parseFloat(form.pcs_per_cb) || 0;
    const G = parseFloat(form.gst_rate) || 0;

    const M = P !== 0 ? P / 1.035 : 0; 
    const N = M * F;
    const costPerCBWithGST = N + (N * G / 100);

    const dbPerPcsWithGST = P + (P * G / 100);
    const U = P * F;
    const dbPerCBWithGST = U + (U * G / 100);

    const rssPerPcsWithGST = W + (W * G / 100);
    const Y = W * F;
    const rssPerCBWithGST = Y + (Y * G / 100);

    const marginDB = M !== 0 ? ((P - M) / M * 100) : 0;
    const marginRSS = M !== 0 ? ((W - M) / M * 100) : 0;
    const marginDiff = marginDB - marginRSS;

    return {
      costPerPcsBasic: M.toFixed(4),
      costPerCBBasic: N.toFixed(4),
      costPerCBWithGST: costPerCBWithGST.toFixed(4),
      dbPerPcsWithGST: dbPerPcsWithGST.toFixed(4),
      dbPerCBBasic: U.toFixed(4),
      dbPerCBWithGST: dbPerCBWithGST.toFixed(4),
      rssPerPcsWithGST: rssPerPcsWithGST.toFixed(4),
      rssPerCBBasic: Y.toFixed(4),
      rssPerCBWithGST: rssPerCBWithGST.toFixed(4),
      marginDB: marginDB.toFixed(2),
      marginRSS: marginRSS.toFixed(2),
      marginDiff: marginDiff.toFixed(2),
    };
  }, [form.db_per_pcs_basic, form.rss_per_pcs_basic, form.pcs_per_cb, form.gst_rate]);

  // Validation
  const validation = useMemo(() => {
    const errors = [];
    if (!form.product_code.trim()) errors.push("Product code required");
    if (!form.product_name.trim()) errors.push("Product name required");
    if (!form.mrp) errors.push("MRP required");
    if (!form.pcs_per_cb) errors.push("Pieces per CB required");
    if (!form.gst_rate) errors.push("GST rate required");
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (!validation.isValid) {
      toast(validation.errors[0], "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        product_code: form.product_code,
        plant_name: form.plant_name || "",
        pellet_size: parseFloat(form.pellet_size) || 0,
        product_name: form.product_name,
        mrp: parseFloat(form.mrp) || 0,
        pcs_per_cb: parseFloat(form.pcs_per_cb) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        weight: form.weight || "",
        main_category: form.main_category || "",
        life_of_product_in_months: parseFloat(form.life_of_product_in_months) || 0,
        cost_per_pcs_basic: parseFloat(calculated.costPerPcsBasic) || 0,
        db_per_pcs_basic: parseFloat(form.db_per_pcs_basic) || 0,
        rss_per_pcs_basic: parseFloat(form.rss_per_pcs_basic) || 0,
        per_pc_sale_price_basic: parseFloat(form.per_pc_sale_price_basic) || 0,
      };

      if (isEditing) {
        await apiRequest(`/v2/products/${product.id}`, { method: "PUT", body: payload });
        toast("Product updated successfully", "success");
      } else {
        await apiRequest("/v2/products/", { method: "POST", body: payload });
        toast("Product created successfully", "success");
      }
      
      onSuccess();
    } catch (err) {
      console.error(err);
      toast(err.message || `Failed to ${isEditing ? 'update' : 'create'} product`, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 overflow-hidden flex flex-col">
      {/* Header - Fixed */}
      <header className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
              >
                <FiArrowLeft className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <FiPackage className="w-6 h-6 text-white" />
                  </div>
                  {isEditing ? "Edit Product" : "Add New Product"}
                </h1>
                {isEditing && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 ml-14">
                    {product.product_code} • {product.product_name}
                  </p>
                )}
              </div>
            </div>

            {/* Validation Status */}
            <div className="hidden sm:flex items-center gap-4">
              {validation.isValid ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Ready to save
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800">
                  <FiAlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {validation.errors.length} field(s) required
                  </span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-medium"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving || !validation.isValid}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-4 h-4" />
                      {isEditing ? "Update Product" : "Create Product"}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Scrollable */}
      <main className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="h-full">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column - Main Form (2/3 width on XL screens) */}
              <div className="xl:col-span-2 space-y-6">
                
                {/* Basic Information Card */}
                <SectionCard
                  title="Basic Information"
                  icon={FiInfo}
                  color="indigo"
                  description="Core product details and identification"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputFieldModern
                      label="Product Code"
                      value={form.product_code}
                      onChange={(e) => setForm({ ...form, product_code: e.target.value })}
                      required
                      icon={FiHash}
                      placeholder="e.g., PROD-001"
                    />
                    <InputFieldModern
                      label="Product Name"
                      value={form.product_name}
                      onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                      required
                      icon={FiPackage}
                      placeholder="Enter product name"
                    />
                    <InputFieldModern
                      label="Main Category"
                      value={form.main_category}
                      onChange={(e) => setForm({ ...form, main_category: e.target.value })}
                      icon={FiTag}
                      placeholder="Category"
                    />
                    <InputFieldModern
                      label="Plant Name"
                      value={form.plant_name}
                      onChange={(e) => setForm({ ...form, plant_name: e.target.value })}
                      icon={FiHome}
                      placeholder="Manufacturing plant"
                    />
                  </div>
                </SectionCard>

                {/* Product Specifications & Pricing - 2 Column Layout */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  
  {/* Left Column - Product Specifications */}
  <SectionCard
    title="Product Specifications"
    icon={FiActivity}
    color="blue"
    description="Physical properties and characteristics"
  >
    <div className="space-y-4">
      <InputFieldModern
        label="Pellet Size (mm)"
        value={form.pellet_size}
        onChange={(e) => setForm({ ...form, pellet_size: e.target.value })}
        type="number"
        step="0.1"
        icon={FiCircle}
        placeholder="0.0"
      />
      <InputFieldModern
        label="Weight"
        value={form.weight}
        onChange={(e) => setForm({ ...form, weight: e.target.value })}
        icon={FiBox}
        placeholder="e.g., 500g"
      />
      <InputFieldModern
        label="Life of Product (Months)"
        value={form.life_of_product_in_months}
        onChange={(e) => setForm({ ...form, life_of_product_in_months: e.target.value })}
        type="number"
        step="1"
        icon={FiClock}
        placeholder="0"
      />
    </div>
  </SectionCard>

  {/* Right Column - Pricing Information */}
  <SectionCard
    title="Pricing Information"
    icon={FiDollarSign}
    color="emerald"
    description="Base pricing and taxation details"
  >
    <div className="space-y-4">
      <InputFieldModern
        label="MRP (₹)"
        value={form.mrp}
        onChange={(e) => setForm({ ...form, mrp: e.target.value })}
        type="number"
        step="0.01"
        required
        icon={FiDollarSign}
        placeholder="0.00"
      />
      <InputFieldModern
        label="Pieces per CB"
        value={form.pcs_per_cb}
        onChange={(e) => setForm({ ...form, pcs_per_cb: e.target.value })}
        type="number"
        step="1"
        required
        icon={FiBox}
        placeholder="0"
      />
      <InputFieldModern
        label="GST Rate (%)"
        value={form.gst_rate}
        onChange={(e) => setForm({ ...form, gst_rate: e.target.value })}
        type="number"
        step="0.01"
        required
        icon={FiPercent}
        placeholder="0.00"
      />
    </div>
  </SectionCard>
</div>

               {/* DB & RSS Pricing - 2 Column Layout */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  
  {/* Left Column - DB Pricing */}
  <SectionCard
    title="Distributor (DB) Pricing"
    icon={FiDatabase}
    color="violet"
    description="Pricing for distributor channel"
  >
    <div className="space-y-4">
      <InputFieldModern
        label="DB per Pcs (Basic)"
        value={form.db_per_pcs_basic}
        onChange={(e) => setForm({ ...form, db_per_pcs_basic: e.target.value })}
        type="number"
        step="0.01"
        required
        icon={FiDollarSign}
        placeholder="0.00"
      />
      <ReadOnlyField
        label="DB per Pcs (With GST)"
        value={`₹${calculated.dbPerPcsWithGST}`}
        icon={FiTrendingUp}
        color="violet"
      />
      <ReadOnlyField
        label="DB per CB (Basic)"
        value={`₹${calculated.dbPerCBBasic}`}
        icon={FiBox}
        color="violet"
      />
      <ReadOnlyField
        label="DB per CB (With GST)"
        value={`₹${calculated.dbPerCBWithGST}`}
        icon={FiDollarSign}
        color="violet"
        highlight
      />
    </div>
  </SectionCard>

  {/* Right Column - RSS Pricing */}
  <SectionCard
    title="Retailer (RSS) Pricing"
    icon={FiShoppingBag}
    color="amber"
    description="Pricing for retail channel"
  >
    <div className="space-y-4">
      <InputFieldModern
        label="RSS per Pcs (Basic)"
        value={form.rss_per_pcs_basic}
        onChange={(e) => setForm({ ...form, rss_per_pcs_basic: e.target.value })}
        type="number"
        step="0.01"
        required
        icon={FiDollarSign}
        placeholder="0.00"
      />
      <ReadOnlyField
        label="RSS per Pcs (With GST)"
        value={`₹${calculated.rssPerPcsWithGST}`}
        icon={FiTrendingUp}
        color="amber"
      />
      <ReadOnlyField
        label="RSS per CB (Basic)"
        value={`₹${calculated.rssPerCBBasic}`}
        icon={FiBox}
        color="amber"
      />
      <ReadOnlyField
        label="RSS per CB (With GST)"
        value={`₹${calculated.rssPerCBWithGST}`}
        icon={FiDollarSign}
        color="amber"
        highlight
      />
    </div>
  </SectionCard>
</div>
              </div>

              {/* Right Column - Analytics & Calculations (1/3 width on XL screens) */}
              <div className="xl:col-span-1 space-y-6">
                
                {/* Cost Analysis - Sticky */}
                <div className="xl:sticky xl:top-6 space-y-6">
                  
                  {/* Cost Breakdown */}
                  <SectionCard
                    title="Cost Analysis"
                    icon={FiTrendingUp}
                    color="blue"
                    description="Calculated cost metrics"
                  >
                    <div className="space-y-3">
                      <MetricRow
                        label="Cost/Pcs (Basic)"
                        value={`₹${calculated.costPerPcsBasic}`}
                        tooltip="DB per Pcs / 1.035"
                        color="blue"
                      />
                      <MetricRow
                        label="Cost/CB (Basic)"
                        value={`₹${calculated.costPerCBBasic}`}
                        tooltip="Cost per Pcs × Pcs per CB"
                        color="blue"
                      />
                      <MetricRow
                        label="Cost/CB (With GST)"
                        value={`₹${calculated.costPerCBWithGST}`}
                        tooltip="Cost per CB + GST"
                        color="indigo"
                        highlight
                      />
                    </div>
                  </SectionCard>

                  {/* Margin Analysis */}
                  <SectionCard
  title="Margin Analysis"
  icon={FiActivity}
  color="purple"
  description="Profitability metrics & performance indicators"
>
  <div className="space-y-4">
    {/* Comparison Grid */}
    <div className="grid grid-cols-2 gap-4">
      {/* DB Margin */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <FiDatabase className="w-5 h-5 opacity-80" />
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            parseFloat(calculated.marginDB) >= 20 ? 'bg-white/30' : 'bg-amber-400/30'
          }`}>
            {parseFloat(calculated.marginDB) >= 20 ? 'Good' : 'Low'}
          </span>
        </div>
        <p className="text-xs opacity-80 mb-1">DB Margin</p>
        <p className="text-3xl font-black mb-1">{calculated.marginDB}%</p>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.min(parseFloat(calculated.marginDB), 100)}%` }}
          />
        </div>
      </div>

      {/* RSS Margin */}
      <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <FiShoppingBag className="w-5 h-5 opacity-80" />
          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
            parseFloat(calculated.marginRSS) >= 15 ? 'bg-white/30' : 'bg-amber-400/30'
          }`}>
            {parseFloat(calculated.marginRSS) >= 15 ? 'Good' : 'Low'}
          </span>
        </div>
        <p className="text-xs opacity-80 mb-1">RSS Margin</p>
        <p className="text-3xl font-black mb-1">{calculated.marginRSS}%</p>
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div 
            className="h-full bg-white rounded-full transition-all"
            style={{ width: `${Math.min(parseFloat(calculated.marginRSS), 100)}%` }}
          />
        </div>
      </div>
    </div>

    {/* Margin Difference - Highlight */}
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur-xl opacity-50" />
      <div className="relative bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiActivity className="w-5 h-5" />
            <span className="font-bold text-sm">Margin Gap</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            parseFloat(calculated.marginDiff) > 0 
              ? 'bg-green-400/30 text-green-100'
              : parseFloat(calculated.marginDiff) < 0 
              ? 'bg-red-400/30 text-red-100'
              : 'bg-white/20'
          }`}>
            {parseFloat(calculated.marginDiff) > 0 ? '↑ DB Better' : 
             parseFloat(calculated.marginDiff) < 0 ? '↓ RSS Better' : 'Equal'}
          </div>
        </div>
        
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-5xl font-black">
            {parseFloat(calculated.marginDiff) > 0 ? '+' : ''}{calculated.marginDiff}
          </span>
          <span className="text-2xl font-bold opacity-80">%</span>
        </div>
        
        <div className="flex items-center gap-4 text-xs opacity-90">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-300" />
            <span>DB: {calculated.marginDB}%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-300" />
            <span>RSS: {calculated.marginRSS}%</span>
          </div>
        </div>
      </div>
    </div>

    {/* Quick Stats */}
    <div className="grid grid-cols-3 gap-2">
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-center">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cost/Pcs</p>
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
          ₹{calculated.costPerPcsBasic}
        </p>
      </div>
      <div className="bg-emerald-100 dark:bg-emerald-900/30 rounded-lg p-3 text-center">
        <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">DB/Pcs</p>
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">
          ₹{form.db_per_pcs_basic || '0.00'}
        </p>
      </div>
      <div className="bg-blue-100 dark:bg-blue-900/30 rounded-lg p-3 text-center">
        <p className="text-xs text-blue-700 dark:text-blue-400 mb-1">RSS/Pcs</p>
        <p className="text-sm font-bold text-blue-900 dark:text-blue-100">
          ₹{form.rss_per_pcs_basic || '0.00'}
        </p>
      </div>
    </div>
  </div>
</SectionCard>

                  {/* Comparison Table */}
                  <SectionCard
                    title="DB vs RSS Comparison"
                    icon={FiDatabase}
                    color="gray"
                    description="Side-by-side comparison"
                  >
                    <div className="space-y-2 text-sm">
                      <ComparisonRow
                        label="Per Pcs (Basic)"
                        db={form.db_per_pcs_basic || '0.00'}
                        rss={form.rss_per_pcs_basic || '0.00'}
                      />
                      <ComparisonRow
                        label="Per Pcs (GST)"
                        db={calculated.dbPerPcsWithGST}
                        rss={calculated.rssPerPcsWithGST}
                      />
                      <ComparisonRow
                        label="Per CB (Basic)"
                        db={calculated.dbPerCBBasic}
                        rss={calculated.rssPerCBBasic}
                      />
                      <ComparisonRow
                        label="Per CB (GST)"
                        db={calculated.dbPerCBWithGST}
                        rss={calculated.rssPerCBWithGST}
                        highlight
                      />
                    </div>
                  </SectionCard>

                </div>
              </div>
            </div>
          </div>
        </form>
      </main>

      {/* Mobile Footer - Fixed (only on mobile) */}
      <div className="sm:hidden flex-shrink-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-3 safe-bottom">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !validation.isValid}
            className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <FiLoader className="w-4 h-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <FiCheck className="w-4 h-4" />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============= Reusable Components =============

function SectionCard({ title, icon: Icon, color, description, children }) {
  const colorClasses = {
    indigo: "border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-indigo-100/50 dark:from-indigo-950/20 dark:to-indigo-900/20",
    blue: "border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/20",
    emerald: "border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/20",
    violet: "border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-violet-100/50 dark:from-violet-950/20 dark:to-violet-900/20",
    amber: "border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50/50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/20",
    purple: "border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50/50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/20",
    gray: "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800",
  };

  const iconColorClasses = {
    indigo: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50",
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-900/50",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/50",
    purple: "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/50",
    gray: "text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700",
  };

  return (
    <div className={`border-2 rounded-2xl p-5 ${colorClasses[color]} transition-all hover:shadow-lg`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <div className={`p-2 rounded-xl ${iconColorClasses[color]}`}>
              <Icon className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-gray-100 text-base">
              {title}
            </h3>
          </div>
          {description && (
            <p className="text-xs text-gray-600 dark:text-gray-400 ml-11">
              {description}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function InputFieldModern({ label, required, icon: Icon, className, ...props }) {
  return (
    <div className={className}>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <Icon className="w-4 h-4" />
          </div>
        )}
        <input
          {...props}
          className={`
            w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 
            rounded-xl border-2 border-gray-200 dark:border-gray-700 
            bg-white dark:bg-gray-800 
            text-gray-900 dark:text-gray-100 
            focus:border-indigo-500 dark:focus:border-indigo-400 
            focus:ring-4 focus:ring-indigo-500/20 
            transition-all outline-none text-sm
            placeholder:text-gray-400 dark:placeholder:text-gray-500
          `}
        />
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value, icon: Icon, color, highlight }) {
  const colorClasses = {
    violet: highlight 
      ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white border-violet-600"
      : "bg-violet-100 dark:bg-violet-900/30 text-violet-900 dark:text-violet-100 border-violet-300 dark:border-violet-700",
    amber: highlight
      ? "bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-600"
      : "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-300 dark:border-amber-700",
    blue: highlight
      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-600"
      : "bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700",
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </label>
      <div className={`relative px-4 py-2.5 rounded-xl border-2 font-mono font-bold text-sm ${colorClasses[color]} flex items-center gap-2`}>
        {Icon && <Icon className="w-4 h-4" />}
        <span>{value}</span>
      </div>
    </div>
  );
}

function MetricRow({ label, value, tooltip, color, highlight }) {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
  };

  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${colorClasses[color]} ${highlight ? 'ring-2 ring-indigo-500/50' : ''}`}>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
        {tooltip && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{tooltip}</p>
        )}
      </div>
      <p className={`text-lg font-bold ${highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {value}
      </p>
    </div>
  );
}

function MarginBadge({ label, value, formula, color, highlight }) {
  const colorClasses = {
    emerald: "from-emerald-500 to-teal-600",
    blue: "from-blue-500 to-cyan-600",
    purple: "from-purple-500 to-pink-600",
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-4 text-white ${highlight ? 'ring-4 ring-purple-500/30 scale-105' : ''} transition-transform`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-90">{label}</p>
        <FiTrendingUp className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold mb-1">{value}</p>
      <p className="text-xs opacity-75">{formula}</p>
    </div>
  );
}

function ComparisonRow({ label, db, rss, highlight }) {
  const diff = (parseFloat(db) - parseFloat(rss)).toFixed(2);
  const isPositive = parseFloat(diff) > 0;

  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${highlight ? 'bg-gray-100 dark:bg-gray-700/50 font-semibold' : 'hover:bg-gray-50 dark:hover:bg-gray-700/30'} transition-colors`}>
      <span className="text-xs text-gray-600 dark:text-gray-400 flex-1">{label}</span>
      <div className="flex items-center gap-3 text-xs">
        <span className="text-violet-700 dark:text-violet-400 font-mono w-16 text-right">₹{db}</span>
        <span className="text-amber-700 dark:text-amber-400 font-mono w-16 text-right">₹{rss}</span>
        <span className={`font-mono w-16 text-right ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
          {isPositive ? '+' : ''}₹{diff}
        </span>
      </div>
    </div>
  );
}




// Metric Card Component
function MetricCard({ label, value, color = "gray", icon: Icon, tooltip, highlight }) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    indigo: 'from-indigo-500 to-indigo-600',
    violet: 'from-violet-500 to-violet-600',
    purple: 'from-purple-500 to-purple-600',
    amber: 'from-amber-500 to-amber-600',
    orange: 'from-orange-500 to-orange-600',
    emerald: 'from-emerald-500 to-emerald-600',
  };

  return (
    <div className={`
      relative overflow-hidden rounded-xl sm:rounded-2xl border-2 
      ${highlight 
        ? 'border-indigo-300 dark:border-indigo-600 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30' 
        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
      }
      transition-all hover:shadow-lg hover:scale-105
    `}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">
            {label}
          </p>
          {Icon && (
            <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colorClasses[color]}`}>
              <Icon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </div>
          )}
        </div>
        <p className={`text-xl sm:text-2xl font-bold bg-gradient-to-br ${colorClasses[color]} bg-clip-text text-transparent`}>
          {value}
        </p>
        {tooltip && (
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 flex items-center gap-1">
            <FiInfo className="w-3 h-3" />
            {tooltip}
          </p>
        )}
      </div>
    </div>
  );
}

// Margin Card Component
function MarginCard({ label, value, formula, color, icon: Icon, highlight }) {
  const colorClasses = {
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
  };

  const bgClasses = {
    emerald: 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30',
    blue: 'from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30',
    purple: 'from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30',
  };

  return (
    <div className={`
      relative overflow-hidden rounded-xl sm:rounded-2xl 
      bg-gradient-to-br ${bgClasses[color]}
      border-2 ${highlight ? `border-${color}-400` : `border-${color}-200 dark:border-${color}-800`}
      transition-all hover:shadow-xl hover:scale-105
    `}>
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
            {label}
          </h5>
          {Icon && (
            <div className={`p-2 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
          )}
        </div>
        <p className={`text-2xl sm:text-4xl font-black bg-gradient-to-br ${colorClasses[color]} bg-clip-text text-transparent mb-2`}>
          {value}
        </p>
        <p className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-white/50 dark:bg-gray-800/50 px-2 py-1 rounded">
          {formula}
        </p>
      </div>
    </div>
  );
}



// Add to your CSS
const styles = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;


/* ---------- NEW Margin Metric Component (for better margin visualization) - FIXED CLOSING BRACES ---------- */
function MarginMetric({ label, value, formula, color }) {
    const colorClasses = {
        purple: 'text-purple-600 dark:text-purple-400',
        pink: 'text-pink-600 dark:text-pink-400',
        indigo: 'text-indigo-600 dark:text-indigo-400',
    }[color] || {};

    const isNegative = parseFloat(value) < 0;

    return (
        <div className="text-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 transition-all hover:scale-[1.05] hover:shadow-xl">
            <p className={`text-sm font-semibold ${colorClasses} mb-2`}>{label}</p>
            <p className={`text-3xl font-extrabold ${isNegative ? 'text-red-500' : colorClasses}`}>
                {value}<span className="text-xl">%</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 opacity-75">
                {formula}
            </p>
        </div>
    );
}


/* ---------- Section Component (Collapsible) - ENHANCED UI/UX - FIXED CLOSING BRACES ---------- */
function Section({ title, expanded, onToggle, children, badge, icon: Icon, color }) {
    const colorClasses = {
        indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/10', text: 'text-indigo-600 dark:text-indigo-300', border: 'border-indigo-400 dark:border-indigo-600' },
        blue: { bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-600 dark:text-blue-300', border: 'border-blue-400 dark:border-blue-600' },
        emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-600 dark:text-emerald-300', border: 'border-emerald-400 dark:border-emerald-600' },
        amber: { bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-600 dark:text-amber-300', border: 'border-amber-400 dark:border-amber-600' },
    }[color] || {};

  return (
    <div className={`border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden shadow-md transition-all ${expanded ? colorClasses.border : ''}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full px-6 py-4 ${colorClasses.bg} flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-all`}
      >
        <div className="flex items-center gap-3">
            {Icon && <Icon className={`w-5 h-5 ${colorClasses.text}`} />}
          <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h4>
          {badge && (
            <span className={`ml-2 text-xs px-3 py-1 rounded-full font-semibold ${colorClasses.bg} ${colorClasses.text} border border-current`}>
                {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {expanded ? (
            <FiChevronUp className="text-gray-600 dark:text-gray-400 w-6 h-6" />
          ) : (
            <FiChevronDown className="text-gray-600 dark:text-gray-400 w-6 h-6" />
          )}
        </div>
      </button>
      
      {expanded && (
        <div className="p-6 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}


/* ---------- Input Field Component - ENHANCED UI/UX - FIXED CLOSING BRACES ---------- */
function InputField({ label, value, onChange, type = "text", placeholder, required = false, step, inputClasses = "" }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
        {label} {required && <span className="text-red-500 font-bold">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        step={step}
        className={`w-full px-4 py-2.5 border rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${inputClasses}`}
      />
    </div>
  );
}





/* ---------- Bulk Upload Modal - WIDER ---------- */
function BulkUploadModal({ onClose, onSuccess }) {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Required columns for bulk import
  const requiredColumns = [
    'product_code', 'plant_name', 'pellet_size', 'product_name', 'mrp', 
    'pcs_per_cb', 'gst_rate', 'weight', 'main_category', 
    'life_of_product_in_months', 'cost_per_pcs_basic', 
    'db_per_pcs_basic', 'rss_per_pcs_basic', 'per_pc_sale_price_basic'  // Added new field
  ];

  // ... (handleUpload logic UNCHANGED)
  async function handleUpload() {
    if (!file) {
      toast("Please select a file", "error");
      return;
    } 

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      await apiRequest("/v2/products/bulk-import", {
        method: "POST",
        body: fd,
      });

      toast("Bulk upload completed", "success");
      onSuccess();
    } catch (err) {
      console.error(err);
      toast(err.message || "Bulk upload failed", "error");
    } finally {
      setUploading(false);
    }
  }
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Increased max-w to 3xl */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full **max-w-3xl** transform transition-all duration-300 scale-100">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FiUpload className="text-purple-600 dark:text-purple-400 w-5 h-5" />
            Bulk Upload Products
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FiX className="text-gray-700 dark:text-gray-200 w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div
            className="border-4 border-dashed border-purple-300 dark:border-purple-600 rounded-xl p-10 text-center bg-purple-50 dark:bg-purple-900/20 hover:border-purple-500 dark:hover:border-purple-400 transition-colors cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <FiUpload className="w-16 h-16 text-purple-500 dark:text-purple-400 mx-auto mb-4 group-hover:animate-bounce-y" />
            <p className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-1">
              Drop your file here or click to browse
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Accepted formats: **.CSV, .XLSX, .XLS**
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="hidden"
            />
          </div>

          {file && (
            <div className="mt-5 flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-xl border border-gray-200 dark:border-gray-600">
              <FiFileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <span className="text-sm text-gray-800 dark:text-gray-200 font-medium flex-1 truncate">
                {file.name}
              </span>
              <button
                onClick={() => setFile(null)}
                className="text-red-600 dark:text-red-400 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                title="Remove file"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>
          )}
          
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              className="px-6 py-2.5 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-md shadow-purple-500/50"
              disabled={!file || uploading}
            >
              {uploading ? "Uploading..." : "Upload Products"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------- Export Modal - WIDER ---------- */
function ExportModal({ onClose, products }) {
  const toast = useToast();
  const [format, setFormat] = useState("excel");

  // Updated handleExport to use backend API
  async function handleExport() {
    try {
      // Use the backend export endpoint
      const response = await fetch(`${API_HOST}${API_BASE}/v2/products/export-excel`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${getToken()}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      // Get the filename from the response headers if available
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `products_${new Date().toISOString().split("T")[0]}.xlsx`;
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }
      

      // Create a blob from the response
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast("Export completed successfully", "success");
      onClose();
    } catch (err) {
      console.error(err);
      toast(err.message || "Export failed", "error");
    }
  }
  

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Increased max-w to xl */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full **max-w-xl**">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FiDownload className="text-emerald-600 dark:text-emerald-400 w-5 h-5" />
            Export Products Data
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FiX className="text-gray-700 dark:text-gray-200 w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <label className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-3 block">
              Export Options ({products.length} records)
            </label>
            <div className="space-y-3">
              <label className="flex items-center gap-4 p-4 border-2 border-current rounded-xl cursor-pointer transition-all duration-200 group" 
                style={{ borderColor: format === "excel" ? '#059669' : 'rgb(209 213 219)' }}>
                <input
                  type="radio"
                  name="format"
                  value="excel"
                  checked={format === "excel"}
                  onChange={(e) => setFormat(e.target.value)}
                  className="w-5 h-5 text-emerald-600 focus:ring-emerald-500"
                />
                <div className="flex-1">
                  <p className="text-md font-bold text-gray-900 dark:text-gray-100">
                    Excel File (.xlsx)
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Export products data to Excel format.
                  </p>
                </div>
                <FiFileText className="w-6 h-6 text-emerald-500 opacity-0 group-hover:opacity-100 group-has-checked:opacity-100 transition-opacity" />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/50"
            >
              Export Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------- Stock Modal - WIDER & HORIZONTAL LAYOUT ---------- */
function StockModal({ product, stockData, loading, onClose, onRefresh }) {
  const toast = useToast();
  const [newStock, setNewStock] = useState({
    quantity: "",
    manufacturing_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [addingStock, setAddingStock] = useState(false);

  // Calculate stock summary
  const stockSummary = {
    totalQuantity: stockData.reduce((sum, item) => sum + item.quantity, 0),
    totalEntries: stockData.length,
    expiringSoon: stockData.filter((item) => {
      const daysUntilExpiry = Math.ceil(
        (new Date(item.expire_date) - new Date()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    }).length,
    expired: stockData.filter((item) => new Date(item.expire_date) < new Date())
      .length,
  };

  async function handleAddStock(e) {
    e.preventDefault();
    if (!newStock.quantity || !newStock.manufacturing_date) {
      toast("Please fill all required fields", "error");
      return;
    }

    try {
      setAddingStock(true);
      await apiRequest("/v2/stock/", {
        method: "POST",
        body: {
          product_id: product.id,
          quantity: parseInt(newStock.quantity),
          manufacturing_date: new Date(newStock.manufacturing_date).toISOString(),
          notes: newStock.notes,
        },
      });

      toast("Stock added successfully", "success");
      onRefresh();
      setNewStock({
        quantity: "",
        manufacturing_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to add stock", "error");
    } finally {
      setAddingStock(false);
    }
  }

  // Helper function to get stock status
  function getStockStatus(expireDate) {
    const daysUntilExpiry = Math.ceil(
      (new Date(expireDate) - new Date()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      return { status: "expired", color: "red", label: "Expired" };
    } else if (daysUntilExpiry <= 30) {
      return {
        status: "expiring-soon",
        color: "amber",
        label: `${daysUntilExpiry} days left`,
      };
    } else {
      return {
        status: "good",
        color: "green",
        label: `${daysUntilExpiry} days left`,
      };
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container - Full screen on mobile, max-width on desktop */}
      <div className="relative bg-white dark:bg-gray-900 w-full sm:rounded-2xl shadow-2xl sm:max-w-6xl flex flex-col max-h-[100vh] sm:max-h-[90vh] overflow-hidden">
        
        {/* Header - Fixed */}
        <div className="flex-shrink-0 px-4 sm:px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <FiDatabase className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-bold truncate">
                    Stock Management
                  </h3>
                  <p className="text-sm text-indigo-100 truncate">
                    {product.product_name} ({product.product_code})
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/20 transition-colors ml-3"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Stock Summary Cards - Compact */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mt-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2 mb-1">
                <FiPackage className="w-4 h-4 text-indigo-200" />
                <span className="text-xs text-indigo-200">Total Stock</span>
              </div>
              <p className="text-2xl font-black">
                {stockSummary.totalQuantity}
              </p>
              <p className="text-xs text-indigo-200">CBs</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-2 mb-1">
                <FiBarChart2 className="w-4 h-4 text-indigo-200" />
                <span className="text-xs text-indigo-200">Entries</span>
              </div>
              <p className="text-2xl font-black">
                {stockSummary.totalEntries}
              </p>
              <p className="text-xs text-indigo-200">Batches</p>
            </div>

            <div className="bg-amber-500/20 backdrop-blur-sm rounded-xl p-3 border border-amber-400/30">
              <div className="flex items-center gap-2 mb-1">
                <FiAlertTriangle className="w-4 h-4 text-amber-200" />
                <span className="text-xs text-amber-200">Expiring Soon</span>
              </div>
              <p className="text-2xl font-black text-amber-100">
                {stockSummary.expiringSoon}
              </p>
              <p className="text-xs text-amber-200">Within 30 days</p>
            </div>

            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-3 border border-red-400/30">
              <div className="flex items-center gap-2 mb-1">
                <FiAlertCircle className="w-4 h-4 text-red-200" />
                <span className="text-xs text-red-200">Expired</span>
              </div>
              <p className="text-2xl font-black text-red-100">
                {stockSummary.expired}
              </p>
              <p className="text-xs text-red-200">Past date</p>
            </div>
          </div>
        </div>

        {/* Main Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Add Stock Form - Enhanced */}
              <div className="order-2 lg:order-1">
                <div className="sticky top-0 bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800 shadow-lg p-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="p-2 bg-indigo-600 rounded-xl">
                      <FiPlus className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                        Add New Stock Entry
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">
                        Record incoming inventory
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleAddStock} className="space-y-4">
                    {/* Quantity Input */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Quantity (CBs) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <FiPackage className="w-4 h-4" />
                        </div>
                        <input
                          type="number"
                          value={newStock.quantity}
                          onChange={(e) =>
                            setNewStock({ ...newStock, quantity: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none"
                          placeholder="Enter quantity"
                          required
                          min="1"
                        />
                      </div>
                    </div>

                    {/* Manufacturing Date */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Manufacturing Date <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <FiCalendar className="w-4 h-4" />
                        </div>
                        <input
                          type="date"
                          value={newStock.manufacturing_date}
                          onChange={(e) =>
                            setNewStock({
                              ...newStock,
                              manufacturing_date: e.target.value,
                            })
                          }
                          max={new Date().toISOString().split("T")[0]}
                          className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none"
                          required
                        />
                      </div>
                      {product.life_of_product_in_months && newStock.manufacturing_date && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg">
                          <FiClock className="w-3 h-3" />
                          <span>
                            Expires on:{" "}
                            <span className="font-semibold text-red-600 dark:text-red-400">
                              {new Date(
                                new Date(newStock.manufacturing_date).setMonth(
                                  new Date(newStock.manufacturing_date).getMonth() +
                                    product.life_of_product_in_months
                                )
                              ).toLocaleDateString()}
                            </span>
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Notes (Optional)
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-3 text-gray-400">
                          <FiFileText className="w-4 h-4" />
                        </div>
                        <textarea
                          value={newStock.notes}
                          onChange={(e) =>
                            setNewStock({ ...newStock, notes: e.target.value })
                          }
                          className="w-full pl-10 pr-4 py-2.5 border-2 rounded-xl border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 transition-all outline-none resize-none"
                          placeholder="Add any additional notes (batch number, supplier, etc.)"
                          rows="3"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <button
                      type="submit"
                      disabled={addingStock}
                      className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2"
                    >
                      {addingStock ? (
                        <>
                          <FiRefreshCw className="w-4 h-4 animate-spin" />
                          Adding Stock...
                        </>
                      ) : (
                        <>
                          <FiPlus className="w-4 h-4" />
                          Add Stock Entry
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Stock List - Enhanced */}
              <div className="order-1 lg:order-2">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  
                  {/* List Header */}
                  <div className="px-5 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          Stock Entries
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                          {stockData.length} total entries
                        </p>
                      </div>
                      <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-sm font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-800/40 transition-colors disabled:opacity-50"
                      >
                        <FiRefreshCw
                          className={loading ? "animate-spin w-4 h-4" : "w-4 h-4"}
                        />
                        <span className="hidden sm:inline">Refresh</span>
                      </button>
                    </div>
                  </div>

                  {/* List Content */}
                  <div className="p-4">
                    {loading ? (
                      <div className="text-center py-12">
                        <FiRefreshCw className="inline animate-spin w-8 h-8 mb-3 text-indigo-600 dark:text-indigo-400" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">
                          Loading stock data...
                        </p>
                      </div>
                    ) : stockData.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl mb-4">
                          <FiDatabase className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 font-medium mb-1">
                          No stock entries found
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          Add your first stock entry using the form
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin">
                        {stockData.map((stock) => {
                          const status = getStockStatus(stock.expire_date);
                          return (
                            <StockEntryCard
                              key={stock.id}
                              stock={stock}
                              status={status}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Mobile Only */}
        <div className="lg:hidden flex-shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Stock Entry Card Component
function StockEntryCard({ stock, status }) {
  const statusConfig = {
    expired: {
      bgColor: "bg-red-50 dark:bg-red-900/20",
      borderColor: "border-red-200 dark:border-red-800",
      badgeColor: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
      icon: FiAlertCircle,
      iconColor: "text-red-600 dark:text-red-400",
    },
    "expiring-soon": {
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      badgeColor:
        "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
      icon: FiAlertTriangle,
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    good: {
      bgColor: "bg-green-50 dark:bg-green-900/20",
      borderColor: "border-green-200 dark:border-green-800",
      badgeColor:
        "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300",
      icon: FiCheckCircle,
      iconColor: "text-green-600 dark:text-green-400",
    },
  };

  const config = statusConfig[status.status];
  const StatusIcon = config.icon;

  return (
    <div
      className={`p-4 border-2 rounded-xl ${config.bgColor} ${config.borderColor} hover:shadow-lg transition-all duration-300 group`}
    >
      <div className="flex items-start justify-between mb-3">
        {/* Quantity */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm">
            <FiPackage className={`w-5 h-5 ${config.iconColor}`} />
          </div>
          <div>
            <div className="text-2xl font-black text-gray-900 dark:text-gray-100">
              {stock.quantity}
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400 ml-1">
                CBs
              </span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-0.5">
              <FiCalendar className="w-3 h-3" />
              Mfd: {new Date(stock.manufacturing_date).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${config.badgeColor} text-xs font-bold`}
        >
          <StatusIcon className="w-3 h-3" />
          <span>{status.label}</span>
        </div>
      </div>

      {/* Expiry and Entry Info */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <FiAlertCircle className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Expiry Date
            </span>
          </div>
          <p
            className={`text-sm font-bold ${
              status.status === "expired"
                ? "text-red-600 dark:text-red-400"
                : status.status === "expiring-soon"
                ? "text-amber-600 dark:text-amber-400"
                : "text-gray-900 dark:text-gray-100"
            }`}
          >
            {new Date(stock.expire_date).toLocaleDateString()}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <FiClock className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-600 dark:text-gray-400">
              Entry Date
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
            {new Date(stock.date_of_entry).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Notes */}
      {stock.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-2">
            <FiFileText className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">
                Notes:
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
                {stock.notes}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Scrollbar styles (add to your global CSS)
const scrollbarStyles = `
  .scrollbar-thin::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #CBD5E1;
    border-radius: 9999px;
  }
  
  .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #94A3B8;
  }
  
  .dark .scrollbar-thin::-webkit-scrollbar-thumb {
    background: #475569;
  }
  
  .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
    background: #64748B;
  }
`;