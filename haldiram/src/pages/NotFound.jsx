import React from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6">
      <div className="bg-white shadow-md rounded-xl p-10 max-w-lg w-full text-center border border-gray-200">
        <FiAlertTriangle className="mx-auto h-16 w-16 text-yellow-500 mb-4" />
        <h1 className="text-4xl font-bold text-gray-900">404</h1>
        <h2 className="mt-2 text-xl font-semibold text-gray-800">
          Page not found
        </h2>
        <p className="mt-2 text-gray-600">
          Sorry, the page you’re looking for doesn’t exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Go back home
          </Link>
        </div>
      </div>
    </div>
  );
}
