import { type ClientSchema, a, defineData } from "@aws-amplify/backend";

const schema = a.schema({
  CalendarItem: a
    .model({
      userId: a.string().required(),
      title: a.string().required(),
      isAllDay: a.boolean(),
      startDate: a.date().required(),
      startTime: a.time(),
      endTime: a.time(),
      recurrence: a.enum(["DAILY", "WEEKLY", "MONTHLY", "WEEKDAYS", "WEEKENDS", "CUSTOM", "NONE"]),
      recurrenceEndDate: a.date(),
      customRecurrenceDays: a.integer().array(),
      color: a.string(),
      notes: a.string(),
      // Stores ISO date strings (YYYY-MM-DD) of occurrences deleted individually
      deletedOccurrences: a.string().array(),
      // Source: "user" | "ics" | "holiday"
      source: a.string(),
      feedUrl: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  EventOverride: a
    .model({
      parentId: a.string().required(),
      occurrenceDate: a.date().required(), // Which occurrence date this overrides
      title: a.string(),
      startTime: a.time(),
      endTime: a.time(),
      color: a.string(),
      notes: a.string(),
      isDeleted: a.boolean(), // True = this occurrence is individually deleted
    })
    .authorization((allow) => [allow.owner()]),

  TodoItem: a
    .model({
      userId: a.string().required(),
      title: a.string().required(),
      deadline: a.datetime(),
      hasTime: a.boolean(),
      isRecurring: a.boolean(),
      recurrence: a.enum(["DAILY", "WEEKLY", "MONTHLY", "WEEKDAYS", "WEEKENDS", "CUSTOM", "NONE"]),
      recurrenceEndDate: a.date(),
      lastCompletedAt: a.datetime(),
      nextOccurrence: a.datetime(),
      isDone: a.boolean(),
      notes: a.string(),
    })
    .authorization((allow) => [allow.owner()]),

  CompletionLog: a
    .model({
      itemId: a.string().required(),
      userId: a.string().required(),
      completedAt: a.datetime().required(),
      occurrenceDate: a.date(),
    })
    .authorization((allow) => [allow.owner()]),

  CalendarSource: a
    .model({
      userId: a.string().required(),
      name: a.string().required(),
      type: a.enum(["ics", "holiday"]),
      url: a.string(),          // ICS feed URL
      countryCode: a.string(), // e.g. "US", "IN" for holidays
      color: a.string(),
      isVisible: a.boolean(),
      lastSyncedAt: a.datetime(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: "userPool",
  },
});
