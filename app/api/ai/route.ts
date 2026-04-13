import { NextResponse } from "next/server";
import dayjs from "dayjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, history, currentItemContext, existingItems } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API Key not configured." }, { status: 500 });
    }

    const today = dayjs().format("YYYY-MM-DD");
    const todayFull = dayjs().format("dddd, MMMM D, YYYY");
    const time = dayjs().format("HH:mm");

    const systemPrompt = `You are Planner, a smart scheduling AI assistant embedded in a calendar app.
Today is ${todayFull} (${today}). Current time is ${time}.

Return ONLY a single valid JSON object. No markdown, no code fences, no explanation text.

JSON shape:
{
  "operations": [
    {
      "action": "add" | "edit" | "clarify",
      "itemType": "CalendarItem" | "TodoItem",
      "targetId": "exact id string from existingItems, or null",
      "targetTitle": "title of item to edit if targetId unknown",
      "targetDate": "YYYY-MM-DD if targeting items by date",
      "data": {
        "title": "string",
        "isAllDay": true | false,
        "startDate": "YYYY-MM-DD",
        "startTime": "HH:MM:SS or null",
        "endTime": "HH:MM:SS or null",
        "deadline": "ISO 8601 string or null (TodoItem only)",
        "hasTime": true | false,
        "isRecurring": true | false,
        "recurrence": "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAYS" | "WEEKENDS" | "NONE",
        "recurrenceEndDate": "YYYY-MM-DD or null",
        "priority": 0 | 1 | 2 | 3,
        "color": "#hex or null",
        "notes": "string or null"
      }
    }
  ],
  "message": "Friendly conversational response summarizing what you did OR answering the user's question."
}

Classification:
1. CalendarItem (Event) — has a specific time block (meeting at 3pm) OR is all-day (conference on Friday). Can be recurring.
2. TodoItem (Task) — task/reminder without a dedicated time block. May have a deadline.

Priority field (for both types):
- 0 = no priority (default)
- 1 = low (1 star)
- 2 = medium (2 stars)
- 3 = high (3 stars)
Use contextual cues like "important", "urgent", "low priority", "critical" → map to 3, 3, 1, 3 etc.

Rules:
- NEVER output a "delete" action. You cannot delete items.
- For "add": populate data fully.
  * If no time stated for an Event: set "isAllDay": true, omit startTime/endTime.
  * If time stated: set "isAllDay": false, set startTime and endTime (default: 1-hour block if end not given).
  * Default priority: 0.
- For "edit": set targetId if you can match from existingItems, otherwise use targetTitle or targetDate.
- For "clarify": use when the user is asking a question (e.g. "what do I have tomorrow?", "am I free at 3pm?").
  * Set operations to [] (empty array), put your full answer in "message".
  * Use the existingItems context to answer questions about the user's schedule.
- Relative dates: "tomorrow" = ${dayjs().add(1, "day").format("YYYY-MM-DD")}, "next week" starts ${dayjs().add(1, "week").startOf("week").format("YYYY-MM-DD")}, "this weekend" = ${dayjs().day(6).format("YYYY-MM-DD")}.
- TodoItem deadline MUST be valid ISO 8601 (e.g. "${dayjs().toISOString()}") or null.
- Never return recurrenceEndDate unless the user specifies one.
- Omit color field unless user says a color.
- If user asks for multiple events/tasks in one message, output multiple operations in the array.
- NEVER include markdown, code blocks, or any text outside the JSON object.`;

    const messages: { role: string; content: string }[] = [
      { role: "user", content: systemPrompt },
      {
        role: "model",
        content: JSON.stringify({
          operations: [],
          message: "Ready. I will return only valid JSON with an operations array. I can add/edit items and answer questions about your schedule.",
        }),
      },
    ];

    // Inject schedule context — rich format with times and recurrence
    if (existingItems && existingItems.length > 0) {
      const calItems = existingItems.filter((i: any) => i.type === "CalendarItem");
      const todoItems = existingItems.filter((i: any) => i.type === "TodoItem");

      const calSummary = calItems
        .slice(0, 60)
        .map((i: any) => {
          const time = i.startTime ? ` ${i.startTime.slice(0, 5)}–${(i.endTime ?? "").slice(0, 5)}` : " (all-day)";
          const rec = i.recurrence && i.recurrence !== "NONE" ? ` [repeats ${i.recurrence}]` : "";
          const pri = i.priority ? ` [priority:${i.priority}]` : "";
          return `[id:${i.id}] "${i.title}" on ${i.startDate}${time}${rec}${pri}`;
        })
        .join("\n");

      const todoSummary = todoItems
        .slice(0, 30)
        .map((i: any) => {
          const dl = i.deadline ? ` deadline:${dayjs(i.deadline).format("YYYY-MM-DD HH:mm")}` : "";
          const pri = i.priority ? ` [priority:${i.priority}]` : "";
          return `[id:${i.id}] "${i.title}" (Task)${dl}${pri}`;
        })
        .join("\n");

      const scheduleSummary = [
        calSummary ? `EVENTS:\n${calSummary}` : "EVENTS: none",
        todoSummary ? `TASKS:\n${todoSummary}` : "TASKS: none",
      ].join("\n\n");

      messages.push({
        role: "user",
        content: `Here is my current schedule. Use exact ids for edits and this data to answer schedule questions:\n\n${scheduleSummary}`,
      });
      messages.push({
        role: "model",
        content: JSON.stringify({ operations: [], message: "Got your schedule. I can answer questions about it or make changes." }),
      });
    }

    // Inject current open item context for in-modal AI
    if (currentItemContext) {
      messages.push({
        role: "user",
        content: `I currently have this item open:\n${JSON.stringify(currentItemContext, null, 2)}\nUse its id as targetId for edits.`,
      });
      messages.push({
        role: "model",
        content: JSON.stringify({ operations: [], message: "Got the open item context." }),
      });
    }

    // Conversation history (last 10 turns)
    if (history && history.length > 0) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role === "user" ? "user" : "model", content: h.content });
      }
    }

    messages.push({ role: "user", content: message });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages.map((m) => ({
            role: m.role === "model" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("AI API Error:", err);
      return NextResponse.json({ error: "Failed to communicate with AI model" }, { status: 500 });
    }

    const geminiData = await response.json();
    const aiText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed;
    try {
      const cleaned = aiText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found");
      parsed = JSON.parse(match[0]);

      // Normalize: support old single-op format from model responding incorrectly
      if (!parsed.operations && parsed.action) {
        parsed = { operations: [parsed], message: parsed.message || "" };
      }
      if (!Array.isArray(parsed.operations)) {
        parsed.operations = [];
      }
    } catch {
      console.error("Failed to parse AI JSON:", aiText);
      return NextResponse.json(
        { operations: [], message: "I didn't quite understand that. Could you rephrase?" },
        { status: 200 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
