# Planner 🗓️

An intelligent, cross-platform calendar and task management ecosystem, engineered with modern web standards and powered directly by AI. 
This application aims to provide a unified daily workspace connecting standard time-blocking (Events) with continuous workflows (Tasks) in an Apple-inspired deeply polished UI.

## Features

- **Split Auth Flow**: Custom built, smooth, and secure sign in / sign up orchestration leveraging AWS Amplify direct authentication APIs.
- **Dynamic Unified View**: Interact with fully customized Calendar instances using `react-big-calendar`. Drag & drop, rolling 7-day windows starting from Yesterday, and highly polished custom visual layouts.
- **Smart Natural Language (AI) Commands**: Instruct the built-in Gemini LLM to create, edit, batch delete, or reorganize events and tasks directly into the schedule.
- **ICS Calendars Import**: Subscribe continuously to `.ics` external calendars (e.g., standard US Holidays or your school timetables).
- **Extensible Sync**: Full `@aws-amplify/data` realtime backend synchronization across multiple devices via `observeQuery()`.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Styling**: TailwindCSS & Custom Variables
- **Backend & Auth**: AWS Amplify Gen 2 (Cognito, AppSync / DynamoDB)
- **Calendar Engine**: React Big Calendar
- **AI**: Gemini Protocol (Google Generative AI)

## Installation

1. Copy the `.env.local` to securely route the LLM provider.
```sh
npm install
npm run dev
```

If the sandbox has been suspended, run your AWS Amplify backend locally:
```sh
npx ampx sandbox --profile <your-credentials-profile>
```

## Structure
- `app/(main)` — Authenticated App Shell (Sidebar + Topbar + Calendar / Agenda grids).
- `app/api` — AI natural language orchestrators and robust proxy-validators for fetching external `.ics` feeds securely.
- `app/components` — Reusable, atomic design components defining the Custom Forms, Item Modals, Auth Page, and Custom Calendar logic.
- `amplify/` — Infrastructure as Code definitions (Schema, Auth, and Storage routing).

## Design Philosophy

The focus is to completely eliminate spreadsheet-like UI friction.
We prioritize glass-morphism inputs, smooth slide animations, accurate sub-pixel date math, native dark-mode balancing, and highly responsive interactions over unstyled generic components. 