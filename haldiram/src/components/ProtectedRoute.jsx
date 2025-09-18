// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, redirectTo = "/login" }) {
  const { user, loading } = useAuth();

  // while checking auth, you can show loader (or nothing)
  if (loading) return <div className="min-h-[60vh] flex items-center justify-center">Checking authentication...</div>;

  if (!user) {
    return <Navigate to={redirectTo} replace />;
  }
  return children;
}
