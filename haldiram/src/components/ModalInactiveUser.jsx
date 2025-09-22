import React from "react";

export default function ModalInactiveUser({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl"
          onClick={onClose}
        >
          &times;
        </button>
        <div className="text-2xl mb-2 font-bold text-red-600">Account Inactive</div>
        <div className="mb-4 text-gray-700">
          Your account is not active.<br />
          Please contact the Admin to activate your account.
        </div>
        <button
          className="mt-2 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700"
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
