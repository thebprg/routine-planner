"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { client } from "@/app/utils/amplifyClient";
import { buildCalendarItemInput, buildTodoDeadline, buildTodoItemInput } from "@/app/utils/scheduling";
import { getCurrentUser } from "aws-amplify/auth";
import dayjs from "dayjs";

function sanitizeCalendarItem(data: any) {
  const isAllDay = data.isAllDay ?? false;
  return {
    title: data.title ?? "",
    isAllDay,
    startDate: data.startDate ?? dayjs().format("YYYY-MM-DD"),
    startTime: isAllDay ? undefined : data.startTime ?? undefined,
    endTime: isAllDay ? undefined : data.endTime ?? undefined,
    recurrence: data.recurrence ?? "NONE",
    recurrenceEndDate: data.recurrenceEndDate ?? undefined,
    color: data.color ?? "#0A84FF",
    notes: data.notes ?? undefined,
    priority: typeof data.priority === "number" ? data.priority : 0,
    source: data.source ?? "user",
    deletedOccurrences: data.deletedOccurrences ?? [],
  };
}

function sanitizeTodoItem(data: any) {
  const parsedDeadline = data.deadline ? dayjs(data.deadline) : null;
  const normalized =
    parsedDeadline?.isValid() && !data.hasTime
      ? buildTodoDeadline(parsedDeadline.format("YYYY-MM-DD"), null)
      : { deadline: data.deadline ?? null, hasTime: data.hasTime ?? false };

  return {
    title: data.title ?? "",
    deadline: normalized.deadline ?? undefined,
    hasTime: normalized.hasTime,
    isRecurring: data.isRecurring ?? false,
    recurrence: data.recurrence ?? "NONE",
    recurrenceEndDate: data.recurrenceEndDate ?? undefined,
    notes: data.notes ?? undefined,
    priority: typeof data.priority === "number" ? data.priority : 0,
    isDone: data.isDone ?? false,
  };
}

