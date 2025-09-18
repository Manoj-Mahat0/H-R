import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";

export default function Header() {
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto flex items-center justify-between gap-4 py-3 px-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png" // apna logo public/logo.png me daal dena
            alt="Logo"
            className="h-9 w-9 object-contain"
          />
          <span className="text-lg md:text-xl font-extrabold text-gray-800">
            Sri Gopal Traders
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-4">
          <Link
            to="/"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              loc.pathname === "/"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            }`}
          >
            Home
          </Link>

          <Link
            to="/products"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              loc.pathname === "/products"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            }`}
          >
            Products
          </Link>

          <Link
            to="/about"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              loc.pathname === "/about"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            }`}
          >
            About
          </Link>

          <Link
            to="/login"
            className={`px-3 py-2 rounded-md text-sm font-medium ${
              loc.pathname === "/login"
                ? "text-blue-600 bg-blue-50"
                : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
            }`}
          >
            Login
          </Link>

          <Link
            to="/signup"
            className="px-4 py-2 rounded-full text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            Sign up
          </Link>
        </nav>

        {/* Mobile: hamburger */}
        <div className="md:hidden flex items-center">
          <button
            aria-label="Toggle menu"
            onClick={() => setOpen((s) => !s)}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100"
          >
            {open ? (
              // X icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              // Menu icon
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="container mx-auto px-4 pb-4">
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm font-medium rounded-md ${
                loc.pathname === "/"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              Home
            </Link>

            <Link
              to="/products"
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm font-medium rounded-md ${
                loc.pathname === "/products"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              Products
            </Link>

            <Link
              to="/about"
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm font-medium rounded-md ${
                loc.pathname === "/about"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              About
            </Link>

            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 text-sm font-medium rounded-md ${
                loc.pathname === "/login"
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-700 hover:text-blue-600 hover:bg-gray-50"
              }`}
            >
              Login
            </Link>

            <Link
              to="/signup"
              onClick={() => setOpen(false)}
              className="block px-4 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md mt-2"
            >
              Sign up
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
