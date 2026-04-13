"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, dayjsLocalizer, View } from "react-big-calendar";
import dayjs from "dayjs";
import "react-big-calendar/lib/css/react-big-calendar.css";
// @ts-ignore
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import ItemModal from "@/app/components/ItemModal";
import { useCalendarContext } from "@/app/components/CalendarContext";
import { client } from "@/app/utils/amplifyClient";

const baseLocalizer = dayjsLocalizer(dayjs);
const DEFAULT_COLOR = "#0A84FF";
const DnDCalendar = withDragAndDrop(Calendar as any);

// ─── Event pill colors ────────────────────────────────────────────────────────
const COLOR_MAP: Record<string, { bg: string; border: string; text: string }> = {
  "#0A84FF": { bg: "bg-blue-900/60",    border: "border-l-blue-500",    text: "text-blue-200" },
  "#2563EB": { bg: "bg-blue-900/60",    border: "border-l-blue-500",    text: "text-blue-200" },
  "#7C3AED": { bg: "bg-violet-900/60",  border: "border-l-violet-500",  text: "text-violet-200" },
  "#059669": { bg: "bg-emerald-900/60", border: "border-l-emerald-500", text: "text-emerald-200" },
  "#DC2626": { bg: "bg-red-900/60",     border: "border-l-red-500",     text: "text-red-200" },
  "#D97706": { bg: "bg-amber-900/60",   border: "border-l-amber-500",   text: "text-amber-200" },
  "#CA8A04": { bg: "bg-yellow-900/60",  border: "border-l-yellow-500",  text: "text-yellow-200" },
  "#DB2777": { bg: "bg-pink-900/60",    border: "border-l-pink-500",    text: "text-pink-200" },
  "#0D9488": { bg: "bg-teal-900/60",    border: "border-l-teal-500",    text: "text-teal-200" },
  holiday:   { bg: "bg-[#2C2C2E]",      border: "border-l-[#48484A]",   text: "text-[#8E8E93]" },
  ics:       { bg: "bg-[#1C274A]",      border: "border-l-blue-400",    text: "text-blue-300" },
};

function getStyle(event: any) {
  if (event.source === "holiday") return COLOR_MAP.holiday;
  if (event.source === "ics")     return COLOR_MAP.ics;
  return COLOR_MAP[event.color ?? DEFAULT_COLOR] ?? COLOR_MAP[DEFAULT_COLOR];
}

const EventPill = ({ event }: { event: any }) => {
  const { bg, border, text } = getStyle(event);
  const priority = event.priority ?? 0;
  const starColor = priority === 3 ? "#EF4444" : "#F59E0B";
  return (
    <div className={`relative w-full h-full flex items-center px-1.5 py-0.5 border-l-[3px] rounded-r overflow-hidden ${bg} ${border}`}>
      <span className={`text-[11px] font-medium leading-tight truncate ${text}`}>{event.title}</span>
      {event.isRecurring && <span className="absolute top-0 right-0.5 text-[9px] opacity-40">↻</span>}
      {priority > 0 && (
        <span
          className="absolute bottom-0 right-0.5 text-[8px] leading-none"
          style={{ color: starColor, opacity: 0.85 }}
        >
          {"★".repeat(priority)}
        </span>
      )}
    </div>
  );
};

// ─── Recurrence expansion ─────────────────────────────────────────────────────
function advance(c: dayjs.Dayjs, rec: string): dayjs.Dayjs {
  switch (rec) {
    case "DAILY":    return c.add(1, "day");
    case "WEEKLY":   return c.add(1, "week");
    case "MONTHLY":  return c.add(1, "month");
    case "WEEKDAYS": { let n = c.add(1, "day"); while (n.day() === 0 || n.day() === 6) n = n.add(1, "day"); return n; }
    case "WEEKENDS": { let n = c.add(1, "day"); while (n.day() !== 0 && n.day() !== 6) n = n.add(1, "day"); return n; }
    default: return c.add(1, "day");
  }
}

