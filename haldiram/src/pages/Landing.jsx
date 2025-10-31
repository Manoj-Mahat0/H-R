// src/pages/Landing.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Logo from "../assets/logo.png";

export default function Landing() {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      case "security":
        return "/security/dashboard";
      default:
        return "/dashboard";
    }
  };

  // if user is already logged in, send them to their role-specific dashboard
  useEffect(() => {
    if (user) {
      const dest = roleRoute(user.role);
      navigate(dest);
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please fill all fields.");
      return;
    }

    setLoading(true);
    try {
      const me = await login(trimmedEmail, password); // login returns current user
      const dest = roleRoute(me?.role);
      navigate(dest);
    } catch (error) {
      console.error("login err", error);
      // safer extraction of possible error message
      const message =
        (error && (error.body?.detail || error.message || error.detail)) ||
        "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white dark:bg-gray-900">
      {/* Left Column - Logo and Branding (Now White) */}
      <div className="md:w-1/2 flex flex-col items-center justify-center p-8 md:p-16 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
        <div className="max-w-md w-full text-center">
          <div className="relative mb-8">
            <img 
              src={Logo} 
              alt="Sri Gopal Traders Logo" 
              className="mx-auto h-40 w-auto mb-8 transition-transform duration-300 hover:scale-105"
              style={{ 
                transform: 'translateY(0px)',
                transition: 'transform 0.3s ease-out'
              }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const moveX = (x - centerX) / 10;
                const moveY = (y - centerY) / 10;
                e.currentTarget.style.transform = `translate(${moveX}px, ${moveY}px) scale(1.05)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translate(0px, 0px) scale(1)';
              }}
            />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">Sri Gopal Traders</h1>
          <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-300 mb-6">Authorized Haldiram Distributor</p>
        </div>
      </div>

      {/* Right Column - Login Form (Now Blue) */}
      <div className="md:w-1/2 flex items-center justify-center p-8 md:p-16 bg-gradient-to-br from-blue-600 to-indigo-700">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-white mb-2">
              Welcome back 👋
            </h2>
            <p className="text-blue-100">
              Sign in to continue to your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="text-sm text-red-700 bg-red-50 dark:bg-red-900/30 dark:text-red-300 p-3 rounded-md border border-red-200 dark:border-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-blue-100 mb-2">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-blue-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-blue-100 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-blue-300 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-blue-300 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-blue-100">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-200 hover:text-blue-100">
                  Forgot password?
                </a>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-white text-blue-600 font-semibold shadow hover:bg-blue-50 transition disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Sign in"}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-blue-100">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="font-medium text-white hover:text-blue-200"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
