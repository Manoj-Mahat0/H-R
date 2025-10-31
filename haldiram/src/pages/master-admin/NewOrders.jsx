// src/pages/master-admin/CustomerList.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import MasterAdminSidebar from "../../components/MasterAdminSidebar";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../components/Toast";
import { API_BASE, API_HOST } from "../../lib/config";
import { authFetch } from "../../lib/auth";
import {
    FiSearch,
    FiX,
    FiPlus,
    FiTrash2,
    FiUser,
    FiMail,
    FiPhone,
    FiEdit2,
    FiEye,
    FiRefreshCw,
    FiUsers,
    FiCheckCircle,
    FiXCircle,
    FiMoreVertical,
    FiFilter,
    FiDownload,
    FiArrowLeft,
    FiFileText,
    FiShoppingCart
} from "react-icons/fi";

/**
 * CustomerList - Display all customers (vendors)
 *
 * Features:
 * - List all vendor users
 * - Search and filter customers
 * - View customer details
 * - Active/Inactive status indicators
 * - Modern card and table views
 * - Export customer data
 */

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = [
    "from-blue-500 to-purple-600",
    "from-green-500 to-emerald-600",
    "from-orange-500 to-red-600",
    "from-pink-500 to-rose-600",
    "from-indigo-500 to-blue-600",
    "from-yellow-500 to-orange-600",
    "from-teal-500 to-cyan-600",
    "from-violet-500 to-purple-600"
];

