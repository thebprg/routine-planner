import dayjs from "dayjs";

export type TodoStatus = "past-due" | "today" | "upcoming" | "no-deadline";

export const CALENDAR_STEP_MINUTES = 30;

type SnapMode = "floor" | "ceil" | "nearest";

function normalizeTimeInput(time?: string | null) {
  if (!time) return "";
  return time.length >= 5 ? time.slice(0, 5) : time;
}

export function buildTodoDeadline(date?: string | null, time?: string | null) {
  if (!date) {
    return { deadline: null, hasTime: false };
  }

  const normalizedTime = normalizeTimeInput(time);
  if (normalizedTime) {
    return {
      deadline: dayjs(`${date}T${normalizedTime}`).second(0).millisecond(0).toISOString(),
      hasTime: true,
    };
  }

  return {
    deadline: dayjs(date).endOf("day").toISOString(),
    hasTime: false,
  };
}

export function getTodoFormValues(deadline?: string | null, hasTime?: boolean | null) {
  if (!deadline) {
    return { date: "", time: "", hasTime: false };
  }

  const parsed = dayjs(deadline);
  return {
    date: parsed.format("YYYY-MM-DD"),
    time: hasTime ? parsed.format("HH:mm") : "",
    hasTime: Boolean(hasTime),
  };
}

export function getTodoStatus(deadline?: string | null, hasTime?: boolean | null, now = dayjs()): TodoStatus {
  if (!deadline) return "no-deadline";

  const dueAt = dayjs(deadline);
  const overdueThreshold = hasTime ? dueAt : dueAt.endOf("day");

  if (overdueThreshold.isBefore(now)) return "past-due";
  if (dueAt.isSame(now, "day")) return "today";
  return "upcoming";
}

export function snapDayjsToStep(value: dayjs.ConfigType, mode: SnapMode = "nearest") {
  const current = dayjs(value).second(0).millisecond(0);
  const minutes = current.minute();
  const remainder = minutes % CALENDAR_STEP_MINUTES;

  if (remainder === 0) return current;

  if (mode === "floor") {
    return current.minute(minutes - remainder);
  }

  if (mode === "ceil") {
    return current.minute(minutes + (CALENDAR_STEP_MINUTES - remainder));
  }

  return remainder >= CALENDAR_STEP_MINUTES / 2
    ? current.minute(minutes + (CALENDAR_STEP_MINUTES - remainder))
    : current.minute(minutes - remainder);
}

export function snapEventRange(start: Date, end: Date) {
  const snappedStart = snapDayjsToStep(start, "nearest");
  let snappedEnd = snapDayjsToStep(end, "nearest");

  if (!snappedEnd.isAfter(snappedStart)) {
    snappedEnd = snappedStart.add(CALENDAR_STEP_MINUTES, "minute");
  }

  return {
    start: snappedStart.toDate(),
    end: snappedEnd.toDate(),
  };
}

export function omitNullish<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)
  ) as Partial<T>;
}

export function buildCalendarItemInput(data: any) {
  return omitNullish({
    title: data.title,
    isAllDay: data.isAllDay,
    startDate: data.startDate,
    startTime: data.startTime,
    endTime: data.endTime,
    recurrence: data.recurrence,
    recurrenceEndDate: data.recurrenceEndDate,
    color: data.color,
    notes: data.notes,
    priority: data.priority,
    source: data.source,
    deletedOccurrences: data.deletedOccurrences,
    feedUrl: data.feedUrl,
    userId: data.userId,
    id: data.id,
  }) as any;
}

export function buildTodoItemInput(data: any) {
  return omitNullish({
    title: data.title,
    deadline: data.deadline,
    hasTime: data.hasTime,
    isRecurring: data.isRecurring,
    recurrence: data.recurrence,
    recurrenceEndDate: data.recurrenceEndDate,
    lastCompletedAt: data.lastCompletedAt,
    nextOccurrence: data.nextOccurrence,
    isDone: data.isDone,
    notes: data.notes,
    priority: data.priority,
    userId: data.userId,
    id: data.id,
  }) as any;
}