export default function AIChatBar() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: string; content: string }[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  // Keep refs to current items for edit/delete matching
  const calItemsRef = useRef<any[]>([]);
  const todoItemsRef = useRef<any[]>([]);

  // Load item summaries for AI context (auth-guarded)
  useEffect(() => {
    let active = true;
    const subs: { unsubscribe(): void }[] = [];

    const init = async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (!active) return;

      subs.push(
        client.models.CalendarItem.observeQuery().subscribe({
          next: ({ items }) => { if (active) calItemsRef.current = items as any[]; },
          error: (e) => console.warn("[AIChatBar CalendarItem]", e),
        })
      );
      subs.push(
        client.models.TodoItem.observeQuery().subscribe({
          next: ({ items }) => { if (active) todoItemsRef.current = items as any[]; },
          error: (e) => console.warn("[AIChatBar TodoItem]", e),
        })
      );
    };

    init();
    return () => { active = false; subs.forEach((s) => s?.unsubscribe()); };
  }, []);

  // Auto-scroll history
  useEffect(() => {
    if (historyRef.current) {
      historyRef.current.scrollTop = historyRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  const findItemById = (id: string) => {
    return (
      calItemsRef.current.find((i) => i.id === id) ||
      todoItemsRef.current.find((i) => i.id === id)
    );
  };

  const findItemByTitle = (title: string) => {
    if (!title) return null;
    const t = title.toLowerCase();
    return (
      calItemsRef.current.find((i) => i.title?.toLowerCase().includes(t)) ||
      todoItemsRef.current.find((i) => i.title?.toLowerCase().includes(t))
    );
  };

  const getItemType = (item: any): "CalendarItem" | "TodoItem" => {
    return item.isDone !== undefined ? "TodoItem" : "CalendarItem";
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setChatHistory((p) => [...p, { role: "user", content: userMsg }]);
    setMessage("");
    setLoading(true);

    try {
      // Build rich item context for the AI (title + id + time + recurrence + priority)
      const itemContext = [
        ...calItemsRef.current.map((i) => ({
          id: i.id,
          title: i.title,
          type: "CalendarItem",
          startDate: i.startDate,
          startTime: i.startTime ?? null,
          endTime: i.endTime ?? null,
          recurrence: i.recurrence ?? "NONE",
          isAllDay: i.isAllDay ?? false,
          priority: i.priority ?? 0,
        })),
        ...todoItemsRef.current
          .filter((i) => !i.isDone)
          .map((i) => ({
            id: i.id,
            title: i.title,
            type: "TodoItem",
            deadline: i.deadline,
            priority: i.priority ?? 0,
          })),
      ];

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, history: chatHistory, existingItems: itemContext }),
      });
      const data = await res.json();

      if (data.error) {
        setChatHistory((p) => [...p, { role: "assistant", content: `${data.error}` }]);
        return;
      }

      // Normalize operations array — handle old single-op format gracefully
      let ops: any[] = Array.isArray(data.operations) ? data.operations : [];
      if (ops.length === 0 && data.action) {
        ops = [data]; // fallback for old format
      }

      // Skip mutations if pure clarify response
      const hasMutations = ops.some((op: any) => op.action === "add" || op.action === "edit");

      if (hasMutations) {
        const { userId } = await getCurrentUser();

        for (const op of ops) {
          if (op.action === "add" && op.data) {
            if (op.itemType === "CalendarItem") {
              await client.models.CalendarItem.create(
                buildCalendarItemInput({ ...sanitizeCalendarItem(op.data), userId })
              );
            } else {
              await client.models.TodoItem.create(
                buildTodoItemInput({ ...sanitizeTodoItem(op.data), userId })
              );
            }
          } else if (op.action === "edit" && op.data) {
            if (op.targetDate) {
              const targets = calItemsRef.current.filter((i) => i.startDate === op.targetDate);
              for (const t of targets) {
                await client.models.CalendarItem.update(
                  buildCalendarItemInput({ id: t.id, ...sanitizeCalendarItem({ ...t, ...op.data }) })
                );
              }
            } else {
              const target = op.targetId
                ? findItemById(op.targetId)
                : findItemByTitle(op.targetTitle ?? op.data?.title);

              if (target) {
                const type = op.itemType ?? getItemType(target);
                if (type === "CalendarItem") {
                  await client.models.CalendarItem.update(
                    buildCalendarItemInput({ id: target.id, ...sanitizeCalendarItem({ ...target, ...op.data }) })
                  );
                } else {
                  await client.models.TodoItem.update(
                    buildTodoItemInput({ id: target.id, ...sanitizeTodoItem({ ...target, ...op.data }) })
                  );
                }
              }
            }
          }
          // clarify: no mutation needed, message already in data.message
        }
      }

      setChatHistory((p) => [...p, { role: "assistant", content: data.message || "Done!" }]);
    } catch (err) {
      console.error("AI chat error:", err);
      setChatHistory((p) => [...p, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-[#1C1C1E] border-t border-[#38383A] w-full">
      {/* History */}
      {chatHistory.length > 0 && (
        <div ref={historyRef} className="overflow-y-auto p-3 space-y-2 max-h-[150px] custom-scrollbar">
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`px-3 py-1.5 rounded-2xl max-w-[88%] text-[12px] leading-snug ${
                  msg.role === "user"
                    ? "bg-[#2C2C2E] text-white rounded-br-sm"
                    : "bg-[#1C274A] text-[#93C5FD] rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-2xl bg-[#1C274A] rounded-bl-sm">
                <Loader2 className="animate-spin h-3 w-3 text-[#93C5FD]" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input row */}
      <div className="p-2.5 flex items-center gap-2">
        <Sparkles size={13} className="text-[#0A84FF] flex-shrink-0 ml-0.5" />
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
          }}
          placeholder="Add meeting, edit yoga to 7am, what do I have tomorrow?"
          className="flex-1 bg-[#2C2C2E] border border-[#48484A] rounded-full px-3.5 py-1.5 text-[12px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0A84FF]/60 transition-colors"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !message.trim()}
          className="w-7 h-7 flex items-center justify-center bg-[#0A84FF] hover:bg-blue-400 rounded-full text-white disabled:opacity-40 transition-colors flex-shrink-0"
        >
          <ArrowUp size={13} />
        </button>
      </div>
    </div>
  );
}
