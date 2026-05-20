# Purview Callohm - AI Interview Portal

A secure, browser-based AI interview portal for Purview's Round 2 technical screening. Candidates conduct a voice interview with an AI agent (Aliya), while the system monitors session integrity in real time.

**Live URL:** https://purview-callohminterview.web.app

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Application Flow](#application-flow)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Local Development](#local-development)
- [Build & Deployment](#build--deployment)

---

## Overview

Candidates receive a single-use application ID. They enter it on the portal, review instructions, grant camera/microphone permissions, and then proceed to the AI interview. The session is monitored for violations (tab switching, fullscreen exit, DevTools usage). After 3 violations the session is automatically terminated. All events are reported to the backend API.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | React 18 + Vite 5 |
| Routing | React Router v6 |
| Styling | Tailwind CSS v3 |
| Icons | Lucide React |
| AI Voice | ElevenLabs (`@elevenlabs/react`) |
| Hosting | Firebase Hosting |

---

## Application Flow

```
Candidate receives Application ID
         │
         ▼
┌─────────────────────┐
│  / - Application    │  Candidate enters their Application ID.
│      Entry          │  POST /validate → backend confirms ID is valid
└────────┬────────────┘  and returns candidate + job details.
         │  (sessionStorage: validated = true)
         ▼
┌─────────────────────┐
│  /instructions      │  Checklist of 8 rules. Camera + microphone
│                     │  permissions are requested. Network quality
│                     │  (latency + bandwidth) is checked live.
│                     │  Candidate must accept terms to proceed.
└────────┬────────────┘
         │  (sessionStorage: started = true)
         ▼
┌─────────────────────┐
│  /assessment        │  Main interview screen (lazy-loaded).
│                     │  • Fetches ElevenLabs signed URL
│                     │  • POST /session/start
│                     │  • AI agent (Aliya) speaks via ElevenLabs
│                     │  • Candidate camera shown as PiP overlay
│                     │  • Violation monitoring active:
│                     │    - Tab / window focus loss
│                     │    - Fullscreen exit
│                     │    - DevTools open (size heuristic)
│                     │    - Max 3 violations → termination
│                     │  • POST /session/violation on each event
│                     │  • POST /session/end or /violate on finish
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  /session-expired   │  Thank-you / session-ended screen.
│                     │  Session storage is cleared.
└─────────────────────┘
```

### Route Guards

- `/instructions` - requires `sessionData.validated === true`
- `/assessment` - requires `sessionData.started === true`
- Any other path - redirects to `/`

---

## Project Structure

```
purview-callohm-interview-portal/
├── public/                     Static assets
├── src/
│   ├── main.jsx                React DOM entry point
│   ├── App.jsx                 Router + session state management
│   ├── apis/
│   │   └── apiService.js       All backend API calls
│   ├── pages/
│   │   ├── ApplicationEntry.jsx   Step 1 - ID validation
│   │   ├── Instructions.jsx       Step 2 - permissions & checklist
│   │   ├── Assessment.jsx         Step 3 - live AI interview
│   │   └── SessionExpired.jsx     Final / expired screen
│   └── styles/
│       └── global.css          Tailwind directives + custom styles
├── dist/                       Production build output (generated)
├── .env                        Environment variables (not committed)
├── .env.example                Template for environment variables
├── firebase.json               Firebase hosting config (public: dist)
├── .firebaserc                 Firebase project alias
├── vite.config.js              Vite + chunk splitting config
├── tailwind.config.js          Custom theme (navy palette, animations)
└── package.json
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:

```env
VITE_BACKEND_URL=       # Base URL of the Purview backend API
VITE_AGENT_BASE_URL=    # ElevenLabs agent base URL
VITE_AGENT_ID=          # ElevenLabs agent ID
VITE_XI_API_KEY=        # ElevenLabs API key
```

All variables must be prefixed with `VITE_` to be exposed to the browser by Vite.

---

## API Endpoints

All calls go through `src/apis/apiService.js`. The `XI-API-Key` header is attached automatically.

| Method | Path | Purpose |
|---|---|---|
| POST | `/recruitment/agents/round2/validate/{applicationId}` | Validate application ID |
| GET | `/redirect/v1/convai/conversation/get_signed_url?agent_id=` | Get ElevenLabs signed URL |
| POST | `/recruitment/agents/round2/session/start/{applicationId}` | Start interview session |
| POST | `/recruitment/agents/round2/session/violation/{applicationId}` | Report a violation |
| POST | `/recruitment/agents/round2/session/end/{applicationId}` | End session normally |
| POST | `/recruitment/agents/round2/violate/{applicationId}` | Terminate after max violations |

---

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in values
cp .env.example .env

# Start dev server (accessible on local network)
npm run dev
```

The dev server runs at `http://localhost:5173`. Because `server: { host: true }` is set in `vite.config.js`, the Network URL is also shown so you can share it with devices on the same Wi-Fi.

---

## Build & Deployment

The app is hosted on **Firebase Hosting** under the project `purview-callohminterview`.

### One-time setup (already done)

```bash
npm install -g firebase-tools
firebase login   # login as purview2026@gmail.com
firebase init hosting   # public dir: dist, rewrite all to index.html
```

> Firebase account: **purview2026@gmail.com**

### Deploy

```bash
# 1. Build production bundle
npm run build

# 2. Deploy to Firebase Hosting
firebase deploy --only hosting
```

Firebase deploys the contents of the `dist/` folder. The SPA rewrite rule in `firebase.json` ensures all routes resolve to `index.html`.

**Project console:** https://console.firebase.google.com/project/purview-callohminterview/overview  
**Live URL:** https://purview-callohminterview.web.app

### Update Firebase CLI (when prompted)

```bash
npm install -g firebase-tools
```

---

## Session Storage Schema

The app persists interview state in `sessionStorage` under the key `interview_session`:

```json
{
  "applicationId": "string",
  "candidateId": "string",
  "jobId": "string",
  "candidateName": "string",
  "validated": true,
  "started": true
}
```

State is cleared on session end, termination, or when the candidate navigates away from the assessment.

---

## Violation Policy

| Violation | Trigger |
|---|---|
| Tab / window switch | `blur` event on `window` |
| Fullscreen exit | `fullscreenchange` event |
| DevTools open | Window inner dimensions heuristic |

- Each violation is reported to the backend immediately.
- A toast notification is shown to the candidate.
- After **3 violations** the session is automatically terminated and the candidate is redirected to `/session-expired`.