function expandRecurring(item: any, rangeStart: Date, rangeEnd: Date, overridesMap: Map<string, Map<string, any>>): any[] {
  const deleted = new Set<string>((item.deletedOccurrences as string[] | null) ?? []);
  const { recurrence, recurrenceEndDate } = item;

  if (!recurrence || recurrence === "NONE") {
    const dk = dayjs(item.start).format("YYYY-MM-DD");
    return deleted.has(dk) ? [] : [item];
  }

  const recEnd = recurrenceEndDate
    ? dayjs(recurrenceEndDate).add(1, "day")
    : dayjs(rangeEnd).add(1, "day");

  const end = recEnd.isBefore(dayjs(rangeEnd).add(1, "day")) ? recEnd : dayjs(rangeEnd).add(1, "day");
  const durationMs = dayjs(item.end).diff(dayjs(item.start));
  const occurrences: any[] = [];

  let cursor = dayjs(item.start);
  if (cursor.isBefore(rangeStart)) {
    let sf = 0;
    while (cursor.isBefore(dayjs(rangeStart)) && sf < 2000) { cursor = advance(cursor, recurrence); sf++; }
  }

  let sf = 0;
  while (cursor.isBefore(end) && sf < 500) {
    const dk = cursor.format("YYYY-MM-DD");
    if (!deleted.has(dk)) {
      const ov = overridesMap.get(item.id)?.get(dk);
      occurrences.push(
        ov
          ? { ...item, title: ov.title ?? item.title, start: ov.startTime ? dayjs(`${dk}T${ov.startTime}`).toDate() : cursor.toDate(), end: ov.endTime ? dayjs(`${dk}T${ov.endTime}`).toDate() : cursor.add(durationMs, "ms").toDate(), color: ov.color ?? item.color, notes: ov.notes ?? item.notes, _occurrenceDate: dk }
          : { ...item, start: cursor.toDate(), end: cursor.add(durationMs, "ms").toDate(), _occurrenceDate: dk }
      );
    }
    cursor = advance(cursor, recurrence);
    sf++;
  }
  return occurrences;
}

