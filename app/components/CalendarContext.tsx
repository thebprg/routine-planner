"use client";

import React, { createContext, useContext, useState } from "react";
import { View } from "react-big-calendar";
import dayjs from "dayjs";

interface CalendarContextType {
  date: Date;
  setDate: (date: Date) => void;
  view: View;
  setView: (view: View) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<View>("month");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <CalendarContext.Provider
      value={{ date, setDate, view, setView, isSidebarOpen, setIsSidebarOpen }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendarContext() {
  const context = useContext(CalendarContext);
  if (!context) throw new Error("useCalendarContext must be used within CalendarProvider");
  return context;
}
