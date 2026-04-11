"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import TodoSidebar from "@/app/components/TodoSidebar";
import Topbar from "@/app/components/Topbar";
import { CalendarProvider, useCalendarContext } from "@/app/components/CalendarContext";

const MIN_SIDEBAR = 240;
const MAX_SIDEBAR = 540;
const DEFAULT_SIDEBAR = 320;

function MainLayoutInner({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, setIsSidebarOpen } = useCalendarContext();
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_SIDEBAR);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0F0F0F] text-white overflow-hidden">
      {/* Top Bar */}
      <Topbar />

      <div className="flex flex-1 w-full overflow-hidden relative">
        {/* Desktop Sidebar */}
        <aside
          className="hidden md:flex flex-col border-r border-[#272727] bg-[#141414] shrink-0 h-full relative z-10"
          style={{ width: sidebarWidth }}
        >
          <TodoSidebar />
          {/* Resize handle */}
          <div
            onMouseDown={onMouseDown}
            className="absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-20 group"
          >
            <div className="w-[1px] h-full bg-[#272727] group-hover:bg-[#3B5BDB]/50 transition-colors ml-[2px]" />
          </div>
        </aside>

        {/* Calendar Content */}
        <main className="flex-1 min-w-0 h-full relative z-0 overflow-hidden">
          {children}
        </main>

        {/* Mobile Bottom Sheet Sidebar */}
        <div
          className={`md:hidden fixed inset-x-0 bottom-0 z-50 bg-[#141414] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ height: "72vh" }}
        >
          <div
            className="flex justify-center pt-3 pb-2 border-b border-[#272727]/50 cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          >
            <div className="w-10 h-1 bg-gray-700 rounded-full" />
          </div>
          <div className="h-full overflow-hidden flex flex-col pb-10">
            <TodoSidebar />
          </div>
        </div>

        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Mobile FAB */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`md:hidden fixed bottom-6 right-6 w-14 h-14 bg-[#3B5BDB] rounded-full shadow-[0_4px_24px_rgba(59,91,219,0.5)] flex items-center justify-center text-white z-30 transition-opacity ${
            isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="6" height="6" rx="1"/>
            <path d="m3 17 2 2 4-4"/>
            <path d="M13 6h8"/>
            <path d="M13 12h8"/>
            <path d="M13 18h8"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <CalendarProvider>
      <MainLayoutInner>{children}</MainLayoutInner>
    </CalendarProvider>
  );
}
