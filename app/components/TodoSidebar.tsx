"use client";

import React, { useState, useEffect } from "react";
import AIChatBar from "@/app/components/AIChatBar";
import ItemModal from "@/app/components/ItemModal";
import { client } from "@/app/utils/amplifyClient";
import dayjs from "dayjs";
import { RefreshCw, ChevronDown, Check } from "lucide-react";

type TodoStatus = "past-due" | "today" | "upcoming" | "no-deadline";

interface TodoEntry {
  id: string;
  title: string;
  status: TodoStatus;
  dateStr: string;
  isRecurring: boolean;
  recurrence?: string | null;
  isDone?: boolean | null;
  raw: any;
}

const STATUS_ORDER: Record<TodoStatus, number> = {
  "past-due": 1, today: 2, upcoming: 3, "no-deadline": 4,
};

const BORDER: Record<TodoStatus, string> = {
  "past-due": "border-l-[#FF453A]",
  today: "border-l-[#FFD60A]",
  upcoming: "border-l-[#30D158]",
  "no-deadline": "border-l-[#48484A]",
};

const LABEL_COLOR: Record<TodoStatus, string> = {
  "past-due": "text-[#FF453A]",
  today: "text-[#FFD60A]",
  upcoming: "text-[#30D158]",
  "no-deadline": "text-[#636366]",
};

const FILTER_OPTIONS = [
  { key: "All",          label: "All Tasks" },
  { key: "past-due",     label: "Overdue" },
  { key: "today",        label: "Today" },
  { key: "upcoming",     label: "Upcoming" },
  { key: "no-deadline",  label: "No Date" },
];

export default function TodoSidebar() {
  const [filter, setFilter] = useState("All");
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<TodoEntry[]>([]);
  const [selectedTodo, setSelectedTodo] = useState<any>(null);

  useEffect(() => {
    let active = true;
    let sub: any;

    const init = async () => {
      await new Promise((r) => setTimeout(r, 300));
      if (!active) return;
      sub = client.models.TodoItem.observeQuery().subscribe({
        next: ({ items: raw }) => {
          if (!active) return;
          const mapped: TodoEntry[] = raw.map((i) => {
            let status: TodoStatus = "no-deadline";
            let dateStr = "No deadline";
            if (i.deadline) {
              const dt = dayjs(i.deadline as string);
              if (dt.isBefore(dayjs(), "day")) status = "past-due";
              else if (dt.isSame(dayjs(), "day")) status = "today";
              else status = "upcoming";
              dateStr = (i.hasTime) ? dt.format("MMM D · h:mm A") : dt.format("MMM D, YYYY");
            }
            return {
              id: i.id,
              title: i.title,
              status,
              dateStr,
              isRecurring: !!(i.isRecurring),
              recurrence: i.recurrence,
              isDone: i.isDone,
              raw: i,
            };
          });
          const visible = mapped.filter((i) => !i.isDone);
          visible.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
          if (active) setItems(visible);
        },
        error: (e) => console.warn("[TodoSidebar]", e),
      });
    };

    init();
    return () => { active = false; sub?.unsubscribe(); };
  }, []);

  const handleCheck = async (item: TodoEntry) => {
    if (item.isRecurring && item.recurrence && item.recurrence !== "NONE") {
      let next = dayjs(item.raw.deadline);
      switch (item.recurrence) {
        case "DAILY":    next = next.add(1, "day"); break;
        case "WEEKLY":   next = next.add(1, "week"); break;
        case "MONTHLY":  next = next.add(1, "month"); break;
        case "WEEKDAYS": { next = next.add(1, "day"); while (next.day() === 0 || next.day() === 6) next = next.add(1, "day"); break; }
        case "WEEKENDS": { next = next.add(1, "day"); while (next.day() !== 0 && next.day() !== 6) next = next.add(1, "day"); break; }
      }
      await client.models.TodoItem.update({ id: item.id, deadline: next.toISOString() });
    } else {
      await client.models.TodoItem.update({ id: item.id, isDone: true });
    }
  };

  const filtered = filter === "All" ? items : items.filter((i) => i.status === filter);
  const currentLabel = FILTER_OPTIONS.find((f) => f.key === filter)?.label ?? "All Tasks";

  return (
    <div className="flex flex-col h-full bg-[#1C1C1E] text-white w-full overflow-hidden">

      {/* ── Header with dropdown filter ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[#2C2C2E] flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-white tracking-tight">Reminders</h2>

          {/* Dropdown filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((p) => !p)}
              className="flex items-center gap-1.5 px-3 py-1 bg-[#2C2C2E] rounded-full text-[11px] text-[#8E8E93] hover:text-white transition-colors"
            >
              <span>{currentLabel}</span>
              <ChevronDown size={11} className={`transition-transform ${filterOpen ? "rotate-180" : ""}`} />
            </button>

            {filterOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 z-40 bg-[#2C2C2E] border border-[#48484A] rounded-2xl shadow-2xl overflow-hidden min-w-[140px]">
                  {FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setFilter(opt.key); setFilterOpen(false); }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] text-left hover:bg-[#38383A] transition-colors"
                    >
                      <span className={filter === opt.key ? "text-[#0A84FF]" : "text-white"}>{opt.label}</span>
                      {filter === opt.key && <Check size={12} className="text-[#0A84FF]" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Count badge */}
        <p className="text-[10px] text-[#636366] mt-0.5">
          {filtered.length} {filtered.length === 1 ? "item" : "items"}
        </p>
      </div>

      {/* ── List ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="w-10 h-10 rounded-full bg-[#2C2C2E] flex items-center justify-center">
              <Check size={18} className="text-[#30D158]" />
            </div>
            <p className="text-[11px] text-[#636366]">All clear!</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedTodo({
                ...item.raw,
                title: item.title,
                start: item.raw.deadline ? new Date(item.raw.deadline as string) : undefined,
                isRecurring: item.isRecurring,
                modelType: "TodoItem",
                raw: item.raw,
              })}
              className={`bg-[#2C2C2E] hover:bg-[#38383A] rounded-xl py-2.5 px-3 border-l-[3px] flex items-center gap-3 cursor-pointer transition-colors ${BORDER[item.status]}`}
            >
              {/* Circle checkbox */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleCheck(item); }}
                className="w-5 h-5 rounded-full border-2 border-[#48484A] hover:border-[#8E8E93] flex-shrink-0 flex items-center justify-center transition-colors hover:bg-[#48484A]/30"
              />

              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-white truncate">{item.title}</div>
                <div className={`text-[10px] mt-0.5 truncate ${LABEL_COLOR[item.status]}`}>
                  {item.dateStr}
                </div>
              </div>

              {item.isRecurring && (
                <RefreshCw size={11} className="text-[#636366] flex-shrink-0" />
              )}
            </div>
          ))
        )}
      </div>

      {/* ── AI Chat Footer ── */}
      <div className="flex-shrink-0">
        <AIChatBar />
      </div>

      {selectedTodo && (
        <ItemModal item={selectedTodo} onClose={() => setSelectedTodo(null)} />
      )}
    </div>
  );
}
