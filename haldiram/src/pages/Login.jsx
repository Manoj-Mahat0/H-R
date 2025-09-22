// src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import ModalInactiveUser from "../components/ModalInactiveUser";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import fingerprint from "../assets/Fingerprint-cuate.png";

export default function Login() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [inactiveModal, setInactiveModal] = useState(false);

  // map roles to their dashboard routes
  const roleRoute = (role) => {
    switch (role) {
      case "master_admin":
        return "/dashboard";
      case "admin":
        return "/admin/dashboard";
      case "accountant":
        return "/accountant/dashboard";
      case "vendor":
        return "/vendor/dashboard";
      case "staff":
        return "/staff/dashboard";
      case "driver":
        return "/driver/dashboard";
      default:
        return "/dashboard";
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErr("Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      const me = await login(trimmedEmail, password); // login returns current user
      if (me && me.active === false) {
        setInactiveModal(true);
        return;
      }
      const dest = roleRoute(me?.role);
      navigate(dest);
    } catch (error) {
      console.error("login err", error);
      // safer extraction of possible error message
      const message =
        (error && (error.body?.detail || error.message || error.detail)) ||
        "Login failed";
      setErr(message);
    } finally {
      setLoading(false);
    }
  }

  // if user is already logged in, send them to their role-specific dashboard
  useEffect(() => {
    if (user) {
      if (user.active === false) {
        setInactiveModal(true);
        return;
      }
      const dest = roleRoute(user.role);
      navigate(dest);
    }
  }, [user, navigate]);

  return (
    <>
      <div className="min-h-[80vh] flex items-center justify-center py-12 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
            {/* Left: Form */}
            <div className="w-full max-w-md mx-auto">
              <div className="bg-white rounded-2xl p-8 shadow-lg">
                <h2 className="text-3xl font-bold text-gray-800">
                  Welcome back 👋
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Sign in to continue to{" "}
                  <span className="font-medium">Sri Gopal Traders</span>
                </p>

                <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                  {err && (
                    <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">
                      {err}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email
                    </label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold shadow hover:from-blue-700 hover:to-indigo-700 transition disabled:opacity-60"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </button>
                </form>

                <div className="mt-5 text-sm text-gray-600 text-center">
                  Don’t have an account?{" "}
                  <Link
                    to="/signup"
                    className="text-blue-600 font-medium hover:underline"
                  >
                    Create an account
                  </Link>
                </div>
              </div>
            </div>

            {/* Right: Illustration */}
            <div className="hidden md:flex items-center justify-center">
                <img
              src={fingerprint}
                  alt="Login Illustration"
                  className="max-w-xs w-full object-contain drop-shadow-xl"
                  style={{ minHeight: 320 }}
                />
            </div>
          </div>
        </div>
      </div>

      {inactiveModal && (
        <ModalInactiveUser onClose={() => setInactiveModal(false)} />
      )}
    </>
  );
}
