import React, { useEffect, useState, useRef } from "react";
import {
  FiUser,
  FiSend,
  FiPaperclip,
  FiArrowLeft,
  FiPhone,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { API_BASE, API_HOST } from "../lib/config";
import { useAuth } from "../context/AuthContext";

function showToast(msg) {
  if (window.Toast) window.Toast(msg);
  else alert(msg);
}

export default function ChatFloating({ onClose }) {
  const { token, user } = useAuth();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_HOST}${API_BASE}/chat/users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch user list");
        return r.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data.filter((u) => u.id !== user.id) : []))
      .catch((err) => showToast(err.message || "Could not load chat users"));
  }, [token, user]);

  useEffect(() => {
    if (!selectedUser) return;
    setLoading(true);
    fetchMessages();
    // eslint-disable-next-line
  }, [selectedUser]);

  async function fetchMessages() {
    if (!selectedUser) return;
    let chatId = null;
    try {
      const res = await fetch(
        `${API_HOST}${API_BASE}/chat/get_or_create_chat_id?other_user_id=${selectedUser.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Not allowed to chat with this user");
      const data = await res.json();
      chatId = data.chat_id;
    } catch (e) {
      setMessages([]);
      setLoading(false);
      showToast(e.message || "Could not load chat");
      return;
    }

    try {
      const r = await fetch(`${API_HOST}${API_BASE}/chat/messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        setMessages([]);
        setLoading(false);
        showToast("Failed to load messages");
        return;
      }
      const msgs = await r.json();
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (err) {
      showToast(err.message || "Could not load messages");
    } finally {
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 120);
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!message && !file) return;
    const form = new FormData();
    form.append("receiver_id", selectedUser.id);
    if (message) form.append("content", message);
    if (file) form.append("file", file);
    try {
      const res = await fetch(`${API_HOST}${API_BASE}/chat/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) throw new Error("Failed to send message");
    } catch (err) {
      showToast(err.message || "Could not send message");
    }
    setMessage("");
    setFile(null);
    fetchMessages();
  }

  function formatTime(ts) {
    try {
      // Parse as UTC and convert to local time
      const d = typeof ts === "string" ? new Date(ts + "Z") : new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function handleBackToList() {
    setSelectedUser(null);
    setMessages([]);
    setMessage("");
    setFile(null);
    if (searchRef.current) searchRef.current.focus();
    if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = 0;
  }

  return (
    // Overlay
    <div
      className="fixed inset-0 bg-black/20 dark:bg-black/40 z-50 flex items-end justify-end"
      onClick={onClose} // outside click → close
    >
      <div
        className="w-[510px] max-w-[96vw] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ height: "82vh", maxHeight: "82vh" }}
        onClick={(e) => e.stopPropagation()} // prevent close on widget click
      >
        {/* HEADER */}
        <div className="flex items-center justify-between px-4 py-3 bg-blue-600 dark:bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <FiUser />
            <span className="font-semibold">Chat Support</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-blue-700 dark:hover:bg-slate-700"
          >
            <FiX />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          {!selectedUser && (
            <div className="w-48 border-r border-gray-100 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-800">
              <div className="p-3">
                <div className="relative">
                  <input
                    ref={searchRef}
                    placeholder="Search..."
                    className="w-full rounded-full bg-gray-100 dark:bg-slate-700 px-3 py-2 text-xs outline-none text-slate-900 dark:text-slate-100"
                  />
                  <FiSearch className="absolute right-3 top-3 text-gray-400 text-xs" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {users.map((u) => (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm text-slate-700 dark:text-slate-200">
                      {u.name?.charAt(0) ?? "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate text-slate-900 dark:text-slate-100">{u.name}</div>
                      <div className="text-xs text-gray-400 dark:text-slate-400 truncate">Ok, let me check</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Chat Area */}
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-800">
            {/* Chat Header */}
            {selectedUser && (
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleBackToList}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700"
                  >
                    <FiArrowLeft />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-100">
                    {selectedUser.name?.charAt(0) ?? "U"}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{selectedUser.name}</div>
                    <div className="text-xs text-gray-400 dark:text-slate-400">Last seen recently</div>
                  </div>
                </div>
                <FiPhone className="text-slate-700 dark:text-slate-200" />
              </div>
            )}

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 min-h-0"
            >
              {!selectedUser ? (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-400">
                  Select a user from the left
                </div>
              ) : loading ? (
                <div className="text-sm text-gray-400 dark:text-slate-400">Loading…</div>
              ) : messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 dark:text-slate-400">
                  No messages yet — say hi 👋
                </div>
              ) : (
                <div className="space-y-3 pb-28">
                  {messages.map((m) => {
                    const mine = m.sender_id === user.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`px-3 py-2 rounded-2xl text-sm ${
                            mine
                              ? "bg-gradient-to-br from-purple-500 to-purple-400 text-white rounded-br-none"
                              : "bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-100 rounded-bl-none"
                          }`}
                          style={{ maxWidth: 320 }}
                        >
                          {/* Do NOT render remote images/videos inline to avoid CORS/taint — render safe links */}
                          {m.file_url && (
                            <div className="mb-1">
                              <a
                                href={`${API_HOST}${m.file_url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-gray-200 dark:border-slate-700 text-sm"
                              >
                                <FiPaperclip />
                                <span className="truncate">Open attachment</span>
                              </a>
                            </div>
                          )}

                          {/* Show text content if present */}
                          {m.content && <div className="text-slate-900 dark:text-slate-100">{m.content}</div>}
                          <div className="text-[10px] text-gray-400 dark:text-slate-400 mt-1">
                            {formatTime(m.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {selectedUser && (
              <form
                onSubmit={handleSend}
                className="px-4 py-3 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2"
              >
                <label className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  <FiPaperclip size={18} className="text-gray-600 dark:text-slate-200" />
                </label>
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write a message..."
                  className="flex-1 px-4 py-2 rounded-full bg-gray-100 dark:bg-slate-700 outline-none text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="submit"
                  className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow focus:outline-none focus:ring-2 focus:ring-purple-300"
                >
                  <FiSend />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
