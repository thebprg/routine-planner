"use client";

import React, { useState, useEffect, useRef } from "react";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { client } from "@/app/utils/amplifyClient";
import { getCurrentUser } from "aws-amplify/auth";
import dayjs from "dayjs";

function sanitizeCalendarItem(data: any) {
  return {
    title: data.title ?? "",
    isAllDay: data.isAllDay ?? false,
    startDate: data.startDate ?? dayjs().format("YYYY-MM-DD"),
    startTime: data.startTime ?? null,
    endTime: data.endTime ?? null,
    recurrence: data.recurrence ?? "NONE",
    recurrenceEndDate: data.recurrenceEndDate ?? null,
    color: data.color ?? "#0A84FF",
    notes: data.notes ?? null,
    source: "user",
    deletedOccurrences: [],
  };
}

function sanitizeTodoItem(data: any) {
  return {
    title: data.title ?? "",
    deadline: data.deadline ?? null,
    hasTime: data.hasTime ?? false,
    isRecurring: data.isRecurring ?? false,
    recurrence: data.recurrence ?? "NONE",
    recurrenceEndDate: data.recurrenceEndDate ?? null,
    notes: data.notes ?? null,
    isDone: false,
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
    // TodoItems have isDone field, CalendarItems have startDate
    return item.isDone !== undefined ? "TodoItem" : "CalendarItem";
  };

  const sendMessage = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setChatHistory((p) => [...p, { role: "user", content: userMsg }]);
    setMessage("");
    setLoading(true);

    try {
      // Build compact item context for the AI (title + id + key date)
      const itemContext = [
        ...calItemsRef.current.map((i) => ({
          id: i.id,
          title: i.title,
          type: "CalendarItem",
          startDate: i.startDate,
          recurrence: i.recurrence ?? "NONE",
        })),
        ...todoItemsRef.current
          .filter((i) => !i.isDone)
          .map((i) => ({
            id: i.id,
            title: i.title,
            type: "TodoItem",
            deadline: i.deadline,
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

      const { userId } = await getCurrentUser();

      if (data.action === "add" && data.data) {
        if (data.itemType === "CalendarItem") {
          await client.models.CalendarItem.create({ ...sanitizeCalendarItem(data.data), userId });
        } else {
          await client.models.TodoItem.create({ ...sanitizeTodoItem(data.data), userId });
        }
      } else if (data.action === "edit" && data.data) {
        // Resolve target — AI can return targetId or targetTitle
        const target = data.targetId
          ? findItemById(data.targetId)
          : findItemByTitle(data.targetTitle ?? data.data?.title);

        if (target) {
          const type = data.itemType ?? getItemType(target);
          if (type === "CalendarItem") {
            await client.models.CalendarItem.update({ id: target.id, ...sanitizeCalendarItem({ ...target, ...data.data }) });
          } else {
            await client.models.TodoItem.update({ id: target.id, ...sanitizeTodoItem({ ...target, ...data.data }) });
          }
        } else {
          setChatHistory((p) => [...p, { role: "assistant", content: "I couldn't find that item. Can you be more specific?" }]);
          setLoading(false);
          return;
        }
      } else if (data.action === "delete") {
        const target = data.targetId
          ? findItemById(data.targetId)
          : findItemByTitle(data.targetTitle);

        if (target) {
          const type = data.itemType ?? getItemType(target);
          if (type === "CalendarItem") {
            await client.models.CalendarItem.delete({ id: target.id });
          } else {
            await client.models.TodoItem.delete({ id: target.id });
          }
        } else {
          setChatHistory((p) => [...p, { role: "assistant", content: "I couldn't find that item to delete." }]);
          setLoading(false);
          return;
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
          placeholder="Add meeting, edit yoga to 7am, delete standup…"
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
