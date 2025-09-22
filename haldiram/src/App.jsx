import StaffOrders from "./pages/staff/Orders";
import StaffDashboard from "./pages/staff/Dashboard";
// src/App.jsx
import React from "react";
import { Routes, Route, useLocation } from "react-router-dom";

import Header from "./components/Header";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ChatPage from "./pages/Chat"; // Importing ChatPage
import FloatingChat from "./components/FloatingChat";
// import Products from "./pages/Products";
// import About from "./pages/About";
import Dashboard from "./pages/Dashboard";
import MasterAdminProducts from "./pages/master-admin/MasterAdminProducts";
import MasterAdminOrders from "./pages/master-admin/Orders";
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
import AccountantDashboard from "./pages/accountant/Dashboard";
import AccountantTransactions from "./pages/accountant/Transactions";
import StaffProfile from "./pages/staff/Profile";
import MasterAdminProfile from "./pages/master-admin/Profile";
import AdminProfile from "./pages/admin/Profile";
import VendorProfile from "./pages/vendor/Profile";
import AccountantProfile from "./pages/accountant/Profile";

import DriverDashboard from "./pages/driver/Dashboard";
import DriverVehicles from "./pages/driver/Vehicles";

export default function App() {
  const location = useLocation();

  // Sirf in pages pe navbar dikhana hai, baaki sab pe nahi
  const showNavbarOn = ["/", "/login", "/signup"];
  const shouldShowNavbar = showNavbarOn.includes(location.pathname);

  return (
    <>
      {shouldShowNavbar && <Header />}
      {/* Floating Chat is always available */}
      <FloatingChat />
      <Routes>
        {/* ...existing routes... */}
        <Route path="/" element={<Landing />} />
        {/* <Route path="/products" element={<Products />} />
        <Route path="/about" element={<About />} /> */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* protected dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/master-admin/products" element={<ProtectedRoute><MasterAdminProducts /></ProtectedRoute>} />
        <Route path="/master-admin/orders" element={<ProtectedRoute><MasterAdminOrders /></ProtectedRoute>} />
        <Route path="/master-admin/categories" element={<ProtectedRoute><MasterAdminCategories /></ProtectedRoute>} />
        <Route path="/master-admin/tags" element={<ProtectedRoute><MasterAdminTags /></ProtectedRoute>} />
        <Route path="/master-admin/customers" element={<ProtectedRoute><MasterAdminCustomers /> </ProtectedRoute>} />
        <Route path="/master-admin/stock" element={<ProtectedRoute><MasterAdminStock /> </ProtectedRoute>} />
  <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard  /> </ProtectedRoute>} />
  <Route path="/accountant/dashboard" element={<ProtectedRoute><AccountantDashboard /> </ProtectedRoute>} />
        <Route path="/admin/products" element={<ProtectedRoute><AdminProducts /></ProtectedRoute>} />
        <Route path="/admin/categories" element={<ProtectedRoute><AdminCategories /></ProtectedRoute>} />
        <Route path="/admin/tags" element={<ProtectedRoute><AdminTags /></ProtectedRoute>} />
        <Route path="/admin/customers" element={<ProtectedRoute><AdminCustomers /> </ProtectedRoute>} />
        <Route path="/vendor/dashboard" element={<ProtectedRoute><VendorDashboard /> </ProtectedRoute>} />
        <Route path="/vendor/orders" element={<ProtectedRoute><VendorOrders  /> </ProtectedRoute>} />
        <Route path="/vendor/my-orders" element={<ProtectedRoute><VendorMyOrders  /> </ProtectedRoute>} />
        <Route path="/staff/dashboard" element={<ProtectedRoute><StaffDashboard /> </ProtectedRoute>} />
        <Route path="/staff/orders" element={<ProtectedRoute><StaffOrders /> </ProtectedRoute>} />
                <Route path="/staff/profile" element={<ProtectedRoute><StaffProfile /> </ProtectedRoute>} />
        <Route path="/master-admin/profile" element={<ProtectedRoute><MasterAdminProfile /> </ProtectedRoute>} />
        <Route path="/admin/profile" element={<ProtectedRoute><AdminProfile /> </ProtectedRoute>} />
        <Route path="/vendor/profile" element={<ProtectedRoute><VendorProfile /> </ProtectedRoute>} />
        <Route path="/accountant/profile" element={<ProtectedRoute><AccountantProfile /> </ProtectedRoute>} />
        <Route path="/driver/dashboard" element={<ProtectedRoute><DriverDashboard /> </ProtectedRoute>} />
          <Route path="/driver/vehicles" element={<ProtectedRoute><DriverVehicles /> </ProtectedRoute>} />


                <Route path="/accountant/transactions" element={<ProtectedRoute><AccountantTransactions /> </ProtectedRoute>} />

  {/* <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} /> Chat route removed, floating chat is always available */}
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
