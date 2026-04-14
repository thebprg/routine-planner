"use client";

import React, { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { client } from "@/app/utils/amplifyClient";
import { buildCalendarItemInput, buildTodoDeadline, buildTodoItemInput, CALENDAR_STEP_MINUTES } from "@/app/utils/scheduling";
import dayjs from "dayjs";

// ─── Color palette ─────────────────────────────────────────────────────────────
const COLOR_SWATCHES = [
  { label: "Blue",   hex: "#2563EB" },
  { label: "Purple", hex: "#7C3AED" },
  { label: "Green",  hex: "#059669" },
  { label: "Red",    hex: "#DC2626" },
  { label: "Orange", hex: "#D97706" },
  { label: "Yellow", hex: "#CA8A04" },
  { label: "Pink",   hex: "#DB2777" },
  { label: "Teal",   hex: "#0D9488" },
];

const RECURRENCES = ["NONE", "DAILY", "WEEKDAYS", "WEEKENDS", "WEEKLY", "MONTHLY"] as const;
type Recurrence = typeof RECURRENCES[number];

export default function CreateModal({ onClose }: { onClose: () => void }) {
  const [itemType, setItemType] = useState<"event" | "todo">("event");
  const [title, setTitle] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);
  // Events default to today; todos have no default date (optional)
  const [date, setDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [recurrence, setRecurrence] = useState<Recurrence>("NONE");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [color, setColor] = useState("#2563EB");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState(0); // 0-3 stars
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isRecurring = recurrence !== "NONE";

  // When switching type, reset date default
  const handleTypeChange = (t: "event" | "todo") => {
    setItemType(t);
    if (t === "event" && !date) setDate(dayjs().format("YYYY-MM-DD"));
    if (t === "todo") {
      setDate("");
      setStartTime("");
      setEndTime("");
      setIsAllDay(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Events require a date; todos can have no date
    if (itemType === "event" && !date) { setError("Please set a date for the event."); return; }
    if (itemType === "todo" && startTime && !date) { setError("Add a date before setting a task time."); return; }
    if (itemType === "event" && !isAllDay) {
      const startAt = dayjs(`${date}T${startTime}`);
      const endAt = dayjs(`${date}T${endTime}`);
      if (!startAt.isValid() || !endAt.isValid() || !endAt.isAfter(startAt)) {
        setError("Event end time must be after the start time.");
        return;
      }
    }
    setError("");
    setSaving(true);

    try {
      const { getCurrentUser } = await import("aws-amplify/auth");
      const { userId } = await getCurrentUser();

      if (itemType === "event") {
        const payload = buildCalendarItemInput({
          userId,
          title,
          isAllDay,
          startDate: date,
          startTime: !isAllDay && startTime ? `${startTime}:00` : null,
          endTime: !isAllDay && endTime ? `${endTime}:00` : null,
          recurrence: recurrence as any,
          recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
          color,
          notes: notes || null,
          priority,
          source: "user",
          deletedOccurrences: [],
        });
        await client.models.CalendarItem.create(payload);
      } else {
        // date is optional for todos
        const { deadline, hasTime } = buildTodoDeadline(date, startTime);

        const payload = buildTodoItemInput({
          userId,
          title,
          deadline,
          hasTime,
          isRecurring: isRecurring,
          recurrence: recurrence as any,
          recurrenceEndDate: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
          notes: notes || null,
          priority,
          isDone: false,
        });
        await client.models.TodoItem.create(payload);
      }
      onClose();
    } catch (err) {
      console.error("Failed to create item:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full bg-[#0F0F0F] border border-[#272727] rounded-lg px-3 py-2 text-[13px] text-white focus:border-[#3B5BDB] focus:outline-none transition-colors [color-scheme:dark]";
  const labelCls = "block text-[10px] text-gray-500 uppercase font-semibold mb-1 tracking-wide";
  const selectCls =
    "w-full bg-[#0F0F0F] border border-[#272727] rounded-lg px-3 py-2 text-[13px] text-white focus:border-[#3B5BDB] focus:outline-none appearance-none cursor-pointer";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#161616] w-full max-w-md rounded-2xl border border-[#272727] shadow-[0_24px_64px_rgba(0,0,0,0.8)] overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#272727] flex-shrink-0">
          <h2 className="text-[15px] font-bold text-white">New Item</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto custom-scrollbar">

          {/* Type Toggle */}
          <div className="flex gap-2 p-1 bg-[#0F0F0F] rounded-xl border border-[#272727]">
            {(["event", "todo"] as const).map((t) => (
              <button key={t} type="button" onClick={() => handleTypeChange(t)}
                className={`flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-colors capitalize ${itemType === t ? "bg-[#272727] text-white" : "text-gray-500 hover:text-gray-300"}`}>
                {t === "event" ? "Event" : "Task"}
              </button>
            ))}
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === "event" ? "e.g. Team standup, Morning yoga…" : "e.g. Call dentist, Review report…"}
              className={inputCls} />
          </div>

          {/* Event-specific: All-day toggle + color */}
          {itemType === "event" && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#3B5BDB]" />
                <span className="text-[12px] text-gray-300">All-day event</span>
              </label>
              {/* Color swatches inline */}
              <div className="flex gap-1.5">
                {COLOR_SWATCHES.map((sw) => (
                  <button key={sw.hex} type="button" onClick={() => setColor(sw.hex)} title={sw.label}
                    className="w-5 h-5 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: sw.hex,
                      borderColor: color === sw.hex ? "white" : "transparent",
                      transform: color === sw.hex ? "scale(1.25)" : "scale(1)",
                    }} />
                ))}
              </div>
            </div>
          )}

          {/* Recurrence */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>
                {itemType === "todo" ? "Date / Deadline (optional)" : "Date"}
              </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setDate(nextDate);
                    if (!nextDate && itemType === "todo") {
                      setStartTime("");
                    }
                  }}
                  required={itemType === "event"}
                  className={inputCls}
                />
            </div>
            <div>
              <label className={labelCls}>Repeats</label>
              <div className="relative">
                <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} className={selectCls}>
                  <option value="NONE">Never</option>
                  <option value="DAILY">Daily</option>
                  <option value="WEEKDAYS">Weekdays</option>
                  <option value="WEEKENDS">Weekends</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Time fields — stacked vertically, hidden if all-day */}
          {!isAllDay && (
            <div className="space-y-3">
              <div>
                <label className={labelCls}>{itemType === "event" ? "Start Time" : "Time (optional)"}</label>
                <input
                  type="time"
                  step={CALENDAR_STEP_MINUTES * 60}
                  required={itemType === "event"}
                  disabled={itemType === "todo" && !date}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className={`${inputCls} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              {itemType === "event" && (
                <div>
                  <label className={labelCls}>End Time</label>
                  <input
                    type="time"
                    step={CALENDAR_STEP_MINUTES * 60}
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={inputCls}
                  />
                </div>
              )}
            </div>
          )}

          {/* Recurrence end date — shown when recurrence is set */}
          {isRecurring && (
            <div>
              <label className={labelCls}>Repeats Until (optional)</label>
              <input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className={inputCls} />
            </div>
          )}

          {/* Priority stars */}
          <div>
            <label className={labelCls}>Priority</label>
            <div className="flex gap-1.5 mt-0.5 items-center">
              {[1, 2, 3].map((star) => {
                const filled = priority >= star;
                const isHighest = star === 3 && filled;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setPriority(priority === star ? 0 : star)}
                    className="text-[20px] transition-all hover:scale-110 leading-none"
                    style={{ color: filled ? (isHighest ? "#EF4444" : "#F59E0B") : "#4B5563" }}
                    title={["Low", "Medium", "High"][star - 1]}
                  >
                    {filled ? "★" : "☆"}
                  </button>
                );
              })}
              {priority > 0 && (
                <span className="text-[11px] text-gray-500 ml-1">
                  {["Low", "Medium", "High"][priority - 1]}
                </span>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes (optional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Any additional details…"
              className={`${inputCls} resize-none`} />
          </div>

          {error && <p className="text-[12px] text-red-400">{error}</p>}

          <button type="submit" disabled={saving}
            className="w-full bg-[#3B5BDB] hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors text-[13px] mt-1">
            {saving ? "Saving…" : `Create ${itemType === "event" ? "Event" : "Task"}`}
          </button>
        </form>
      </div>
    </div>
  );
}