function getAvatarColor(id) {
    return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

export default function NewOrders() {
    const { token } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const mountedRef = useRef(true);

    // State
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all"); // all, active, inactive
    const [viewMode, setViewMode] = useState("grid"); // grid or table
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    // Add state for vendor limits and orders
    const [vendorLimits, setVendorLimits] = useState([]);
    const [vendorOrders, setVendorOrders] = useState([]);
    const [loadingVendorData, setLoadingVendorData] = useState(false);
    // Add state for order creation
    const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
    const [products, setProducts] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [loadingVehicles, setLoadingVehicles] = useState(false);
    const [creatingOrder, setCreatingOrder] = useState(false);

    // API helper
    async function apiRequest(path, opts = {}) {
        if ((!opts.method || opts.method === "GET") && token) {
            return await authFetch(path, opts);
        }

        const headers = { Accept: "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const fetchOpts = { method: opts.method || "GET", headers };
        
        if (opts.body != null) {
            if (!(opts.body instanceof FormData)) {
                headers["Content-Type"] = "application/json";
                fetchOpts.body = JSON.stringify(opts.body);
            } else {
                fetchOpts.body = opts.body;
            }
        }

        const base = `${API_HOST ?? ""}${API_BASE ?? ""}`.replace(/\/$/, "");
        const suffix = String(path ?? "").replace(/^\//, "");
        const url = `${base}/${suffix}`;

        const res = await fetch(url, fetchOpts);
        const text = await res.text();
        let data = null;
        try { data = text ? JSON.parse(text) : null; } catch { data = text; }

        if (!res.ok) {
            const msg = (data && (data.detail || data.message || data.error)) || 
                       (typeof data === "string" ? data : `Request failed: ${res.status}`);
            const err = new Error(msg);
            err.status = res.status;
            err.raw = data;
            throw err;
        }
        return data;
    }

    // Fetch users
    async function fetchUsers(showRefreshToast = false) {
        try {
            if (showRefreshToast) setRefreshing(true);
            else setLoading(true);

            const data = await apiRequest("/users/");
            
            if (!mountedRef.current) return;
            setAllUsers(Array.isArray(data) ? data : []);
            
            if (showRefreshToast) {
                toast("Customer list refreshed", "success");
            }
        } catch (err) {
            console.error("fetch users error", err);
            toast(err.message || "Failed to load customers", "error");
            setAllUsers([]);
        } finally {
            if (mountedRef.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }

    // Initial load
    useEffect(() => {
        mountedRef.current = true;
        fetchUsers();
        return () => { mountedRef.current = false; };
    }, [token]);

    // Filter vendors (customers) only
    const customers = useMemo(() => {
        return allUsers.filter(user => user.role === "vendor");
    }, [allUsers]);

    // Apply search and filters
    const filteredCustomers = useMemo(() => {
        let result = [...customers];

        // Search filter
        if (searchTerm.trim()) {
            const search = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name?.toLowerCase().includes(search) ||
                c.email?.toLowerCase().includes(search) ||
                String(c.id).includes(search)
            );
        }

        // Status filter
        if (filterStatus === "active") {
            result = result.filter(c => c.active === true);
        } else if (filterStatus === "inactive") {
            result = result.filter(c => c.active === false);
        }

        return result;
    }, [customers, searchTerm, filterStatus]);

    // Stats
    const stats = useMemo(() => ({
        total: customers.length,
        active: customers.filter(c => c.active).length,
        inactive: customers.filter(c => !c.active).length
    }), [customers]);

    // Export to CSV
    function exportToCSV() {
        if (filteredCustomers.length === 0) {
            toast("No customers to export", "warning");
            return;
        }

        const headers = ["ID", "Name", "Email", "Status"];
        const rows = filteredCustomers.map(c => [
            c.id,
            c.name,
            c.email,
            c.active ? "Active" : "Inactive"
        ]);

        const csv = [
            headers.join(","),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
        ].join("\n");

        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `customers-${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast("Customer list exported", "success");
    }

    // Fetch vendor limits and orders when viewing customer details
    async function fetchVendorData(vendorId) {
        if (!vendorId) return;
        
        try {
            setLoadingVendorData(true);
            
            // Fetch vendor limits
            const limitsData = await apiRequest(`/vendor-limits/?vendor_id=${vendorId}`);
            setVendorLimits(Array.isArray(limitsData) ? limitsData : []);
            
            // Fetch vendor orders
            const ordersData = await apiRequest(`/v2/orders/`);
            // Filter orders for this specific vendor
            const vendorOrdersData = Array.isArray(ordersData) 
                ? ordersData.filter(order => order.vendor_id === vendorId)
                : [];
            setVendorOrders(vendorOrdersData);
        } catch (err) {
            console.error("fetch vendor data error", err);
            toast(err.message || "Failed to load vendor data", "error");
            setVendorLimits([]);
            setVendorOrders([]);
        } finally {
            setLoadingVendorData(false);
        }
    }

    // Fetch products for order creation
    async function fetchProducts() {
        try {
            setLoadingProducts(true);
            const data = await apiRequest("/v2/products/");
            setProducts(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("fetch products error", err);
            toast(err.message || "Failed to load products", "error");
            setProducts([]);
        } finally {
            setLoadingProducts(false);
        }
    }

    // Fetch vehicles for order creation
    async function fetchVehicles() {
        try {
            setLoadingVehicles(true);
            const data = await apiRequest("/vehicles/?me_only=true");
            setVehicles(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error("fetch vehicles error", err);
            toast(err.message || "Failed to load vehicles", "error");
            setVehicles([]);
        } finally {
            setLoadingVehicles(false);
        }
    }

    // Create order function
    async function createOrder(orderData) {
        try {
            setCreatingOrder(true);
            const data = await apiRequest("/v2/orders/", {
                method: "POST",
                body: orderData
            });
            toast("Order created successfully", "success");
            // Refresh vendor orders
            if (selectedCustomer) {
                fetchVendorData(selectedCustomer.id);
            }
            return data;
        } catch (err) {
            console.error("create order error", err);
            toast(err.message || "Failed to create order", "error");
            throw err;
        } finally {
            setCreatingOrder(false);
        }
    }

    // View customer details and fetch vendor data
    function viewCustomerDetails(customer) {
        setSelectedCustomer(customer);
        // Fetch vendor limits and orders for this customer
        fetchVendorData(customer.id);
        // Show the details modal
        setShowDetailsModal(true);
    }

    if (loading) {
        return (
            <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
                <MasterAdminSidebar />
                <main className="flex-1 p-8">
                    <div className="animate-pulse space-y-6">
                        <div className="bg-white rounded-2xl shadow-sm p-6 dark:bg-gray-800 dark:border dark:border-gray-700">
                            <div className="h-8 w-1/3 bg-gray-200 rounded-lg mb-4 dark:bg-gray-700" />
                            <div className="h-4 w-1/4 bg-gray-200 rounded mb-6 dark:bg-gray-700" />
                            <div className="grid grid-cols-3 gap-4">
                                <div className="h-32 bg-gray-200 rounded-xl dark:bg-gray-700" />
                                <div className="h-32 bg-gray-200 rounded-xl dark:bg-gray-700" />
                                <div className="h-32 bg-gray-200 rounded-xl dark:bg-gray-700" />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <MasterAdminSidebar />
            <main className="flex-1 p-4 sm:p-6 md:p-8">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                                <FiUsers className="w-7 h-7 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 dark:text-white">
                                    All Customers
                                </h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Manage and view all vendor customers
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <button
                                onClick={() => fetchUsers(true)}
                                disabled={refreshing}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-all duration-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                <FiRefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                                {refreshing ? "Refreshing..." : "Refresh"}
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all duration-200"
                            >
                                <FiDownload className="w-4 h-4" />
                                Export
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">Total Customers</p>
                                <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center dark:from-blue-900 dark:to-blue-800">
                                <FiUsers className="w-6 h-6 text-blue-600 dark:text-blue-300" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">Active</p>
                                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.active}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-green-200 rounded-xl flex items-center justify-center dark:from-green-900 dark:to-green-800">
                                <FiCheckCircle className="w-6 h-6 text-green-600 dark:text-green-300" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 dark:bg-gray-800 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 mb-1 dark:text-gray-400">Inactive</p>
                                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.inactive}</p>
                            </div>
                            <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center dark:from-red-900 dark:to-red-800">
                                <FiXCircle className="w-6 h-6 text-red-600 dark:text-red-300" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 dark:bg-gray-800 dark:border-gray-700">
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="flex-1 w-full lg:w-auto">
                            <div className="relative">
                                <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-300" />
                                <input
                                    type="text"
                                    placeholder="Search customers by name, email, or ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg dark:hover:bg-gray-600"
                                    >
                                        <FiX className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                            <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-xl p-1 dark:bg-gray-700">
                                <button
                                    onClick={() => setFilterStatus("all")}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center transition-all duration-200 ${
                                        filterStatus === "all"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setFilterStatus("active")}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center transition-all duration-200 ${
                                        filterStatus === "active"
                                            ? "bg-white text-green-600 shadow-sm dark:bg-gray-600 dark:text-green-400"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setFilterStatus("inactive")}
                                    className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium text-center transition-all duration-200 ${
                                        filterStatus === "inactive"
                                            ? "bg-white text-red-600 shadow-sm dark:bg-gray-600 dark:text-red-400"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    Inactive
                                </button>
                            </div>

                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-1 dark:bg-gray-700">
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                                        viewMode === "grid"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                                    </svg>
                                </button>
                                <button
                                    onClick={() => setViewMode("table")}
                                    className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                                        viewMode === "table"
                                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white"
                                            : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results */}
                {filteredCustomers.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center dark:bg-gray-800 dark:border-gray-700">
                        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 dark:bg-gray-700">
                            <FiUsers className="w-10 h-10 text-gray-400 dark:text-gray-300" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2 dark:text-white">
                            No Customers Found
                        </h3>
                        <p className="text-gray-500 mb-6 dark:text-gray-400">
                            {searchTerm || filterStatus !== "all"
                                ? "Try adjusting your search or filters"
                                : "No vendor customers in the system yet"}
                        </p>
                        {(searchTerm || filterStatus !== "all") && (
                            <button
                                onClick={() => {
                                    setSearchTerm("");
                                    setFilterStatus("all");
                                }}
                                className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200"
                            >
                                Clear Filters
                            </button>
                        )}
                    </div>
                ) : viewMode === "grid" ? (
                    // Grid View
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredCustomers.map((customer) => (
                            <div
                                key={customer.id}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg transition-all duration-200 dark:bg-gray-800 dark:border-gray-700"
                            >
                                <div className="flex flex-col items-center text-center">
                                    {/* Avatar */}
                                    <div className={`w-20 h-20 rounded-full bg-gradient-to-br ${getAvatarColor(customer.id)} flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4`}>
                                        {getInitials(customer.name)}
                                    </div>

                                    {/* Name */}
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1 dark:text-white">
                                        {customer.name}
                                    </h3>

                                    {/* Email */}
                                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-3 dark:text-gray-400">
                                        <FiMail className="w-4 h-4" />
                                        <span className="truncate">{customer.email}</span>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mb-4">
                                        {customer.active ? (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium dark:bg-green-900 dark:text-green-300">
                                                <FiCheckCircle className="w-3 h-3" />
                                                Active
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium dark:bg-red-900 dark:text-red-300">
                                                <FiXCircle className="w-3 h-3" />
                                                Inactive
                                            </span>
                                        )}
                                    </div>

                                    {/* ID Badge */}
                                    <div className="text-xs text-gray-400 mb-4 dark:text-gray-500">
                                        ID: #{customer.id}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 w-full">
                                        <button
                                            onClick={() => viewCustomerDetails(customer)}
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors duration-200"
                                        >
                                            <FiEye className="w-4 h-4" />
                                            View
                                        </button>
                                        
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Table View
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden dark:bg-gray-800 dark:border-gray-700">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b border-gray-200 dark:bg-gray-900 dark:border-gray-700">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-300">
                                            Customer
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-300">
                                            Email
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-300">
                                            ID
                                        </th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-300">
                                            Status
                                        </th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider dark:text-gray-300">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredCustomers.map((customer) => (
                                        <tr key={customer.id} className="hover:bg-gray-50 transition-colors duration-150 dark:hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarColor(customer.id)} flex items-center justify-center text-white font-semibold text-sm`}>
                                                        {getInitials(customer.name)}
                                                    </div>
                                                    <div className="font-medium text-gray-900 dark:text-white">
                                                        {customer.name}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                                                    <FiMail className="w-4 h-4 text-gray-400" />
                                                    {customer.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                #{customer.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {customer.active ? (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium dark:bg-green-900 dark:text-green-300">
                                                        <FiCheckCircle className="w-3 h-3" />
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium dark:bg-red-900 dark:text-red-300">
                                                        <FiXCircle className="w-3 h-3" />
                                                        Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => viewCustomerDetails(customer)}
                                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-150 dark:text-blue-400 dark:hover:bg-blue-900"
                                                        title="View Details"
                                                    >
                                                        <FiEye className="w-4 h-4" />
                                                    </button>
                                                    

                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Results count */}
                {filteredCustomers.length > 0 && (
                    <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
                        Showing {filteredCustomers.length} of {customers.length} customers
                    </div>
                )}
            </main>

            {/* Customer Details Modal */}
            {showDetailsModal && selectedCustomer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg md:max-w-4xl w-full max-h-[90vh] overflow-y-auto dark:bg-gray-800">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Customer Details</h2>
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-150 dark:hover:bg-gray-700"
                            >
                                <FiX className="w-6 h-6 text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Avatar and basic info */}
                            <div className="flex flex-col items-center text-center mb-8">
                                <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${getAvatarColor(selectedCustomer.id)} flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4`}>
                                    {getInitials(selectedCustomer.name)}
                                </div>
                                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 dark:text-white">
                                    {selectedCustomer.name}
                                </h3>
                                {selectedCustomer.active ? (
                                    <span className="inline-flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium dark:bg-green-900 dark:text-green-300">
                                        <FiCheckCircle className="w-4 h-4" />
                                        Active Customer
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium dark:bg-red-900 dark:text-red-300">
                                        <FiXCircle className="w-4 h-4" />
                                        Inactive
                                    </span>
                                )}
                            </div>

                            {/* Details grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                                <div className="bg-gray-50 rounded-xl p-4 dark:bg-gray-900">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center dark:bg-blue-900">
                                            <FiUser className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Customer ID</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">#{selectedCustomer.id}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 dark:bg-gray-900">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center dark:bg-purple-900">
                                            <FiMail className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Email Address</div>
                                            <div className="font-semibold text-gray-900 dark:text-white">{selectedCustomer.email}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 dark:bg-gray-900">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center dark:bg-green-900">
                                            <FiUsers className="w-5 h-5 text-green-600 dark:text-green-300" />
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Role</div>
                                            <div className="font-semibold text-gray-900 capitalize dark:text-white">{selectedCustomer.role}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-4 dark:bg-gray-900">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className={`w-10 h-10 ${selectedCustomer.active ? 'bg-green-100' : 'bg-red-100'} rounded-lg flex items-center justify-center dark:${selectedCustomer.active ? 'bg-green-900' : 'bg-red-900'}`}>
                                            {selectedCustomer.active ? (
                                                <FiCheckCircle className="w-5 h-5 text-green-600 dark:text-green-300" />
                                            ) : (
                                                <FiXCircle className="w-5 h-5 text-red-600 dark:text-red-300" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">Account Status</div>
                                            <div className={`font-semibold ${selectedCustomer.active ? 'text-green-600' : 'text-red-600'} dark:text-white`}>
                                                {selectedCustomer.active ? 'Active' : 'Inactive'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vendor Limits Section */}
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 dark:text-white flex items-center gap-2">
                                    <FiFileText className="w-5 h-5" />
                                    Vendor Limits
                                </h3>
                                

                                {loadingVendorData ? (
                                    <div className="animate-pulse space-y-4">
                                        <div className="h-4 bg-gray-200 rounded w-3/4 dark:bg-gray-700"></div>
                                        <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
                                        <div className="h-4 bg-gray-200 rounded w-5/6 dark:bg-gray-700"></div>
                                    </div>
                                ) : vendorLimits.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-xl dark:bg-gray-900">
                                        <FiFileText className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">No vendor limits set for this customer</p>
                                    </div>
                                ) : (
                                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden dark:bg-gray-900 dark:border-gray-700">
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                                <thead className="bg-gray-50 dark:bg-gray-800">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Month</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Amount Limit</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Box Limit</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Note</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">Created</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200 dark:bg-gray-900 dark:divide-gray-700">
                                                    {vendorLimits.map((limit) => (
                                                        <tr key={limit.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                                                {limit.month || "ALL"}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {limit.limit_amount > 0 ? `₹${limit.limit_amount}` : "-"}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {limit.limit_boxes > 0 ? `${limit.limit_boxes} boxes` : "-"}
                                                            </td>
                                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                                                                {limit.note || "-"}
                                                            </td>
                                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                                {new Date(limit.created_at).toLocaleDateString()}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Order History Section */}
                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 dark:text-white flex items-center gap-2">
                                    <FiShoppingCart className="w-5 h-5" />
                                    Order History
                                </h3>
                                

                                {loadingVendorData ? (
                                    <div className="animate-pulse space-y-4">
                                        <div className="h-4 bg-gray-200 rounded w-3/4 dark:bg-gray-700"></div>
                                        <div className="h-4 bg-gray-200 rounded dark:bg-gray-700"></div>
                                        <div className="h-4 bg-gray-200 rounded w-5/6 dark:bg-gray-700"></div>
                                    </div>
                                ) : vendorOrders.length === 0 ? (
                                    <div className="text-center py-8 bg-gray-50 rounded-xl dark:bg-gray-900">
                                        <FiShoppingCart className="w-12 h-12 mx-auto text-gray-400 dark:text-gray-500 mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">No orders found for this customer</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {vendorOrders.map((order) => (
                                            <div key={order.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 dark:bg-gray-900 dark:border-gray-700">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                                                                Order #{order.id}
                                                            </h4>
                                                            <StatusBadge status={order.status} />
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-300 mb-1">
                                                            <span className="font-medium">Type:</span> {order.order_type}
                                                        </div>
                                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                                            <span className="font-medium">Items:</span> {order.items.length} items
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-lg font-bold text-gray-900 dark:text-white">
                                                            ₹{order.total_amount}
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            {new Date(order.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {order.shipping_address && (
                                                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                                            <span className="font-medium">Shipping:</span> {order.shipping_address}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {order.notes && (
                                                    <div className="mt-2">
                                                        <div className="text-sm text-gray-600 dark:text-gray-300">
                                                            <span className="font-medium">Notes:</span> {order.notes}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button 
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors duration-200"
                                    onClick={() => setShowCreateOrderModal(true)}
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Create Order
                                </button>
                                <button className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors duration-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600">
                                    <FiEye className="w-4 h-4" />
                                    View Orders
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Create Order Modal */}
            {showCreateOrderModal && selectedCustomer && (
                <CreateOrderForm 
                    vendor={selectedCustomer} 
                    onClose={() => setShowCreateOrderModal(false)}
                    onSuccess={() => {
                        toast("Order created successfully", "success");
                        // Refresh the vendor orders
                        fetchVendorData(selectedCustomer.id);
                    }}
                />
            )}
        </div>
    );

    // Status badge component
    function StatusBadge({ status }) {
        const map = {
            placed: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
            confirmed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
            processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
            shipped: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
            received: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            payment_checked: "bg-green-200 text-green-800 dark:bg-green-800 dark:text-green-200",
            approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
            cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
            returned: "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200",
            deleted: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
        };

        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${map[status] || "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"} capitalize`}>
                {String(status || "").replaceAll("_", " ")}
            </span>
        );
    }

    // Order creation form component
    function CreateOrderForm({ vendor, onClose, onSuccess }) {
        const [form, setForm] = useState({
            vendor_id: vendor.id,
            order_type: "admin_to_vendor",
            vehicle_id: "",
            shipping_address: vendor.address || "Vendor Location, Mumbai",
            notes: "Stock replenishment request",
            items: [
                { product_id: "", qty: "", unit_price: "", notes: "" }
            ]
        });

        const [addingItem, setAddingItem] = useState(false);

        // Fetch products and vehicles when component mounts
        useEffect(() => {
            fetchProducts();
            fetchVehicles();
        }, []);

        const handleItemChange = (index, field, value) => {
            const newItems = [...form.items];
            newItems[index][field] = value;
            
            // Auto-fill unit price when product is selected
            if (field === "product_id") {
                const product = products.find(p => p.id === parseInt(value));
                if (product) {
                    newItems[index].unit_price = product.mrp || 0;
                }
            }
            
            setForm({ ...form, items: newItems });
        };

        const addItem = () => {
            setForm({
                ...form,
                items: [...form.items, { product_id: "", qty: "", unit_price: "", notes: "" }]
            });
        };

        const removeItem = (index) => {
            if (form.items.length > 1) {
                const newItems = form.items.filter((_, i) => i !== index);
                setForm({ ...form, items: newItems });
            }
        };

        const handleSubmit = async (e) => {
            e.preventDefault();
            
            // Validate form
            if (!form.vendor_id) {
                toast("Please select a vendor", "error");
                return;
            }
            
            if (form.items.some(item => !item.product_id || !item.qty)) {
                toast("Please fill in all required item fields", "error");
                return;
            }
            
            // Prepare order data
            const orderData = {
                vendor_id: form.vendor_id,
                order_type: form.order_type,
                vehicle_id: form.vehicle_id ? parseInt(form.vehicle_id) : null,
                shipping_address: form.shipping_address,
                notes: form.notes,
                items: form.items.map(item => ({
                    product_id: parseInt(item.product_id),
                    qty: parseInt(item.qty),
                    unit_price: parseFloat(item.unit_price) || 0,
                    notes: item.notes || ""
                }))
            };
            
            try {
                await createOrder(orderData);
                onSuccess();
                onClose();
            } catch (err) {
                // Error already handled in createOrder
            }
        };

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl shadow-2xl max-w-lg md:max-w-4xl w-full max-h-[90vh] overflow-y-auto dark:bg-gray-800">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between dark:bg-gray-800 dark:border-gray-700">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Create Order for {vendor.name}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-xl transition-colors duration-150 dark:hover:bg-gray-700"
                        >
                            <FiX className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Order Type
                                </label>
                                <select
                                    value={form.order_type}
                                    onChange={(e) => setForm({ ...form, order_type: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="admin_to_vendor">Admin to Vendor</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Vehicle
                                </label>
                                <select
                                    value={form.vehicle_id}
                                    onChange={(e) => setForm({ ...form, vehicle_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                >
                                    <option value="">No Vehicle</option>
                                    {vehicles.map(vehicle => (
                                        <option key={vehicle.id} value={vehicle.id}>
                                            {vehicle.vehicle_number} ({vehicle.details})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Shipping Address
                                </label>
                                <input
                                    type="text"
                                    value={form.shipping_address}
                                    onChange={(e) => setForm({ ...form, shipping_address: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    placeholder="Enter shipping address"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Notes
                                </label>
                                <textarea
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                    placeholder="Enter order notes"
                                    rows="3"
                                />
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Order Items</h3>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center justify-center sm:justify-start gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200 w-full sm:w-auto"
                                >
                                    <FiPlus className="w-4 h-4" />
                                    Add Item
                                </button>
                            </div>

                            {loadingProducts ? (
                                <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                                    Loading products...
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {form.items.map((item, index) => (
                                        <div key={index} className="bg-gray-50 rounded-xl p-4 dark:bg-gray-900">
                                            {/* Responsive Grid: grid-cols-2 on mobile, grid-cols-12 on medium+ */}
                                            <div className="grid grid-cols-2 md:grid-cols-12 gap-4">
                                                {/* Product: takes full width on mobile (col-span-2) */}
                                                <div className="col-span-2 md:col-span-5">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Product *
                                                    </label>
                                                    <select
                                                        value={item.product_id}
                                                        onChange={(e) => handleItemChange(index, "product_id", e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                                        required
                                                    >
                                                        <option value="">Select a product</option>
                                                        {products.map(product => (
                                                            <option key={product.id} value={product.id}>
                                                                {product.product_name} ({product.product_code})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Quantity: half width on mobile (col-span-1) */}
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Quantity *
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={item.qty}
                                                        onChange={(e) => handleItemChange(index, "qty", e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                                        placeholder="Qty"
                                                        required
                                                    />
                                                </div>

                                                {/* Unit Price: half width on mobile (col-span-1) */}
                                                <div className="col-span-1 md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Unit Price
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.unit_price}
                                                        onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                                        placeholder="Price"
                                                    />
                                                </div>

                                                {/* Notes: full width on mobile (col-span-2) */}
                                                <div className="col-span-2 md:col-span-2">
                                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                                        Notes
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.notes}
                                                        onChange={(e) => handleItemChange(index, "notes", e.target.value)}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-900 dark:border-gray-600 dark:text-white"
                                                        placeholder="Item notes"
                                                    />
                                                </div>

                                                {/* Remove Button: full width on mobile (col-span-2), aligned to bottom on desktop */}
                                                <div className="col-span-2 md:col-span-1 flex items-start md:items-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        disabled={form.items.length <= 1}
                                                        className={`w-full md:w-auto p-3 rounded-lg ${form.items.length <= 1 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                    >
                                                        <FiTrash2 className="w-4 h-4 mx-auto md:mx-0" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 transition-colors duration-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                                disabled={creatingOrder}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors duration-200 flex items-center justify-center gap-2"
                                disabled={creatingOrder}
                            >
                                {creatingOrder ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Creating...
                                    </>
                                ) : (
                                    "Create Order"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    }

}