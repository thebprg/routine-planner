import { NextResponse } from "next/server";

export const maxDuration = 30; // Allow up to 30s for slow ICS feeds

// POST /api/ics  body: { url: string }
// Fetches and parses an ICS calendar feed server-side to avoid CORS
export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Validate URL scheme
    if (!url.startsWith("http://") && !url.startsWith("https://") && !url.startsWith("webcal://")) {
      return NextResponse.json({ error: "Invalid URL. Must start with http://, https://, or webcal://" }, { status: 400 });
    }

    // webcal:// → https://
    const fetchUrl = url.replace(/^webcal:\/\//i, "https://");

    let icsText: string;
    try {
      const res = await fetch(fetchUrl, {
        headers: {
          "User-Agent": "Cal-App/1.0 (Calendar Subscription)",
          "Accept": "text/calendar, application/ics, text/plain, */*",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(20000), // 20s timeout
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Calendar server responded with ${res.status}. Make sure the URL is a public calendar link.` },
          { status: 400 }
        );
      }

      const contentType = res.headers.get("content-type") ?? "";
      icsText = await res.text();

      // Basic sanity check — real ICS files contain BEGIN:VCALENDAR
      if (!icsText.includes("BEGIN:VCALENDAR") && !icsText.includes("BEGIN:VEVENT")) {
        const preview = icsText.substring(0, 200);
        console.warn("ICS content preview:", preview);
        return NextResponse.json(
          { error: "That URL doesn't appear to be a valid ICS calendar feed. Make sure you copied the calendar subscription link (not a web page URL)." },
          { status: 400 }
        );
      }
    } catch (err: any) {
      if (err.name === "TimeoutError" || err.name === "AbortError") {
        return NextResponse.json({ error: "The calendar server took too long to respond." }, { status: 408 });
      }
      return NextResponse.json({ error: "Could not reach that URL. Check the link and try again." }, { status: 400 });
    }

    const events = parseICS(icsText);
    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    console.error("ICS route error:", err);
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

// ─── ICS parser ───────────────────────────────────────────────────────────────
function parseICS(raw: string) {
  // Normalize line endings and unfold continuation lines (RFC 5545 §3.1)
  const text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, ""); // unfold

  const events: any[] = [];
  const vevents = text.split(/BEGIN:VEVENT/i).slice(1);

  for (const block of vevents) {
    try {
      const get = (key: string): string => {
        // Match key with optional parameters (e.g., DTSTART;TZID=America/New_York)
        const match = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, "mi"));
        return match ? match[1].trim() : "";
      };

      const summary     = unescape(get("SUMMARY"));
      const dtstart     = get("DTSTART");
      const dtend       = get("DTEND") || get("DUE");
      const uid         = get("UID");
      const description = unescape(get("DESCRIPTION"));
      const location    = unescape(get("LOCATION"));

      if (!summary || !dtstart) continue;

      const startParsed = parseICSDate(dtstart);
      const endParsed   = dtend ? parseICSDate(dtend) : null;

      if (!startParsed) continue;

      events.push({
        uid,
        title: summary,
        startDate: startParsed.date,
        startTime: startParsed.time ?? null,
        endDate: endParsed?.date ?? startParsed.date,
        endTime: endParsed?.time ?? null,
        isAllDay: startParsed.allDay,
        notes: [description, location ? `📍 ${location}` : ""].filter(Boolean).join("\n") || null,
        source: "ics",
      });
    } catch { /* skip malformed event */ }
  }

  return events;
}

// ─── Date parser — handles multiple ICS date formats ─────────────────────────
function parseICSDate(raw: string): { date: string; time: string | null; allDay: boolean } | null {
  if (!raw) return null;

  // DATE-only: YYYYMMDD
  if (/^\d{8}$/.test(raw)) {
    return {
      date: `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`,
      time: null,
      allDay: true,
    };
  }

  // DATETIME local: YYYYMMDDTHHmmss
  if (/^\d{8}T\d{6}(Z)?$/.test(raw)) {
    const y  = raw.slice(0, 4);
    const mo = raw.slice(4, 6);
    const da = raw.slice(6, 8);
    const h  = raw.slice(9, 11);
    const mi = raw.slice(11, 13);
    const se = raw.slice(13, 15);
    return {
      date: `${y}-${mo}-${da}`,
      time: `${h}:${mi}:${se}`,
      allDay: false,
    };
  }

  // Already ISO 8601? e.g. 2026-04-11T09:00:00Z
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    const [datePart, timePart] = raw.replace("Z", "").split("T");
    return {
      date: datePart,
      time: timePart ? timePart.substring(0, 8) : null,
      allDay: false,
    };
  }

  // DATE ISO: 2026-04-11
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { date: raw, time: null, allDay: true };
  }

  return null;
}

// ─── Unescape ICS text values ─────────────────────────────────────────────────
function unescape(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .trim();
}
