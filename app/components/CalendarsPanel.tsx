"use client";

import React, { useState } from "react";
import { X, Eye, EyeOff, Trash2, Download, RefreshCw, Link2, Plus } from "lucide-react";
import { client } from "@/app/utils/amplifyClient";
import { getCurrentUser } from "aws-amplify/auth";

const SOURCE_COLORS = [
  "#0A84FF", "#7C3AED", "#30D158", "#FF453A",
  "#FF9F0A", "#0D9488", "#DB2777", "#8E8E93",
];

interface Source {
  id: string;
  name: string;
  type: string;
  url?: string | null;
  countryCode?: string | null;
  color?: string | null;
  isVisible?: boolean | null;
}

interface Props {
  onClose: () => void;
  sources: Source[];
  allEvents?: any[];
}

export default function CalendarsPanel({ onClose, sources }: Props) {
  // Subscribe form state
  const [showForm, setShowForm] = useState(false);
  const [icsUrl, setIcsUrl] = useState("");
  const [icsName, setIcsName] = useState("");
  const [icsColor, setIcsColor] = useState("#0A84FF");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportOk, setExportOk] = useState(false);

  const subscribeICS = async () => {
    const url = icsUrl.trim();
    if (!url) return;
    setError("");
    setValidating(true);

    // Validate that we can actually fetch this ICS feed
    try {
      const res = await fetch("/api/ics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "Could not read that calendar URL. Make sure it's a public .ics link.");
        setValidating(false);
        return;
      }
    } catch {
      setError("Network error — could not reach that URL.");
      setValidating(false);
      return;
    }

    setValidating(false);
    setSaving(true);
    try {
      const { userId } = await getCurrentUser();
      await client.models.CalendarSource.create({
        userId,
        name: icsName.trim() || "External Calendar",
        type: "ics",
        url,
        color: icsColor,
        isVisible: true,
      });
      setIcsUrl("");
      setIcsName("");
      setShowForm(false);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (src: Source) => {
    await client.models.CalendarSource.update({ id: src.id, isVisible: !(src.isVisible ?? true) });
  };

  const removeSource = async (src: Source) => {
    await client.models.CalendarSource.delete({ id: src.id });
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportOk(false);
    try {
      // Fetch user's CalendarItems directly for export
      const { data: items } = await client.models.CalendarItem.list();
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events: items }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cal-export.ics";
      a.click();
      URL.revokeObjectURL(url);
      setExportOk(true);
      setTimeout(() => setExportOk(false), 2500);
    } catch {
      setError("Export failed.");
    } finally {
      setExportLoading(false);
    }
  };

  const isLoading = validating || saving;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#2C2C2E] w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden max-h-[82vh] flex flex-col border border-[#48484A]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#38383A] flex-shrink-0">
          <h2 className="text-[16px] font-semibold text-white">Calendars</h2>
          <button onClick={onClose} className="text-[#8E8E93] hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="px-4 py-4 space-y-1">

            {/* Built-in calendar row */}
            <div className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-[#3A3A3C]">
              <span className="w-3 h-3 rounded-full flex-shrink-0 bg-[#0A84FF]" />
              <span className="text-[14px] text-white flex-1">My Events</span>
              <Eye size={15} className="text-[#8E8E93]" />
            </div>

            {/* US Holidays (auto-subscribed) */}
            {sources
              .filter((s) => s.type === "holiday")
              .map((src) => (
                <div key={src.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#3A3A3C] transition-colors">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: src.color ?? "#8E8E93" }} />
                  <span className="text-[14px] text-white flex-1 truncate">{src.name}</span>
                  <button onClick={() => toggleVisibility(src)} className="text-[#8E8E93] hover:text-white transition-colors">
                    {src.isVisible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              ))}

            {/* ICS subscriptions */}
            {sources
              .filter((s) => s.type === "ics")
              .map((src) => (
                <div key={src.id} className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#3A3A3C] transition-colors group">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: src.color ?? "#0A84FF" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] text-white truncate">{src.name}</div>
                    <div className="text-[10px] text-[#636366] truncate">{src.url}</div>
                  </div>
                  <button onClick={() => toggleVisibility(src)} className="text-[#8E8E93] hover:text-white transition-colors">
                    {src.isVisible !== false ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => removeSource(src)} className="text-[#636366] hover:text-[#FF453A] transition-colors opacity-0 group-hover:opacity-100 ml-1">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
          </div>

          {/* ── Separator ── */}
          <div className="mx-4 border-t border-[#38383A]" />

          {/* ── Subscribe form ── */}
          <div className="px-4 py-4">
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                className="w-full flex items-center gap-2.5 py-2.5 px-3 rounded-xl border border-[#48484A] hover:bg-[#3A3A3C] text-[13px] text-[#0A84FF] transition-colors"
              >
                <Plus size={14} />
                Subscribe to Calendar (ICS URL)
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-[12px] text-[#8E8E93]">
                  Paste a public .ics link — Google Calendar, Outlook, class schedules, sport fixtures, etc.
                </p>

                {/* Name field */}
                <div>
                  <label className="block text-[10px] text-[#8E8E93] uppercase font-semibold mb-1 tracking-wide">
                    Name (optional)
                  </label>
                  <input
                    value={icsName}
                    onChange={(e) => setIcsName(e.target.value)}
                    placeholder="e.g. CS 101 Classes, Premier League…"
                    className="w-full bg-[#1C1C1E] border border-[#48484A] rounded-xl px-3 py-2 text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0A84FF]"
                  />
                </div>

                {/* URL field */}
                <div>
                  <label className="block text-[10px] text-[#8E8E93] uppercase font-semibold mb-1 tracking-wide">
                    Calendar URL *
                  </label>
                  <div className="relative">
                    <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636366]" />
                    <input
                      value={icsUrl}
                      onChange={(e) => { setIcsUrl(e.target.value); setError(""); }}
                      placeholder="https://example.com/calendar.ics"
                      className="w-full bg-[#1C1C1E] border border-[#48484A] rounded-xl pl-8 pr-3 py-2 text-[13px] text-white placeholder-[#636366] focus:outline-none focus:border-[#0A84FF]"
                    />
                  </div>
                </div>

                {/* Color picker */}
                <div>
                  <label className="block text-[10px] text-[#8E8E93] uppercase font-semibold mb-2 tracking-wide">Color</label>
                  <div className="flex gap-2">
                    {SOURCE_COLORS.map((hex) => (
                      <button
                        key={hex}
                        onClick={() => setIcsColor(hex)}
                        className="w-6 h-6 rounded-full border-2 transition-all"
                        style={{
                          backgroundColor: hex,
                          borderColor: icsColor === hex ? "white" : "transparent",
                          transform: icsColor === hex ? "scale(1.25)" : "scale(1)",
                        }}
                      />
                    ))}
                  </div>
                </div>

                {error && <p className="text-[12px] text-[#FF453A]">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => { setShowForm(false); setError(""); setIcsUrl(""); setIcsName(""); }}
                    className="flex-1 py-2 rounded-xl text-[13px] text-[#8E8E93] hover:text-white border border-[#48484A] hover:bg-[#3A3A3C] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={subscribeICS}
                    disabled={isLoading || !icsUrl.trim()}
                    className="flex-1 py-2 rounded-xl text-[13px] text-white bg-[#0A84FF] hover:bg-[#409CFF] disabled:opacity-50 transition-colors font-semibold"
                  >
                    {validating ? "Checking…" : saving ? "Saving…" : "Subscribe"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Export section ── */}
          <div className="px-4 pb-5">
            <div className="border-t border-[#38383A] pt-4">
              <p className="text-[11px] text-[#636366] mb-2">Export your events as a .ics file for use in other calendar apps.</p>
              <button
                onClick={handleExport}
                disabled={exportLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#48484A] hover:bg-[#3A3A3C] text-[13px] text-[#8E8E93] hover:text-white transition-colors disabled:opacity-50"
              >
                {exportLoading
                  ? <RefreshCw size={13} className="animate-spin" />
                  : exportOk
                  ? <span className="text-[#30D158] text-[12px]">✓ Downloaded!</span>
                  : <><Download size={13} /> Export my calendar (.ics)</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
