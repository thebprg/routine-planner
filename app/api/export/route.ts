import { NextResponse } from "next/server";
import { getCurrentUser } from "aws-amplify/auth";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import outputs from "@/amplify_outputs.json";
import type { Schema } from "@/amplify/data/resource";
import dayjs from "dayjs";

// Server-side Amplify setup
Amplify.configure(outputs, { ssr: true });

// GET /api/export
// Returns a downloadable .ics file containing all user CalendarItems
export async function GET(request: Request) {
  try {
    // Note: In App Router API routes we can't directly auth server-side via Cognito easily.
    // We'll use a query param token approach or require the client to POST the data.
    // For simplicity, we accept the events as POST body from the client.
    return NextResponse.json({ error: "Use POST" }, { status: 405 });
  } catch (e) {
    return NextResponse.json({ error: "Error" }, { status: 500 });
  }
}

// POST /api/export  body: { events: CalendarItem[] }
export async function POST(request: Request) {
  try {
    const { events } = await request.json() as { events: any[] };

    const lines: string[] = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Cal App//Cal//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
    ];

    for (const ev of events) {
      const uid = `${ev.id}@cal-app`;
      const dtstamp = dayjs().format("YYYYMMDDTHHmmss") + "Z";

      if (ev.isAllDay) {
        const start = (ev.startDate as string).replace(/-/g, "");
        const end = ev.endDate
          ? (ev.endDate as string).replace(/-/g, "")
          : dayjs(ev.startDate).add(1, "day").format("YYYYMMDD");
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART;VALUE=DATE:${start}`);
        lines.push(`DTEND;VALUE=DATE:${end}`);
        lines.push(`SUMMARY:${ev.title?.replace(/,/g, "\\,") ?? ""}`);
        if (ev.notes) lines.push(`DESCRIPTION:${ev.notes.replace(/\n/g, "\\n")}`);
        lines.push("END:VEVENT");
      } else {
        const startDT = dayjs(`${ev.startDate}T${ev.startTime ?? "00:00:00"}`).format("YYYYMMDDTHHmmss");
        const endDT = ev.endTime
          ? dayjs(`${ev.startDate}T${ev.endTime}`).format("YYYYMMDDTHHmmss")
          : dayjs(`${ev.startDate}T${ev.startTime ?? "00:00:00"}`).add(1, "hour").format("YYYYMMDDTHHmmss");

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${dtstamp}`);
        lines.push(`DTSTART:${startDT}`);
        lines.push(`DTEND:${endDT}`);
        lines.push(`SUMMARY:${ev.title?.replace(/,/g, "\\,") ?? ""}`);
        if (ev.notes) lines.push(`DESCRIPTION:${ev.notes.replace(/\n/g, "\\n")}`);

        // Recurrence rule
        if (ev.recurrence && ev.recurrence !== "NONE") {
          const rruleMap: Record<string, string> = {
            DAILY: "FREQ=DAILY",
            WEEKLY: "FREQ=WEEKLY",
            MONTHLY: "FREQ=MONTHLY",
            WEEKDAYS: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
            WEEKENDS: "FREQ=WEEKLY;BYDAY=SA,SU",
          };
          let rrule = rruleMap[ev.recurrence] ?? "FREQ=DAILY";
          if (ev.recurrenceEndDate) {
            rrule += `;UNTIL=${ev.recurrenceEndDate.replace(/-/g, "")}T235959Z`;
          }
          lines.push(`RRULE:${rrule}`);
        }

        lines.push("END:VEVENT");
      }
    }

    lines.push("END:VCALENDAR");

    const icsContent = lines.join("\r\n");

    return new NextResponse(icsContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="cal-export.ics"',
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}
