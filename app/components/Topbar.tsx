"use client";

import React, { useState, useEffect, useRef } from "react";
import { Menu, ChevronLeft, ChevronRight, Plus, CalendarDays, Settings, LogOut, User as UserIcon } from "lucide-react";
import dayjs from "dayjs";
import { useCalendarContext } from "@/app/components/CalendarContext";
import { View } from "react-big-calendar";
import CreateModal from "./CreateModal";
import CalendarsPanel from "./CalendarsPanel";
import { client } from "@/app/utils/amplifyClient";
import { signOut, getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";

export default function Topbar() {
  const { date, setDate, view, setView, isSidebarOpen, setIsSidebarOpen } = useCalendarContext();
  const [showCreate, setShowCreate] = useState(false);
  const [showCalendars, setShowCalendars] = useState(false);
  const [calendarSources, setCalendarSources] = useState<any[]>([]);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("U");
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let sub: any;
    const init = async () => {
      await new Promise((r) => setTimeout(r, 300));
      if (!active) return;
      try {
        sub = client.models.CalendarSource.observeQuery().subscribe({
          next: ({ items }) => { if (active) setCalendarSources(items as any[]); },
          error: (err) => console.warn("[CalendarSource Topbar]", err),
        });
      } catch { /* model not deployed yet */ }
    };
    init();
    const fetchUser = async () => {
      try {
        const attrs = await fetchUserAttributes();
        if (attrs.email) setUserEmail(attrs.email);
      } catch (e) {}
    };
    fetchUser();
    
    // Close profile menu on outside click
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);

    return () => { 
      active = false; 
      sub?.unsubscribe(); 
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const goToToday = () => setDate(new Date());

  const handlePrev = () => {
    const d = dayjs(date);
    if (view === "month") setDate(d.subtract(1, "month").toDate());
    else if (view === "week") setDate(d.subtract(7, "day").toDate());
    else if (view === "day") setDate(d.subtract(1, "day").toDate());
    else setDate(d.subtract(1, "month").toDate());
  };

  const handleNext = () => {
    const d = dayjs(date);
    if (view === "month") setDate(d.add(1, "month").toDate());
    else if (view === "week") setDate(d.add(7, "day").toDate());
    else if (view === "day") setDate(d.add(1, "day").toDate());
    else setDate(d.add(1, "month").toDate());
  };

  // Header label
  const headerLabel = () => {
    const d = dayjs(date);
    if (view === "day") return d.format("MMM D, YYYY");
    if (view === "week") {
      const start = d.subtract(1, "day");
      const end = d.add(5, "day");
      return `${start.format("MMM D")} – ${end.format(start.month() === end.month() ? "D, YYYY" : "MMM D, YYYY")}`;
    }
    return d.format("MMMM YYYY");
  };

  const views: { label: string; value: View }[] = [
    { label: "Month", value: "month" },
    { label: "Week",  value: "week" },
    { label: "Day",   value: "day" },
    { label: "Agenda", value: "agenda" },
  ];

  return (
    <>
      <header className="h-[52px] bg-[#1C1C1E] border-b border-[#38383A] flex items-center justify-between px-4 shrink-0 w-full z-20">
        {/* Left: Brand */}
        <div className="flex items-center gap-3 min-w-[160px]">
          <button
            className="md:hidden p-1.5 hover:bg-[#2C2C2E] rounded-lg transition-colors"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu size={18} className="text-[#8E8E93]" />
          </button>
          <span className="text-[17px] font-semibold text-white select-none hidden sm:block tracking-tight">
            Planner
          </span>
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center gap-1">
          <button onClick={handlePrev} className="p-1.5 hover:bg-[#2C2C2E] rounded-lg transition-colors text-[#8E8E93] hover:text-white">
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[13px] sm:text-[14px] font-semibold text-white min-w-[110px] sm:min-w-[140px] text-center select-none">
            {headerLabel()}
          </h2>
          <button onClick={handleNext} className="p-1.5 hover:bg-[#2C2C2E] rounded-lg transition-colors text-[#8E8E93] hover:text-white">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={goToToday}
            className="px-2.5 py-1 ml-1 text-[11px] font-medium text-[#8E8E93] hover:text-white hover:bg-[#2C2C2E] rounded-lg transition-colors border border-[#38383A]"
          >
            Today
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 min-w-[160px] justify-end">
          <button
            onClick={() => setShowCalendars(true)}
            className="p-1.5 hover:bg-[#2C2C2E] rounded-lg transition-colors text-[#8E8E93] hover:text-white"
            title="Calendars"
          >
            <CalendarDays size={16} />
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 bg-[#0A84FF] hover:bg-[#409CFF] text-white px-3 py-1.5 rounded-[10px] text-[12px] font-semibold transition-colors"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">New</span>
          </button>

          {/* View switcher */}
          <div className="hidden lg:flex items-center bg-[#2C2C2E] p-0.5 rounded-[10px]">
            {views.map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors ${
                  view === v.value
                    ? "bg-[#48484A] text-white"
                    : "text-[#8E8E93] hover:text-white"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Profile Dropdown */}
          <div className="relative ml-2" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#3B5BDB] to-[#60A5FA] flex items-center justify-center text-white text-[13px] font-medium shadow-md transition-transform hover:scale-105"
            >
              {userEmail.charAt(0).toUpperCase()}
            </button>
            
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-[#1C1C1E] border border-[#38383A] rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-[#38383A]">
                  <p className="text-[13px] text-white font-medium truncate">{userEmail}</p>
                </div>
                <div className="p-1">
                  <button className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#8E8E93] hover:text-white hover:bg-[#2C2C2E] rounded-lg transition-colors">
                    <UserIcon size={14} /> Profile Settings
                  </button>
                  <button 
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-[#2C2C2E] rounded-lg transition-colors"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {showCalendars && (
        <CalendarsPanel
          onClose={() => setShowCalendars(false)}
          sources={calendarSources}
          allEvents={[]}
        />
      )}
    </>
  );
}
