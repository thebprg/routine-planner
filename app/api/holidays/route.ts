import { NextResponse } from "next/server";

// GET /api/holidays?country=US&year=2025
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get("country") ?? "US";
  const year = searchParams.get("year") ?? new Date().getFullYear().toString();

  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch holidays" }, { status: res.status });
    }

    const holidays = await res.json();

    // Map to our CalendarEvent shape
    const events = (holidays as any[]).map((h) => ({
      title: h.localName || h.name,
      startDate: h.date, // YYYY-MM-DD
      isAllDay: true,
      source: "holiday",
      country,
      notes: h.name !== h.localName ? h.name : undefined,
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error("Holiday fetch error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
