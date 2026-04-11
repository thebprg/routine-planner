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
    const time = dayjs().format("HH:mm");

    const systemPrompt = `You are Cal, a scheduling AI assistant embedded in a calendar app. Today is ${today}, current time is ${time}.

Return ONLY a single valid JSON object. No markdown, no code fences, no explanation text.

JSON shape:
{
  "action": "add" | "edit" | "delete" | "clarify",
  "itemType": "CalendarItem" | "TodoItem",
  "targetId": "exact id string from existingItems, or null",
  "targetTitle": "title of item to edit/delete if targetId unknown",
  "data": {
    "title": "string",
    "isAllDay": true | false,
    "startDate": "YYYY-MM-DD",
    "startTime": "HH:MM:SS or null",
    "endTime": "HH:MM:SS or null",
    "deadline": "ISO 8601 string or null",
    "hasTime": true | false,
    "isRecurring": true | false,
    "recurrence": "DAILY" | "WEEKLY" | "MONTHLY" | "WEEKDAYS" | "WEEKENDS" | "NONE",
    "recurrenceEndDate": "YYYY-MM-DD or null",
    "color": "#hex or null",
    "notes": "string or null"
  },
  "message": "short, friendly confirmation message"
}

Classification:
1. CalendarItem — has a specific time block (meeting at 3pm) OR is all-day (conference on Friday). Can be recurring.
2. TodoItem — task/reminder/chore without a dedicated time block. May have a deadline.

Rules:
- For "add": populate data fully.
- For "edit": set targetId if you can match it from existingItems, otherwise set targetTitle. Only populate the fields that are changing in data.
- For "delete": set targetId or targetTitle. data can be empty {}.
- For relative dates: "tomorrow" = ${dayjs().add(1, "day").format("YYYY-MM-DD")}, "next week" starts ${dayjs().add(1, "week").startOf("week").format("YYYY-MM-DD")}.
- Never return recurrenceEndDate unless the user specifies one.
- Omit color field unless user says a color. Default will be applied by the client.
- NEVER include markdown, code blocks, or any text outside the JSON object.`;

    const messages: { role: string; content: string }[] = [
      { role: "user", content: systemPrompt },
      {
        role: "model",
        content: JSON.stringify({
          action: "clarify",
          itemType: "CalendarItem",
          targetId: null,
          targetTitle: null,
          data: {},
          message: "Ready. I will return only valid JSON for CalendarItem and TodoItem actions.",
        }),
      },
    ];

    // Inject existing item context so AI can resolve edit/delete targets
    if (existingItems && existingItems.length > 0) {
      const summary = existingItems
        .slice(0, 50) // Cap at 50 to keep prompt size reasonable
        .map((i: any) =>
          `[id:${i.id}] "${i.title}" (${i.type})${i.startDate ? " on " + i.startDate : ""}${i.deadline ? " deadline " + dayjs(i.deadline).format("YYYY-MM-DD") : ""}`
        )
        .join("\n");

      messages.push({
        role: "user",
        content: `Here are the user's existing items. Use their exact id for targetId when editing/deleting:\n${summary}`,
      });
      messages.push({
        role: "model",
        content: JSON.stringify({ action: "clarify", data: {}, message: "Noted all existing items." }),
      });
    }

    // Inject current open item (ItemModal context)
    if (currentItemContext) {
      messages.push({
        role: "user",
        content: `The user currently has this item open: ${JSON.stringify(currentItemContext)}. Use its id as targetId for edits/deletes.`,
      });
      messages.push({
        role: "model",
        content: JSON.stringify({ action: "clarify", data: {}, message: "Got item context." }),
      });
    }

    // Conversation history
    if (history && history.length > 0) {
      for (const h of history.slice(-10)) { // Last 10 turns
        messages.push({ role: h.role === "user" ? "user" : "model", content: h.content });
      }
    }

    messages.push({ role: "user", content: message });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
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
    } catch {
      console.error("Failed to parse AI JSON:", aiText);
      return NextResponse.json(
        { error: "I didn't understand that. Could you rephrase?", raw: aiText },
        { status: 200 } // Return 200 so the UI shows the message
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
