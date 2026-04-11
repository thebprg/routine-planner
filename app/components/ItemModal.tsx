"use client";

import React, { useState } from "react";
import { X, Pencil, Trash2, Check, ArrowUp, Loader2, RefreshCw } from "lucide-react";
import dayjs from "dayjs";
import { client } from "@/app/utils/amplifyClient";

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

type EditScope = "this" | "future" | "all";
type DeleteScope = "this" | "all";

const btnBase = "flex-1 py-2 px-3 text-[12px] font-medium rounded-xl transition-all";

export default function ItemModal({ item, onClose }: { item: any; onClose: () => void }) {
  // ── View state ─────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editScope, setEditScope] = useState<EditScope | null>(null);
  const [showScopeDialog, setShowScopeDialog] = useState<"edit" | "delete" | null>(null);

  // ── Edit fields ────────────────────────────────────────────────────────────
  const [editTitle, setEditTitle] = useState(item.title ?? "");
  const [editStart, setEditStart] = useState(
    item.start ? dayjs(item.start).format("YYYY-MM-DDTHH:mm") : ""
  );
  const [editEnd, setEditEnd] = useState(
    item.end ? dayjs(item.end).format("YYYY-MM-DDTHH:mm") : ""
  );
  const [editNotes, setEditNotes] = useState(item.notes ?? "");
  const [editColor, setEditColor] = useState(item.color ?? "#2563EB");
  const [editRecurrenceEndDate, setEditRecurrenceEndDate] = useState(
    item.raw?.recurrenceEndDate ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── AI ─────────────────────────────────────────────────────────────────────
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiHistory, setAiHistory] = useState<{ role: string; content: string }[]>([]);

  const modelType: string = item.modelType ?? "CalendarItem";
  const isRecurring = item.isRecurring ?? false;
  const occurrenceDate: string = item._occurrenceDate ?? dayjs(item.start).format("YYYY-MM-DD");
  const parentId: string = item.raw?.id ?? item.id;
  const dotColor = item.color ?? "#2563EB";

  // ── Edit flow ──────────────────────────────────────────────────────────────
  // Step 1: User clicks edit pencil
  const startEdit = () => {
    if (isRecurring && modelType === "CalendarItem") {
      setShowScopeDialog("edit"); // Show scope picker first
    } else {
      setEditing(true); // Non-recurring: open form directly
    }
  };

  // Step 2: User picks scope in dialog → open form
  const pickEditScope = (scope: EditScope) => {
    setEditScope(scope);
    setShowScopeDialog(null);
    setEditing(true); // Now show the edit form
  };

  // Step 3: User clicks save in form → commit
  const commitEdit = async () => {
    setSaving(true);
    setEditing(false);
    const scope = editScope ?? "all";
    try {
      const startD = dayjs(editStart);
      const endD = editEnd ? dayjs(editEnd) : null;

      if (scope === "this" && modelType === "CalendarItem") {
        await client.models.EventOverride.create({
          parentId,
          occurrenceDate,
          title: editTitle !== item.title ? editTitle : undefined,
          startTime: editStart ? startD.format("HH:mm:ss") : undefined,
          endTime: editEnd ? endD!.format("HH:mm:ss") : undefined,
          color: editColor !== item.color ? editColor : undefined,
          notes: editNotes !== item.notes ? editNotes : undefined,
          isDeleted: false,
        });
      } else if (scope === "future" && modelType === "CalendarItem") {
        const dayBefore = dayjs(occurrenceDate).subtract(1, "day").format("YYYY-MM-DD");
        await client.models.CalendarItem.update({ id: parentId, recurrenceEndDate: dayBefore });
        await client.models.CalendarItem.create({
          userId: item.raw?.userId ?? "",
          title: editTitle,
          isAllDay: item.isAllDay ?? false,
          startDate: occurrenceDate,
          startTime: editStart ? startD.format("HH:mm:ss") : null,
          endTime: editEnd ? endD!.format("HH:mm:ss") : null,
          recurrence: item.recurrence ?? "NONE",
          recurrenceEndDate: editRecurrenceEndDate || null,
          color: editColor,
          notes: editNotes || null,
          source: item.source ?? "user",
          deletedOccurrences: [],
        });
      } else {
        // "all" — or non-recurring
        if (modelType === "CalendarItem") {
          await client.models.CalendarItem.update({
            id: parentId,
            title: editTitle,
            startDate: startD.format("YYYY-MM-DD"),
            startTime: editStart ? startD.format("HH:mm:ss") : null,
            endTime: editEnd ? endD!.format("HH:mm:ss") : null,
            color: editColor,
            notes: editNotes || null,
            recurrenceEndDate: editRecurrenceEndDate || null,
          });
        } else {
          await client.models.TodoItem.update({
            id: parentId,
            title: editTitle,
            deadline: startD.toISOString(),
            notes: editNotes || null,
          });
        }
      }
    } catch (e) {
      console.error("Edit error:", e);
    } finally {
      setSaving(false);
      setEditScope(null);
    }
  };

  // ── Delete flow ────────────────────────────────────────────────────────────
  const startDelete = () => {
    if (isRecurring && modelType === "CalendarItem") {
      setShowScopeDialog("delete");
    } else {
      setShowScopeDialog("delete"); // Even for non-recurring, confirm
    }
  };

  const handleDelete = async (scope: DeleteScope) => {
    setDeleting(true);
    try {
      if (scope === "this" && modelType === "CalendarItem" && isRecurring) {
        const existing = (item.raw?.deletedOccurrences as string[] | null) ?? [];
        await client.models.CalendarItem.update({
          id: parentId,
          deletedOccurrences: [...existing, occurrenceDate],
        });
      } else {
        if (modelType === "CalendarItem") {
          await client.models.CalendarItem.delete({ id: parentId });
        } else {
          await client.models.TodoItem.delete({ id: parentId });
        }
      }
      onClose();
    } catch (e) {
      console.error("Delete error:", e);
    } finally {
      setDeleting(false);
    }
  };

  // ── AI ─────────────────────────────────────────────────────────────────────
  const sendAiMessage = async () => {
    if (!aiMessage.trim()) return;
    const userMsg = aiMessage;
    setAiHistory((p) => [...p, { role: "user", content: userMsg }]);
    setAiMessage("");
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: aiHistory, currentItemContext: item }),
      });
      const data = await res.json();
      if ((data.action === "edit" || data.action === "add") && data.data) {
        if (modelType === "CalendarItem") await client.models.CalendarItem.update({ id: parentId, ...data.data });
        else await client.models.TodoItem.update({ id: parentId, ...data.data });
      } else if (data.action === "delete") {
        setShowScopeDialog("delete");
      }
      setAiHistory((p) => [...p, { role: "assistant", content: data.message || "Done!" }]);
    } catch {
      setAiHistory((p) => [...p, { role: "assistant", content: "Error" }]);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="absolute inset-0 z-50 flex justify-end overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <div
        className="relative w-[340px] h-full bg-[#141414] border-l border-[#272727] shadow-2xl flex flex-col z-10"
        style={{ animation: "slideInRight 0.2s ease-out" }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-4 border-b border-[#272727] flex-shrink-0">
          <div className="flex-1 pr-2 min-w-0">
            {editing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full bg-[#1F1F1F] border border-[#333] rounded-lg px-2 py-1 text-[15px] font-bold text-white focus:outline-none focus:border-[#3B5BDB]"
                autoFocus
              />
            ) : (
              <h3 className="text-[16px] font-bold text-white leading-tight">{item.title}</h3>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor }} />
              <span className="text-[10px] text-gray-500">
                {item.isAllDay ? "All-day" : modelType === "TodoItem" ? "Todo" : "Event"}
              </span>
              {isRecurring && (
                <span className="text-[10px] text-gray-600 flex items-center gap-1">
                  <RefreshCw size={9} /> Repeating
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {editing ? (
              <>
                <button
                  onClick={commitEdit}
                  disabled={saving}
                  className="p-1.5 rounded-lg bg-[#3B5BDB] text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditScope(null); }}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-[#2A2A2A] transition-colors"
                >
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <button onClick={startEdit} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors" title="Edit">
                  <Pencil size={13} />
                </button>
                <button onClick={startDelete} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors" title="Delete">
                  <Trash2 size={13} />
                </button>
                <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2A2A2A] transition-colors">
                  <X size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">

          {/* Edit scope picker */}
          {showScopeDialog === "edit" && (
            <div className="rounded-2xl border border-[#272727] bg-[#1A1A1A] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#272727]">
                <p className="text-[12px] font-semibold text-white">Edit recurring event</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Which occurrences should be changed?</p>
              </div>
              <div className="divide-y divide-[#222]">
                {(["this", "future", "all"] as EditScope[]).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => pickEditScope(scope)}
                    className="w-full text-left px-4 py-3 text-[13px] text-gray-200 hover:bg-[#222] transition-colors"
                  >
                    {scope === "this"
                      ? "This occurrence only"
                      : scope === "future"
                      ? "This and all future"
                      : "All occurrences"}
                  </button>
                ))}
                <button
                  onClick={() => setShowScopeDialog(null)}
                  className="w-full text-left px-4 py-3 text-[12px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete scope picker */}
          {showScopeDialog === "delete" && (
            <div className="rounded-2xl border border-red-900/50 bg-[#1a0a0a] overflow-hidden">
              <div className="px-4 py-3 border-b border-red-900/30">
                <p className="text-[12px] font-semibold text-red-400">
                  Delete{isRecurring ? " recurring event" : ""}?
                </p>
                <p className="text-[10px] text-gray-600 mt-0.5 truncate">"{item.title}"</p>
              </div>
              <div className="p-3 space-y-2">
                {isRecurring && (
                  <button
                    onClick={() => handleDelete("this")}
                    disabled={deleting}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#272727] hover:bg-[#333] text-[13px] text-gray-200 text-left transition-colors disabled:opacity-50"
                  >
                    Remove this date only
                  </button>
                )}
                <button
                  onClick={() => handleDelete("all")}
                  disabled={deleting}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-900/60 hover:bg-red-800 text-[13px] text-red-300 text-left border border-red-800/40 transition-colors disabled:opacity-50"
                >
                  {deleting
                    ? "Deleting…"
                    : isRecurring
                    ? "Delete all occurrences"
                    : "Yes, delete this item"}
                </button>
                <button
                  onClick={() => setShowScopeDialog(null)}
                  className="w-full py-2 text-[12px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Timing — stacked vertically */}
          {!item.isAllDay && (
            <div className="space-y-3">
              <div>
                <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">
                  Start
                </div>
                {editing ? (
                  <input
                    type="datetime-local"
                    value={editStart}
                    onChange={(e) => setEditStart(e.target.value)}
                    className="w-full bg-[#1F1F1F] border border-[#333] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#3B5BDB] [color-scheme:dark]"
                  />
                ) : (
                  <div className="text-[13px] text-white">
                    {item.start ? dayjs(item.start).format("MMM D, YYYY · h:mm A") : "—"}
                  </div>
                )}
              </div>
              {modelType === "CalendarItem" && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">
                    End
                  </div>
                  {editing ? (
                    <input
                      type="datetime-local"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="w-full bg-[#1F1F1F] border border-[#333] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none focus:border-[#3B5BDB] [color-scheme:dark]"
                    />
                  ) : (
                    <div className="text-[13px] text-white">
                      {item.end ? dayjs(item.end).format("MMM D, YYYY · h:mm A") : "—"}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {item.isAllDay && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">Date</div>
              <div className="text-[13px] text-white">
                {item.start ? dayjs(item.start).format("MMM D, YYYY") : "—"}
              </div>
            </div>
          )}

          {/* Recurrence end date — editing only */}
          {editing && isRecurring && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">Repeats Until</div>
              <input
                type="date"
                value={editRecurrenceEndDate}
                onChange={(e) => setEditRecurrenceEndDate(e.target.value)}
                className="w-full bg-[#1F1F1F] border border-[#333] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none [color-scheme:dark]"
              />
            </div>
          )}

          {/* Color picker — editing only */}
          {editing && (
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-2">Color</div>
              <div className="flex gap-2">
                {COLOR_SWATCHES.map((sw) => (
                  <button
                    key={sw.hex}
                    onClick={() => setEditColor(sw.hex)}
                    title={sw.label}
                    className="w-6 h-6 rounded-full border-2 transition-all"
                    style={{
                      backgroundColor: sw.hex,
                      borderColor: editColor === sw.hex ? "white" : "transparent",
                      transform: editColor === sw.hex ? "scale(1.25)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-1.5">Notes</div>
            {editing ? (
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full bg-[#1F1F1F] border border-[#333] rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none resize-none [color-scheme:dark]"
              />
            ) : (
              <div className="text-[13px] text-gray-300 leading-relaxed">
                {item.notes || <span className="text-gray-600 italic">No notes</span>}
              </div>
            )}
          </div>
        </div>

        {/* ── AI Edit Footer ──────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-t border-[#1F1F1F] bg-[#111]">
          <div className="px-3 pt-2 pb-1 text-[9px] text-gray-700 uppercase font-semibold tracking-widest">
            Edit with AI
          </div>
          {aiHistory.length > 0 && (
            <div className="px-3 pb-2 space-y-1.5 max-h-[80px] overflow-y-auto custom-scrollbar">
              {aiHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`px-2.5 py-1 rounded-xl text-[11px] max-w-[90%] leading-snug ${
                      msg.role === "user" ? "bg-[#2A2A2A] text-white" : "bg-[#1e2d5e] text-[#93C5FD]"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && <Loader2 className="animate-spin h-3 w-3 text-gray-500" />}
            </div>
          )}
          <div className="p-2.5 flex items-center gap-2">
            <input
              value={aiMessage}
              onChange={(e) => setAiMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendAiMessage()}
              placeholder="change time to 3pm…"
              className="flex-1 bg-[#1A1A1A] border border-[#252525] rounded-full px-3 py-1.5 text-[12px] text-white placeholder-gray-700 focus:outline-none focus:border-[#3B5BDB]/50"
            />
            <button
              onClick={sendAiMessage}
              disabled={aiLoading || !aiMessage.trim()}
              className="w-7 h-7 flex items-center justify-center bg-[#3B5BDB] hover:bg-blue-500 rounded-full text-white disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <ArrowUp size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