// ─── CalendarView ─────────────────────────────────────────────────────────────
export default function CalendarView() {
  const { date, setDate, view, setView } = useCalendarContext();
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [sourceItems, setSourceItems] = useState<any[]>([]);
  const [overridesMap, setOverridesMap] = useState<Map<string, Map<string, any>>>(new Map());
  const [externalEvents, setExternalEvents] = useState<any[]>([]);

  // Force Week view to be a rolling 7-day period starting from the current `date` state
  const customLocalizer = React.useMemo(() => {
    const loc = dayjsLocalizer(dayjs);
    const origStart = loc.startOf;
    const origEnd = loc.endOf;
    
    loc.startOf = (d: any, unit: any, firstOfWeek?: any) => {
      // @ts-ignore
      if (view === "week" && unit === "week") return dayjs(d).subtract(1, "day").startOf("day").toDate();
      // @ts-ignore
      return origStart.call(loc, d, unit, firstOfWeek);
    };
    loc.endOf = (d: any, unit: any, firstOfWeek?: any) => {
      // @ts-ignore
      if (view === "week" && unit === "week") return dayjs(d).add(5, "day").endOf("day").toDate();
      // @ts-ignore
      return origEnd.call(loc, d, unit, firstOfWeek);
    };
    return loc;
  }, [view]);

  // Generous expansion range — 3 months back, 12 months forward
  const expandStart = dayjs(date).subtract(3, "month").toDate();
  const expandEnd   = dayjs(date).add(12, "month").toDate();

  // ── Auth-guarded subscriptions ─────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const subs: { unsubscribe(): void }[] = [];

    const init = async () => {
      await new Promise((r) => setTimeout(r, 250));
      if (!active) return;

      // CalendarItem subscription
      subs.push(
        client.models.CalendarItem.observeQuery().subscribe({
          next: ({ items }) => {
            if (!active) return;
            setSourceItems(items.map((i) => ({
              id: i.id,
              title: i.title,
              isAllDay: i.isAllDay ?? false,
              allDay: i.isAllDay ?? false,
              start: i.startTime ? dayjs(`${i.startDate}T${i.startTime}`).toDate() : dayjs(i.startDate as string).toDate(),
              end: i.endTime
                ? dayjs(`${i.startDate}T${i.endTime}`).toDate()
                : i.isAllDay
                ? dayjs(i.startDate as string).add(1, "day").toDate()
                : dayjs(i.startDate as string).add(1, "hour").toDate(),
              isRecurring: !!(i.recurrence && i.recurrence !== "NONE"),
              recurrence: i.recurrence ?? "NONE",
              recurrenceEndDate: i.recurrenceEndDate ?? null,
              color: i.color ?? DEFAULT_COLOR,
              notes: i.notes,
              priority: i.priority ?? 0,
              deletedOccurrences: (i.deletedOccurrences as string[] | null) ?? [],
              source: i.source ?? "user",
              raw: i,
              modelType: "CalendarItem",
            })));
          },
          error: (e) => console.warn("[CalendarItem]", e),
        })
      );

      // EventOverride subscription
      try {
        subs.push(
          client.models.EventOverride.observeQuery().subscribe({
            next: ({ items }) => {
              if (!active) return;
              const m = new Map<string, Map<string, any>>();
              for (const ov of items) {
                if (!m.has(ov.parentId)) m.set(ov.parentId, new Map());
                m.get(ov.parentId)!.set(ov.occurrenceDate as string, ov);
              }
              setOverridesMap(m);
            },
            error: (e) => console.warn("[EventOverride]", e),
          })
        );
      } catch { /* not deployed yet */ }

      // CalendarSource subscription — handles holidays AND ICS feeds
      try {
        // Auto-seed US holidays on first use
        try {
          const { data: srcs } = await client.models.CalendarSource.list();
          if (srcs.length === 0) {
            const { getCurrentUser } = await import("aws-amplify/auth");
            const { userId } = await getCurrentUser();
            await client.models.CalendarSource.create({
              userId,
              name: "United States Holidays",
              type: "holiday",
              countryCode: "US",
              color: "#8E8E93",
              isVisible: true,
            });
          }
        } catch { /* no-op */ }

        subs.push(
          client.models.CalendarSource.observeQuery().subscribe({
            next: async ({ items }) => {
              if (!active) return;
              const year = dayjs(date).year();
              const allExt: any[] = [];

              for (const src of items) {
                if (src.isVisible === false) continue;

                // Holiday sources via Nager.Date API
                if (src.type === "holiday" && src.countryCode) {
                  try {
                    const res = await fetch(`/api/holidays?country=${src.countryCode}&year=${year}`);
                    const d = await res.json();
                    if (d.events) {
                      allExt.push(...d.events.map((e: any) => ({
                        id: `holiday-${src.id}-${e.startDate}`,
                        title: e.title ?? e.name,
                        allDay: true, isAllDay: true,
                        start: dayjs(e.startDate).toDate(),
                        end: dayjs(e.startDate).add(1, "day").toDate(),
                        color: src.color ?? "#8E8E93",
                        isRecurring: false, recurrence: "NONE",
                        deletedOccurrences: [],
                        source: "holiday", modelType: "external",
                      })));
                    }
                  } catch { /* skip */ }
                }

                // ICS subscription feeds
                if (src.type === "ics" && src.url) {
                  try {
                    const res = await fetch("/api/ics", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ url: src.url }),
                    });
                    const d = await res.json();
                    if (d.events) {
                      allExt.push(...d.events.map((e: any, idx: number) => ({
                        id: `ics-${src.id}-${e.uid ?? idx}`,
                        title: e.title,
                        allDay: e.isAllDay ?? false,
                        isAllDay: e.isAllDay ?? false,
                        start: e.isAllDay
                          ? dayjs(e.startDate).toDate()
                          : dayjs(e.startDate + (e.startTime ? `T${e.startTime}` : "")).toDate(),
                        end: e.isAllDay
                          ? dayjs(e.startDate).add(1, "day").toDate()
                          : dayjs(e.startDate + (e.endTime ? `T${e.endTime}` : "")).add(1, "hour").toDate(),
                        color: src.color ?? "#0A84FF",
                        isRecurring: false, recurrence: "NONE",
                        deletedOccurrences: [],
                        source: "ics", modelType: "external",
                        notes: e.notes,
                      })));
                    }
                  } catch (e) { console.warn("[ICS load]", e); }
                }
              }

              if (active) setExternalEvents(allExt);
            },
            error: (e) => console.warn("[CalendarSource]", e),
          })
        );
      } catch { /* not deployed yet */ }
    };

    init();
    return () => { active = false; subs.forEach((s) => s?.unsubscribe()); };
  }, []); // eslint-disable-line

  // ── Window-level swipe navigation ─────────────────────────────────────────
  useEffect(() => {
    let sx = 0, sy = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - sx;
      const dy = Math.abs(e.changedTouches[0].clientY - sy);
      if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.8) return;
      // Read from the captured view/date via the effect dependency
      const d = dayjs(date);
      if (dx < 0) {
        setDate(view === "day" ? d.add(1, "day").toDate() : view === "week" ? d.add(1, "week").toDate() : d.add(1, "month").toDate());
      } else {
        setDate(view === "day" ? d.subtract(1, "day").toDate() : view === "week" ? d.subtract(1, "week").toDate() : d.subtract(1, "month").toDate());
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [view, date, setDate]);

  // ── Events ────────────────────────────────────────────────────────────────
  const events = [
    ...sourceItems.flatMap((item) => expandRecurring(item, expandStart, expandEnd, overridesMap)),
    ...externalEvents,
  ];

  const scrollTime = (() => {
    const t = new Date();
    t.setHours(Math.max(0, dayjs().hour() - 1), 0, 0, 0);
    return t;
  })();

  const onEventDrop = async ({ event, start, end }: any) => {
    if (event.modelType === "TodoItem" || event.modelType === "external") return;
    
    // We only process CalendarItems. If recurring, apply override.
    try {
      const parentId = event.raw?.id ?? event.id;
      const s = dayjs(start).format("HH:mm:ss");
      const e = dayjs(end).format("HH:mm:ss");
      const startDate = dayjs(start).format("YYYY-MM-DD");
      
      // OPTIMISTIC UI UPDATE
      if (event.isRecurring) {
        setOverridesMap(prev => {
          const m = new Map(prev);
          const parentMap = new Map(m.get(parentId) || new Map());
          parentMap.set(dayjs(event.start).format("YYYY-MM-DD"), { startTime: s, endTime: e });
          m.set(parentId, parentMap);
          return m;
        });
      } else {
        setSourceItems(prev => prev.map((item) => {
          if (item.raw.id === parentId) {
            return {
              ...item,
              start: new Date(start),
              end: new Date(end)
            };
          }
          return item;
        }));
      }

      if (event.isRecurring) {
        // Create an EventOverride
        await client.models.EventOverride.create({
          parentId,
          occurrenceDate: dayjs(event.start).format("YYYY-MM-DD"), // old date
          startTime: s,
          endTime: e,
        });
      } else {
        await client.models.CalendarItem.update({
          id: parentId,
          startDate: startDate,
          startTime: s,
          endTime: e,
        });
      }
    } catch (err) {
      console.error("Drag drop error", err);
    }
  };

  return (
    <>
      <div className="h-full w-full cal-rbc-wrapper">
        <DnDCalendar
          localizer={customLocalizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          view={view as View}
          onView={(v) => setView(v)}
          views={["month", "week", "day", "agenda"]}
          date={date}
          onNavigate={(d) => setDate(d)}
          scrollToTime={scrollTime}
          components={{ toolbar: () => null, event: EventPill }}
          eventPropGetter={() => ({ style: { backgroundColor: "transparent", padding: 0, border: "none" } })}
          onSelectEvent={(event) => {
            if ((event as any).modelType === "external") return;
            setSelectedItem(event);
          }}
          formats={{
            eventTimeRangeFormat: () => "",
            eventTimeRangeStartFormat: () => "",
            eventTimeRangeEndFormat: () => "",
            timeGutterFormat: (d: Date) => dayjs(d).format("h A"),
          }}
          draggableAccessor={(event: any) => !event.isAllDay && event.modelType !== 'external' && event.modelType !== 'TodoItem'}
          resizableAccessor={(event: any) => !event.isAllDay && event.modelType !== 'external' && event.modelType !== 'TodoItem'}
          onEventDrop={onEventDrop}
          onEventResize={onEventDrop}
          resizable
        />
      </div>
      {selectedItem && <ItemModal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </>
  );
}
