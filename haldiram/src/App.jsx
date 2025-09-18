// src/App.jsx
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Header from "./components/Header";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
// import Products from "./pages/Products";
// import About from "./pages/About";
import Dashboard from "./pages/Dashboard";
import MasterAdminProducts from "./pages/master-admin/MasterAdminProducts";
import MasterAdminCategories from "./pages/master-admin/Categories";
import MasterAdminTags from "./pages/master-admin/Tags";
import MasterAdminCustomers from "./pages/master-admin/Customers";
import MasterAdminStock from "./pages/master-admin/Stock";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminCategories from "./pages/admin/Categories";
import AdminTags from "./pages/admin/Tags";
import AdminCustomers from "./pages/admin/Customers";
import VendorDashboard from "./pages/vendor/Dashboard";
import VendorOrders from "./pages/vendor/Orders";
import VendorMyOrders from "./pages/vendor/MyOrders";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  const location = useLocation();

  // jis page pe navbar nahi chahiye unke paths ka array
  const hideNavbarOn = ["/dashboard", "/master-admin/products", "/master-admin/categories", "/master-admin/tags", "/master-admin/customers,", "/admin/dashboard", "/admin/products", "/admin/categories", "/admin/tags", "/admin/customers", "/vendor/dashboard", "/vendor/orders", "/vendor/my-orders", "/master-admin/stock"];

  const shouldHideNavbar = hideNavbarOn.includes(location.pathname);

  return (
    <> 
      {!shouldHideNavbar && <Header />}

          <Routes>
            <Route path="/" element={<Landing />} />
            {/* <Route path="/products" element={<Products />} />
            <Route path="/about" element={<About />} /> */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />


            {/* protected dashboard */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/master-admin/products" element={<ProtectedRoute><MasterAdminProducts /></ProtectedRoute>} />
            <Route path="/master-admin/categories" element={<ProtectedRoute><MasterAdminCategories /></ProtectedRoute>} />
            <Route path="/master-admin/tags" element={<ProtectedRoute><MasterAdminTags /></ProtectedRoute>} />
        <Route path="/master-admin/customers" element={<ProtectedRoute><MasterAdminCustomers /> </ProtectedRoute>} />
                <Route path="/master-admin/stock" element={<ProtectedRoute><MasterAdminStock /> </ProtectedRoute>} />


        <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard  /> </ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
        <Route path="/admin/categories" element={<ProtectedRoute><AdminCategories /></ProtectedRoute>} />
        <Route path="/admin/tags" element={<ProtectedRoute><AdminTags /></ProtectedRoute>} />
        <Route path="/admin/customers" element={<ProtectedRoute><AdminCustomers /> </ProtectedRoute>} />

        <Route path="/vendor/dashboard" element={<ProtectedRoute><VendorDashboard /> </ProtectedRoute>} />
        <Route path="/vendor/orders" element={<ProtectedRoute><VendorOrders  /> </ProtectedRoute>} />
        <Route path="/vendor/my-orders" element={<ProtectedRoute><VendorMyOrders  /> </ProtectedRoute>} />


{/* import VendorDashboard from "./pages/vendor/Dashboard";

<Route path="/vendor/dashboard" element={<VendorDashboard />} /> */}
            <Route
              path="*"
              element={
                <div className="text-center py-20">
                  <h2 className="text-2xl font-semibold">
                    404 — Page not found
                  </h2>
                </div>
              }
            />
          </Routes>
          </>
  );
}
