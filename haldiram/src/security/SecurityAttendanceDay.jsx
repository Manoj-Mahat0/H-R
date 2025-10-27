// src/pages/security/SecurityAttendanceDay.jsx
import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
    ArrowLeft, Clock, User, LogIn, LogOut, Loader2, AlertTriangle, ListChecks, ChevronRight 
} from "lucide-react"; 
import { authFetch } from "../lib/auth";

// Helper function to format seconds into HH:MM:SS
const formatDuration = (seconds) => {
  if (typeof seconds !== 'number' || seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  const parts = [h, m, s].map(v => String(v).padStart(2, '0'));
  return `${parts[0]}:${parts[1]}:${parts[2]}`;
};

// Helper function to format timestamp to local string
const fmtLocal = (ts) => {
  if (!ts) return "N/A";
  try {
    return new Date(ts).toLocaleString(undefined, { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
  } catch {
    return ts;
  }
};

export default function SecurityAttendanceDay() {
  const { day } = useParams(); // YYYY-MM-DD
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  // NEW STATE: Tracks the currently selected user for the details panel
  const [selectedUserId, setSelectedUserId] = useState(null); 

  useEffect(() => {
    if (!day) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    setData(null);

    authFetch(`/attendance/admin/by-date?day=${day}`, { method: "GET" })
      .then((j) => {
        if (!mounted) return;
        setData(j);
        
        // NEW LOGIC: Automatically select the first user on load
        if (j.users && j.users.length > 0) {
            setSelectedUserId(j.users[0].user_id);
        } else {
            setSelectedUserId(null);
        }
      })
      .catch((e) => {
        console.error("fetchAttendanceByDate", e?.body ?? e?.message ?? e);
        if (mounted) {
          const msg = e?.body?.detail || e?.message || "Failed to load attendance details";
          setError(msg);
          setSelectedUserId(null);
        }
      })
      .finally(() => mounted && setLoading(false));

    return () => (mounted = false);
  }, [day]);
  
  // Find the selected user's data object
  const selectedUser = data?.users?.find(u => u.user_id === selectedUserId);
  
  // Format the day string for the header
  const readableDay = day 
    ? new Date(day).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : day;

  // --- RENDERING HELPERS ---
  
  // Helper Component for the User List Item (Master column)
  const UserListItem = ({ user, isSelected, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full text-left p-4 rounded-xl border-l-4 transition-all duration-150 ease-in-out 
            ${isSelected 
                ? 'bg-indigo-50 border-indigo-600 shadow-md ring-1 ring-indigo-200'
                : 'bg-white border-slate-200 hover:bg-slate-50'
            }`}
    >
        <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <User className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`} />
                <div>
                    <div className="text-lg font-semibold text-slate-800">{user.user_name}</div>
                    <div className="text-sm text-slate-500">Total: {formatDuration(user.total_seconds)}</div>
                </div>
            </div>
            <ChevronRight className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
        </div>
    </button>
  );

  // Helper Component for the Details Panel (Detail column)
  const UserDetailsPanel = ({ user }) => (
    <div className="space-y-6">
        {/* Total Duration Card */}
        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 shadow-sm flex items-center justify-between">
            <div className="text-lg font-medium text-indigo-800">Total Recorded Duration</div>
            <div className="flex items-center gap-2 font-extrabold text-3xl text-indigo-700">
               <Clock className="w-6 h-6" />
               {formatDuration(user.total_seconds)}
            </div>
        </div>
        
        {/* Intervals Section */}
        <div>
            <div className="text-md font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-slate-600" />
              Intervals ({user.intervals?.length || 0})
            </div>
            
            {Array.isArray(user.intervals) && user.intervals.length > 0 ? (
              <div className="space-y-3">
                {user.intervals.map((iv, idx) => (
                  <div key={iv.in_id ?? idx} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-lg border border-slate-200 bg-white shadow-sm">
                      
                      {/* Time In */}
                      <div className="flex items-center gap-3">
                          <LogIn className="w-5 h-5 text-green-600 shrink-0" />
                          <div>
                              <div className="text-xs font-medium text-slate-500">Time In (IST)</div>
                              <div className="text-sm font-semibold text-slate-800">{fmtLocal(iv.in_ts_ist)}</div>
                          </div>
                      </div>

                      {/* Time Out */}
                      <div className="flex items-center gap-3">
                          <LogOut className="w-5 h-5 text-red-600 shrink-0" />
                          <div>
                              <div className="text-xs font-medium text-slate-500">Time Out (IST)</div>
                              <div className="text-sm font-semibold text-slate-800">{fmtLocal(iv.out_ts_ist)}</div>
                          </div>
                      </div>
                      
                      {/* Duration */}
                      <div className="flex items-center justify-start md:justify-end border-t md:border-t-0 pt-2 md:pt-0 mt-2 md:mt-0 border-slate-100">
                          <div className="text-left md:text-right">
                              <div className="text-xs font-medium text-slate-500">Duration</div>
                              <div className="font-extrabold text-base text-indigo-600">
                                  {formatDuration(iv.duration_seconds)}
                              </div>
                          </div>
                      </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-slate-500 p-3 bg-slate-100 rounded">No specific time intervals recorded.</div>
            )}
        </div>
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-slate-50">
      <div className="max-w-6xl mx-auto">
        
        {/* Header and Back Button */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <ListChecks className="w-8 h-8 text-indigo-600" />
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900">
                Attendance Details
              </h1>
              <p className="text-xl font-medium text-indigo-600 mt-1">
                {readableDay}
              </p>
            </div>
          </div>
          
          <div>
            <button 
              onClick={() => navigate("/security/dashboard")} 
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-700 font-semibold rounded-lg shadow-md border border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Calendar
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
            <div className="py-12 text-center text-indigo-500 flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p>Loading attendance records for {day}...</p>
            </div>
        ) : error ? (
            <div className="py-8 text-center text-red-600 flex flex-col items-center bg-red-50 rounded-lg p-4">
                <AlertTriangle className="w-8 h-8 mb-3" />
                <p className="font-semibold">Error: {String(error)}</p>
                <p className="text-sm text-red-500 mt-1">Failed to fetch data for this date.</p>
            </div>
        ) : !data || (Array.isArray(data.users) && data.users.length === 0) ? (
            <div className="py-8 text-center text-slate-600 flex flex-col items-center bg-white p-6 rounded-xl shadow-lg">
                <ListChecks className="w-8 h-8 mb-3 text-slate-400" />
                <p className="font-medium">No attendance records found for {day}.</p>
            </div>
        ) : (
            // MASTER-DETAIL LAYOUT
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Master Column (User List) */}
                <div className="lg:col-span-1 space-y-3 p-4 bg-white rounded-xl shadow-lg border border-slate-100 lg:sticky lg:top-8 lg:h-fit">
                    <h2 className="text-xl font-bold text-slate-800 border-b pb-2 mb-3">
                        Users ({data.users.length})
                    </h2>
                    {data.users.map((user) => (
                        <UserListItem 
                            key={user.user_id}
                            user={user}
                            isSelected={user.user_id === selectedUserId}
                            onClick={() => setSelectedUserId(user.user_id)}
                        />
                    ))}
                </div>

                {/* 2. Detail Column (Selected User's Intervals) */}
                <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg border border-slate-100">
                    {selectedUser ? (
                        <UserDetailsPanel user={selectedUser} />
                    ) : (
                        <div className="py-8 text-center text-slate-500">
                            Select a user from the left to view their attendance intervals.
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}