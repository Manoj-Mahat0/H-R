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
import MasterAdminDeletedOrders from "./pages/master-admin/DeletedOrders";
import MasterAdminCategories from "./pages/master-admin/Categories";
import MasterAdminTags from "./pages/master-admin/Tags";
import MasterAdminCustomers from "./pages/master-admin/Customers";
import MasterAdminStock from "./pages/master-admin/Stock";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminProducts from "./pages/admin/Products";
import AdminCategories from "./pages/admin/Categories";
import AdminTags from "./pages/admin/Tags";
import AdminCustomers from "./pages/admin/Customers";
import AdminDeletedOrders from "./pages/admin/DeletedOrders";
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
import MasterVicles from "./pages/master-admin/MasterVehicles";
import MasterAddVicles from "./pages/master-admin/MasterAddVehicles";
import MasterVendorLimits from "./pages/master-admin/CustomerLimits";
import MasterOrdersMovement from "./pages/master-admin/MasterOrdersMovement";
import MasterOrdersMovementDetails from "./pages/master-admin/MasterOrdersMovementDetails";
import EditOrderItems from "./pages/master-admin/EditOrderItems";
import OrderDetail from "./pages/staff/OrderDetail";
import AccountantReports from "./pages/accountant/Reports";
import MasterAdminAttendance from "./pages/master-admin/MasterAdminAttendance";
import MasterAdminAttendanceDay from "./pages/master-admin/MasterAdminAttendanceDay";
import FloatingAttendance from "./components/FloatingAttendance";
import SecurityDashboard from "./security/SecurityDashboard";
import SecurityAttendanceDay from "./security/SecurityAttendanceDay";
import DriverProfile from "./pages/driver/Profile";
import AdminStock from "./pages/admin/Stock";
import AdminOrdersMovement from "./pages/admin/AdminOrdersMovement";
import AdminOrdersMovementDetails from "./pages/admin/AdminOrdersMovementDetails";
import AdminEditOrderItems from "./pages/admin/AdminEditOrderItems";
import AdminVehicles from "./pages/admin/AdminVehicles";
import AdminAddVehicles from "./pages/admin/AdminAddVehicles";
import AdminCustomerLimits from "./pages/admin/AdminCustomerLimits";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminAttendanceDay from "./pages/admin/AdminAttendanceDay";
import NotFound from "./pages/NotFound";

import NewOrders from "./pages/master-admin/NewOrders";
import NewProducts from "./pages/master-admin/NewProducts"
export default function App() {
  const location = useLocation();

  // Sirf in pages pe navbar dikhana hai, baaki sab pe nahi
  const showNavbarOn = [ "/login", "/signup"];
  const shouldShowNavbar = showNavbarOn.includes(location.pathname);

  return (
    <>
      {shouldShowNavbar && <Header />}
      {/* Floating Chat is always available */}
      <FloatingAttendance />
      <FloatingChat />
      <Routes>
        <Route path="/" element={<Landing />} />
        {/* <Route path="/products" element={<Products />} />
        <Route path="/about" element={<About />} /> */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* protected dashboard */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/master-admin/products" element={<ProtectedRoute><NewProducts /></ProtectedRoute>} />
        <Route path="/master-admin/orders" element={<ProtectedRoute><MasterAdminOrders /></ProtectedRoute>} />
        <Route path="/master-admin/new-orders" element={<ProtectedRoute><NewOrders /></ProtectedRoute>} />
        <Route path="/master-admin/orders/deleted" element={<ProtectedRoute><MasterAdminDeletedOrders /></ProtectedRoute>} />
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
          <Route path="/master-admin/vehicles" element={<ProtectedRoute><MasterVicles /> </ProtectedRoute>} />
                    <Route path="/master-admin/vehicles/add" element={<ProtectedRoute><MasterAddVicles /> </ProtectedRoute>} />

          <Route path="/master-admin/customers/add-limits" element={<ProtectedRoute><MasterVendorLimits /> </ProtectedRoute>} />
          <Route path="/master-admin/orders/movement" element={<ProtectedRoute><MasterOrdersMovement /> </ProtectedRoute>} />
          <Route path="/master-admin/orders/movement/:id" element={<ProtectedRoute><MasterOrdersMovementDetails /> </ProtectedRoute>} />
          <Route path="/master-admin/orders/:id/edit-items" element={<ProtectedRoute><EditOrderItems /> </ProtectedRoute>} />
                <Route path="/accountant/transactions" element={<ProtectedRoute><AccountantTransactions /> </ProtectedRoute>} />
        <Route path="/staff/orders/:id" element={<ProtectedRoute><OrderDetail /> </ProtectedRoute>} />
        <Route path="/accountant/reports" element={<ProtectedRoute><AccountantReports /> </ProtectedRoute>} />
<Route path="/master-admin/attandance" element={<ProtectedRoute><MasterAdminAttendance /> </ProtectedRoute>} />
<Route path="/master-admin/attendance/:day" element={<ProtectedRoute><MasterAdminAttendanceDay /> </ProtectedRoute>} />
        <Route path="/security/dashboard" element={<ProtectedRoute><SecurityDashboard /> </ProtectedRoute>} />
        <Route path="/security/attendance/:day" element={<ProtectedRoute><SecurityAttendanceDay /> </ProtectedRoute>} />
        <Route path="/driver/profile" element={<ProtectedRoute><DriverProfile /> </ProtectedRoute>} />
        <Route path="/admin/stock" element={<ProtectedRoute><AdminStock /> </ProtectedRoute>} />
        <Route path="/admin/orders" element={<ProtectedRoute><AdminOrdersMovement /></ProtectedRoute>} />
        <Route path="/admin/orders/deleted" element={<ProtectedRoute><AdminDeletedOrders /></ProtectedRoute>} />
        <Route path="/admin/orders/movement/:id" element={<ProtectedRoute><AdminOrdersMovementDetails /></ProtectedRoute>} />
        <Route path="/admin/orders/:id/edit-items" element={<ProtectedRoute><AdminEditOrderItems /> </ProtectedRoute>} />
        <Route path="/admin/vehicles" element={<ProtectedRoute><AdminVehicles /> </ProtectedRoute>} />
        <Route path="/admin/vehicles/add" element={<ProtectedRoute><AdminAddVehicles /> </ProtectedRoute>} />
        <Route path="/admin/customers/add-limits" element={<ProtectedRoute><AdminCustomerLimits /> </ProtectedRoute>} />
        <Route path="/admin/attandance" element={<ProtectedRoute><AdminAttendance /> </ProtectedRoute>} />
        <Route path="/admin/attendance/:day" element={<ProtectedRoute><AdminAttendanceDay /> </ProtectedRoute>} />
  {/* <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} /> Chat route removed, floating chat is always available */}
          <Route path="*" element={<NotFound />} />

      </Routes>
    </>
  );
}
