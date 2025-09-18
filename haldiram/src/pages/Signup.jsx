import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

export default function Signup() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!name || !email || !password) {
      setErr("Please fill all fields.");
      return;
    }
    console.log("signup", { name, email, password });
    navigate("/login");
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-12">
      <div className="w-full max-w-md card">
        <h2 className="text-2xl font-semibold">Create your account</h2>
        <p className="text-sm text-gray-500 mt-1">Start building with MyApp.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {err && <div className="text-sm text-red-700 bg-red-50 p-2 rounded">{err}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="John Doe" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="you@example.com" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand" placeholder="Choose a password" />
          </div>

          <button type="submit" className="btn-primary w-full">Create account</button>
        </form>

        <p className="mt-4 text-sm text-gray-500">Already registered? <Link to="/login" className="text-brand font-medium">Sign in</Link></p>
      </div>
    </div>
  );
}
