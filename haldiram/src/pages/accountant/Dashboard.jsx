import React from "react";
import AccountantSidebar from "../../components/AccountantSidebar";

export default function AccountantDashboard() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AccountantSidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-6 text-blue-700">Accountant Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold text-blue-600 mb-2">₹1,20,000</div>
            <div className="text-gray-500">Total Revenue</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold text-green-600 mb-2">₹80,000</div>
            <div className="text-gray-500">Total Expenses</div>
          </div>
          <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center">
            <div className="text-2xl font-bold text-purple-600 mb-2">₹40,000</div>
            <div className="text-gray-500">Net Profit</div>
          </div>
        </div>
        <div className="mt-10 bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-700">Recent Transactions</h2>
          <table className="w-full text-left">
            <thead>
              <tr className="text-gray-500 text-sm">
                <th className="py-2">Date</th>
                <th className="py-2">Description</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Type</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-2">2025-09-20</td>
                <td className="py-2">Vendor Payment</td>
                <td className="py-2 text-red-600">-₹10,000</td>
                <td className="py-2">Expense</td>
              </tr>
              <tr>
                <td className="py-2">2025-09-19</td>
                <td className="py-2">Product Sale</td>
                <td className="py-2 text-green-600">+₹25,000</td>
                <td className="py-2">Revenue</td>
              </tr>
              <tr>
                <td className="py-2">2025-09-18</td>
                <td className="py-2">Office Supplies</td>
                <td className="py-2 text-red-600">-₹2,000</td>
                <td className="py-2">Expense</td>
              </tr>
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
