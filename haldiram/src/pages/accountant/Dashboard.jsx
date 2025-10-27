// src/pages/accountant/AccountantDashboard.jsx
import React, { useEffect } from "react";
import AccountantSidebar from "../../components/AccountantSidebar";

export default function AccountantDashboard() {
  // initialize theme from localStorage (expects Tailwind `darkMode: "class"`)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark") document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
    } catch (e) {
      // ignore
    }
  }, []);

  function toggleTheme() {
    try {
      const next = !document.documentElement.classList.contains("dark");
      if (next) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("theme", "dark");
      } else {
        document.documentElement.classList.remove("dark");
        localStorage.setItem("theme", "light");
      }
    } catch (e) {}
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <AccountantSidebar />
      <main className="flex-1 p-8">
        <div className="flex items-start justify-between mb-6 gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-blue-700 dark:text-blue-300">Accountant Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">Overview of revenue, expenses and recent transactions.</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="px-3 py-2 rounded-md border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-gray-200 shadow-sm hover:shadow"
            >
              Toggle theme
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 flex flex-col items-center transition-colors">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-300 mb-2">₹1,20,000</div>
            <div className="text-gray-500 dark:text-gray-300">Total Revenue</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 flex flex-col items-center transition-colors">
            <div className="text-2xl font-bold text-green-600 dark:text-green-300 mb-2">₹80,000</div>
            <div className="text-gray-500 dark:text-gray-300">Total Expenses</div>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow p-6 flex flex-col items-center transition-colors">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-300 mb-2">₹40,000</div>
            <div className="text-gray-500 dark:text-gray-300">Net Profit</div>
          </div>
        </div>

        <div className="mt-10 bg-white dark:bg-slate-800 rounded-xl shadow p-6 transition-colors">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-100">Recent Transactions</h2>
            <div className="text-sm text-gray-500 dark:text-gray-300">Last 7 days</div>
          </div>

          <div className="overflow-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-gray-500 dark:text-gray-300 text-sm">
                  <th className="py-2">Date</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Type</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100 dark:border-slate-700">
                  <td className="py-2 text-gray-700 dark:text-gray-200">2025-09-20</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Vendor Payment</td>
                  <td className="py-2 text-red-600">-₹10,000</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Expense</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-slate-700">
                  <td className="py-2 text-gray-700 dark:text-gray-200">2025-09-19</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Product Sale</td>
                  <td className="py-2 text-green-600">+₹25,000</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Revenue</td>
                </tr>
                <tr className="border-t border-gray-100 dark:border-slate-700">
                  <td className="py-2 text-gray-700 dark:text-gray-200">2025-09-18</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Office Supplies</td>
                  <td className="py-2 text-red-600">-₹2,000</td>
                  <td className="py-2 text-gray-700 dark:text-gray-200">Expense</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
