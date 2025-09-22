import React, { useState } from "react";
import { FiMessageCircle } from "react-icons/fi";
import ChatFloating from "./Chat";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg p-4 flex items-center justify-center focus:outline-none"
        style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.18)" }}
        aria-label="Open Chat"
      >
        <FiMessageCircle size={28} />
      </button>

      {/* Floating Chat Panel */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end"
          style={{ pointerEvents: 'auto' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-[480px] max-w-[96vw] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col m-6"
            style={{ minHeight: 400, maxHeight: 600 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Use ChatFloating with onClose prop */}
            <ChatFloating onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
